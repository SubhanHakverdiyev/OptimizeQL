"""Simulate index impact using PostgreSQL's HypoPG extension."""

import json
import logging
from dataclasses import dataclass

from api.models.schemas import PlanNodeChange, SimulateIndexResult

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_MS = 10_000


def _extract_total_cost(plan_json: list[dict]) -> float | None:
    """Extract the top-level Total Cost from an EXPLAIN (FORMAT JSON) result."""
    if not plan_json:
        return None
    top = plan_json[0] if isinstance(plan_json, list) else plan_json
    plan = top.get("Plan", top)
    return plan.get("Total Cost")


def _collect_scan_nodes(plan: dict, result: list[dict] | None = None) -> list[dict]:
    """Recursively collect scan nodes (Seq Scan, Index Scan, etc.) from a plan tree."""
    if result is None:
        result = []
    node_type = plan.get("Node Type", "")
    if "Scan" in node_type or "Search" in node_type:
        result.append({
            "node_type": node_type,
            "relation": plan.get("Relation Name", ""),
            "index_name": plan.get("Index Name", ""),
            "total_cost": plan.get("Total Cost", 0),
            "rows": plan.get("Plan Rows", 0),
        })
    for child in plan.get("Plans", []):
        _collect_scan_nodes(child, result)
    return result


def _find_node_changes(
    original_plan: list[dict], simulated_plan: list[dict]
) -> list[PlanNodeChange]:
    """Compare scan nodes between original and simulated plans."""
    orig_root = original_plan[0].get("Plan", {}) if original_plan else {}
    sim_root = simulated_plan[0].get("Plan", {}) if simulated_plan else {}

    orig_scans = _collect_scan_nodes(orig_root)
    sim_scans = _collect_scan_nodes(sim_root)

    changes: list[PlanNodeChange] = []

    # Match by relation name
    orig_by_rel: dict[str, dict] = {}
    for s in orig_scans:
        rel = s["relation"]
        if rel and rel not in orig_by_rel:
            orig_by_rel[rel] = s

    for sim_node in sim_scans:
        rel = sim_node["relation"]
        orig_node = orig_by_rel.get(rel)
        if not orig_node:
            continue
        if orig_node["node_type"] != sim_node["node_type"]:
            before_label = orig_node["node_type"]
            if orig_node["relation"]:
                before_label += f" on {orig_node['relation']}"
            after_label = sim_node["node_type"]
            if sim_node["index_name"]:
                after_label += f" using {sim_node['index_name']}"
            elif sim_node["relation"]:
                after_label += f" on {sim_node['relation']}"
            changes.append(PlanNodeChange(
                before=before_label,
                after=after_label,
                cost_before=orig_node["total_cost"],
                cost_after=sim_node["total_cost"],
            ))

    return changes


class IndexSimulator:
    """Simulate index impact using PostgreSQL's HypoPG extension.

    Requires a raw psycopg2 connection (NOT read-only) because
    hypopg_create_index() needs write access within the session.
    """

    def __init__(self, conn) -> None:
        self._conn = conn

    def simulate(
        self,
        index_sql: str,
        query_sql: str,
        timeout_ms: int = DEFAULT_TIMEOUT_MS,
    ) -> SimulateIndexResult:
        # 1. Check if hypopg is available
        if not self._ensure_hypopg():
            return SimulateIndexResult(
                success=False,
                hypopg_available=False,
                error="HypoPG extension is not available. Install it with: CREATE EXTENSION hypopg;",
            )

        try:
            # 2. Get original EXPLAIN
            original_plan = self._explain(query_sql, timeout_ms)
            original_cost = _extract_total_cost(original_plan)

            # 3. Create hypothetical index
            self._create_hypo_index(index_sql)

            # 4. Get EXPLAIN with hypothetical index
            simulated_plan = self._explain(query_sql, timeout_ms)
            simulated_cost = _extract_total_cost(simulated_plan)

            # 5. Compare
            cost_reduction_pct = None
            if original_cost and simulated_cost and original_cost > 0:
                cost_reduction_pct = round(
                    (1 - simulated_cost / original_cost) * 100, 1
                )

            node_changes = _find_node_changes(original_plan, simulated_plan)

            return SimulateIndexResult(
                success=True,
                original_cost=original_cost,
                simulated_cost=simulated_cost,
                cost_reduction_pct=cost_reduction_pct,
                original_plan=json.dumps(original_plan, indent=2),
                simulated_plan=json.dumps(simulated_plan, indent=2),
                node_changes=node_changes,
            )

        except Exception as exc:
            logger.exception("Index simulation failed: %s", exc)
            return SimulateIndexResult(
                success=False,
                error=str(exc).strip(),
            )
        finally:
            # 6. Always clean up hypothetical indexes
            self._reset_hypo()

    def _ensure_hypopg(self) -> bool:
        """Check if hypopg extension is available, try to create it."""
        try:
            with self._conn.cursor() as cur:
                cur.execute("CREATE EXTENSION IF NOT EXISTS hypopg")
                self._conn.commit()
            return True
        except Exception:
            self._conn.rollback()
            # Check if it's already installed
            try:
                with self._conn.cursor() as cur:
                    cur.execute(
                        "SELECT 1 FROM pg_extension WHERE extname = 'hypopg'"
                    )
                    row = cur.fetchone()
                    return row is not None
            except Exception:
                self._conn.rollback()
                return False

    def _explain(self, sql: str, timeout_ms: int) -> list[dict]:
        """Run EXPLAIN (FORMAT JSON) — planner costs only, no execution."""
        with self._conn.cursor() as cur:
            cur.execute(f"SET LOCAL statement_timeout = {int(timeout_ms)}")
            cur.execute(f"EXPLAIN (FORMAT JSON) {sql}")
            rows = cur.fetchall()
            return rows[0][0] if rows else []

    def _create_hypo_index(self, index_sql: str) -> None:
        """Create a hypothetical index via HypoPG."""
        with self._conn.cursor() as cur:
            # hypopg_create_index expects the CREATE INDEX statement as text
            cur.execute("SELECT indexrelid FROM hypopg_create_index(%s)", (index_sql,))
            result = cur.fetchone()
            if not result:
                raise RuntimeError("hypopg_create_index returned no result")
            logger.debug("Created hypothetical index with OID %s", result[0])

    def _reset_hypo(self) -> None:
        """Remove all hypothetical indexes from this session."""
        try:
            with self._conn.cursor() as cur:
                cur.execute("SELECT hypopg_reset()")
            self._conn.rollback()
        except Exception as exc:
            logger.warning("hypopg_reset failed: %s", exc)
            try:
                self._conn.rollback()
            except Exception:
                pass

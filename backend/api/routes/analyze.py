"""Query analysis endpoint — the core of the application."""

import json
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from sqlalchemy.orm import Session

from api.dependencies import get_real_ip, require_api_key
from api.models.orm import AnalyticsLog, LLMConfig, QueryHistory
from api.models.schemas import (
    AnalysisResult,
    AnalyzeRequest,
    CategoryCount,
    CompareRequest,
    CompareResult,
    DashboardStats,
    QueryByDate,
    QueryHistoryItem,
    RecentAnalysis,
    SimulateIndexRequest,
    SimulateIndexResult,
    TableCount,
)
from core.config import settings
from core.database import get_db
from core.encryption import decrypt
from services.connection_manager import ConnectionManager
from services.llm_analyzer import LLMAnalyzer
from services.llm_providers import get_provider
from services.query_comparator import compare_queries
from services.query_introspector import QueryIntrospectionResult, QueryIntrospector

logger = logging.getLogger(__name__)
_analyze_deps = [] if settings.hosted_mode else [Depends(require_api_key)]
router = APIRouter(prefix="/analyze", tags=["analyze"], dependencies=_analyze_deps)

limiter = Limiter(key_func=get_real_ip)


_analyze_rate = settings.hosted_rate_limit if settings.hosted_mode else settings.rate_limit


def _safe_detail(public_msg: str, exc: Exception) -> str:
    """Return a clean message in hosted mode, raw detail in self-hosted."""
    return public_msg if settings.hosted_mode else f"{public_msg}: {exc}"


@router.post("", response_model=AnalysisResult)
@limiter.limit(_analyze_rate)
def analyze_query(
    request: Request,
    body: AnalyzeRequest,
    db: Session = Depends(get_db),
):
    # Basic length guard
    if len(body.sql) > settings.max_query_length:
        raise HTTPException(
            status_code=400,
            detail=f"Query exceeds maximum allowed length of {settings.max_query_length} characters.",
        )

    query_id = str(uuid.uuid4())

    # ── Live DB introspection (optional) ─────────────────────────────────────
    conn_record = None
    introspection: QueryIntrospectionResult | None = None

    if body.connection_id:
        manager = ConnectionManager(db)
        conn_record = manager.get(body.connection_id)
        if not conn_record:
            raise HTTPException(status_code=404, detail="Connection not found")

        try:
            connector = manager.open_connector(body.connection_id)
            try:
                introspector = QueryIntrospector(connector)
                introspection = introspector.introspect(body.sql)
                introspection.db_type = conn_record.db_type
            finally:
                connector.close()
        except Exception as exc:
            logger.warning("DB introspection failed: %s — proceeding without live data", exc)

    # ── Client-provided introspection (Playground mode) ─────────────────────
    if introspection is None and body.client_explain is not None:
        from connectors.base import ColumnStat, ExplainResult, IndexInfo, TableSchema

        explain = ExplainResult(
            raw_plan=body.client_explain.raw_plan,
            planning_time_ms=body.client_explain.planning_time_ms,
            execution_time_ms=body.client_explain.execution_time_ms,
        )

        table_schemas = []
        for ts in (body.client_table_schemas or []):
            indexes = [
                IndexInfo(
                    index_name=idx.get("index_name", ""),
                    table_name=idx.get("table_name", ts.table_name),
                    columns=idx.get("columns", []),
                    is_unique=idx.get("is_unique", False),
                    index_type=idx.get("index_type", "btree"),
                    definition=idx.get("definition", ""),
                )
                for idx in ts.indexes
            ]
            col_stats = [
                ColumnStat(
                    column_name=cs.get("column_name", ""),
                    null_frac=cs.get("null_frac", 0.0),
                    avg_width=cs.get("avg_width", 0),
                    n_distinct=cs.get("n_distinct", 0.0),
                )
                for cs in ts.column_stats
            ]
            table_schemas.append(TableSchema(
                table_name=ts.table_name,
                columns=ts.columns,
                row_count=ts.row_count,
                indexes=indexes,
                column_stats=col_stats,
            ))

        introspection = QueryIntrospectionResult(
            sql=body.sql,
            explain=explain,
            table_schemas=table_schemas,
            table_names=[ts.table_name for ts in table_schemas],
            db_type=body.client_db_type or "postgresql",
        )

    # Build a minimal introspection object when no live DB is available
    if introspection is None:
        from services.query_introspector import extract_table_names

        introspection = QueryIntrospectionResult(
            sql=body.sql,
            explain=None,
            table_schemas=[],
            table_names=extract_table_names(body.sql),
            db_type=conn_record.db_type if conn_record else None,
        )

    # ── Resolve LLM provider ────────────────────────────────────────────────
    provider_override = None
    if settings.hosted_mode:
        # Hosted: always use env-configured provider/model — ignore user overrides
        pass
    else:
        # Self-hosted: DB config takes priority over .env
        active_config = db.query(LLMConfig).filter(LLMConfig.is_active.is_(True)).first()
        if active_config:
            try:
                api_key = decrypt(active_config.encrypted_api_key)
                provider_override = get_provider(
                    provider_name=active_config.provider,
                    api_key=api_key,
                    model=body.model,  # model chosen at analysis time
                )
            except Exception as exc:
                logger.warning("Failed to load active LLM config %s: %s — falling back to .env", active_config.id, exc)

    # ── LLM Analysis ─────────────────────────────────────────────────────────
    try:
        analyzer = LLMAnalyzer()
        result = analyzer.analyze(introspection, query_id=query_id, provider_override=provider_override)
    except Exception as exc:
        logger.exception("LLM analysis failed: %s", exc)
        raise HTTPException(status_code=502, detail=_safe_detail("Analysis failed. Please try again", exc))

    # ── Attach EXPLAIN error if query execution failed ──────────────────────
    if introspection.explain_error:
        result.explain_error = introspection.explain_error

    # ── Persist ────────────────────────────────────────────────────────────────
    if settings.hosted_mode:
        # Hosted: store only suggestion counts — no query content
        try:
            log = AnalyticsLog(
                index_count=len(result.indexes),
                rewrite_count=len(result.rewrites),
                materialized_view_count=len(result.materialized_views),
                bottleneck_count=len(result.bottlenecks),
                statistics_count=len(result.statistics),
                configuration_count=len(result.configuration),
            )
            db.add(log)
            db.commit()
        except Exception as exc:
            logger.warning("Failed to persist analytics log: %s", exc)
    else:
        # Self-hosted: write to user-visible query history
        try:
            history = QueryHistory(
                id=query_id,
                connection_id=body.connection_id,
                sql_query=body.sql,
                explain_plan=introspection.explain.raw_plan if introspection.explain else None,
                llm_response=result.model_dump_json(),
            )
            db.add(history)
            db.commit()
        except Exception as exc:
            logger.warning("Failed to persist query history: %s", exc)

    return result


@router.get("/history", response_model=list[QueryHistoryItem])
def get_history(
    limit: int = 50,
    db: Session = Depends(get_db),
):
    if settings.hosted_mode:
        return []
    rows = (
        db.query(QueryHistory)
        .order_by(QueryHistory.created_at.desc())
        .limit(limit)
        .all()
    )
    return rows


@router.get("/stats", response_model=DashboardStats)
def get_stats(db: Session = Depends(get_db)):
    if settings.hosted_mode:
        return DashboardStats(
            total_queries=0,
            total_suggestions=0,
            high_impact_count=0,
            streak_days=0,
            top_categories=[],
            most_analyzed_tables=[],
            queries_by_date=[],
            recent_analyses=[],
        )
    """Dashboard statistics: totals, per-day counts, and recent analyses."""
    from datetime import datetime, timedelta
    from sqlalchemy import func

    # Total queries
    total_queries = db.query(func.count(QueryHistory.id)).scalar() or 0

    # Queries by date (last 30 days)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    date_rows = (
        db.query(
            func.date(QueryHistory.created_at).label("date"),
            func.count(QueryHistory.id).label("count"),
        )
        .filter(QueryHistory.created_at >= thirty_days_ago)
        .group_by(func.date(QueryHistory.created_at))
        .order_by(func.date(QueryHistory.created_at))
        .all()
    )
    queries_by_date = [QueryByDate(date=str(row.date), count=row.count) for row in date_rows]

    # Recent analyses (last 5) + aggregated stats from last 200
    recent_rows = (
        db.query(QueryHistory)
        .order_by(QueryHistory.created_at.desc())
        .limit(200)
        .all()
    )

    total_suggestions = 0
    high_impact_count = 0
    category_counts: dict[str, int] = {}
    table_freq: dict[str, int] = {}
    analysis_dates: set[str] = set()
    recent_analyses: list[RecentAnalysis] = []

    suggestion_keys = ("indexes", "rewrites", "materialized_views", "bottlenecks", "statistics")

    for i, row in enumerate(recent_rows):
        suggestion_count = 0
        if row.llm_response:
            try:
                data = json.loads(row.llm_response)
                for key in suggestion_keys:
                    items = data.get(key, [])
                    count = len(items)
                    suggestion_count += count
                    category_counts[key] = category_counts.get(key, 0) + count
                    for item in items:
                        if isinstance(item, dict) and item.get("estimated_impact") == "high":
                            high_impact_count += 1
                # configuration is separate (ConfigurationItem)
                config_items = data.get("configuration", [])
                config_count = len(config_items)
                suggestion_count += config_count
                category_counts["configuration"] = category_counts.get("configuration", 0) + config_count
                for item in config_items:
                    if isinstance(item, dict) and item.get("estimated_impact") == "high":
                        high_impact_count += 1
                # Track tables
                for t in data.get("tables_analyzed", []):
                    table_freq[t] = table_freq.get(t, 0) + 1
            except (json.JSONDecodeError, TypeError):
                pass
        total_suggestions += suggestion_count

        # Track analysis dates for streak
        if row.created_at:
            analysis_dates.add(row.created_at.strftime("%Y-%m-%d"))

        if i < 5:
            recent_analyses.append(
                RecentAnalysis(
                    id=row.id,
                    sql_query=row.sql_query,
                    suggestion_count=suggestion_count,
                    created_at=row.created_at,
                    llm_response=row.llm_response,
                )
            )

    # Compute streak (consecutive days from today backwards)
    streak_days = 0
    if analysis_dates:
        today = datetime.utcnow().date()
        d = today
        while d.strftime("%Y-%m-%d") in analysis_dates:
            streak_days += 1
            d -= timedelta(days=1)

    # Top categories sorted by count
    top_categories = sorted(
        [CategoryCount(category=k, count=v) for k, v in category_counts.items()],
        key=lambda x: x.count,
        reverse=True,
    )

    # Most analyzed tables (top 5)
    most_analyzed_tables = sorted(
        [TableCount(table_name=k, count=v) for k, v in table_freq.items()],
        key=lambda x: x.count,
        reverse=True,
    )[:5]

    return DashboardStats(
        total_queries=total_queries,
        total_suggestions=total_suggestions,
        high_impact_count=high_impact_count,
        streak_days=streak_days,
        top_categories=top_categories,
        most_analyzed_tables=most_analyzed_tables,
        queries_by_date=queries_by_date,
        recent_analyses=recent_analyses,
    )


@router.post("/compare", response_model=CompareResult)
@limiter.limit(_analyze_rate)
def compare_rewrites(
    request: Request,
    body: CompareRequest,
    db: Session = Depends(get_db),
):
    """Compare original and rewritten SQL by executing both and diffing results."""
    manager = ConnectionManager(db)
    conn_record = manager.get(body.connection_id)
    if not conn_record:
        raise HTTPException(status_code=404, detail="Connection not found")

    try:
        connector = manager.open_connector(body.connection_id)
        try:
            result = compare_queries(
                connector=connector,
                original_sql=body.original_sql,
                rewritten_sql=body.rewritten_sql,
                row_limit=body.row_limit,
            )
        finally:
            connector.close()
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Query comparison failed: %s", exc)
        raise HTTPException(status_code=502, detail=_safe_detail("Query comparison failed. Please check your SQL and retry", exc))

    return result


@router.post("/simulate-index", response_model=SimulateIndexResult)
@limiter.limit(_analyze_rate)
def simulate_index(
    request: Request,
    body: SimulateIndexRequest,
    db: Session = Depends(get_db),
):
    """Simulate an index using PostgreSQL's HypoPG extension.

    Creates a hypothetical (virtual) index, re-runs EXPLAIN to show
    the planner's cost estimate with the index, then cleans up.
    No real index is created — this only affects the planner within the session.
    """
    from services.index_simulator import IndexSimulator

    manager = ConnectionManager(db)
    conn_record = manager.get(body.connection_id)
    if not conn_record:
        raise HTTPException(status_code=404, detail="Connection not found")
    if conn_record.db_type != "postgresql":
        raise HTTPException(
            status_code=400,
            detail="Index simulation is only available for PostgreSQL connections",
        )

    raw_conn = None
    try:
        raw_conn = manager.open_raw_pg_connection(body.connection_id)
        simulator = IndexSimulator(raw_conn)
        result = simulator.simulate(
            index_sql=body.index_sql,
            query_sql=body.query_sql,
            timeout_ms=settings.explain_timeout_ms,
        )
        return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Index simulation failed: %s", exc)
        raise HTTPException(status_code=502, detail=_safe_detail("Index simulation failed. Please try again", exc))
    finally:
        if raw_conn:
            try:
                raw_conn.close()
            except Exception:
                pass

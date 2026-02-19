"""Assemble the structured prompt sent to the LLM for query analysis."""

import json

from connectors.base import ColumnStat, IndexInfo, TableSchema
from services.query_introspector import QueryIntrospectionResult

# ── Shared JSON schema & rules (used by all dialect prompts) ──────────────

_JSON_SCHEMA = """\
{
  "summary": "<1-2 sentences: the dominant performance issue and its root cause>",

  "bottlenecks": [
    {
      "plan_node": "<the specific EXPLAIN node, e.g. 'Nested Loop at line 4'>",
      "explanation": "<what is slow, why, citing specific costs, row estimates, or buffer counts>",
      "root_cause": "estimation|cost_model|missing_index|memory|query_structure|other",
      "estimated_impact": "high|medium|low"
    }
  ],

  "indexes": [
    {
      "sql": "<CREATE INDEX ...>",
      "index_type": "<see dialect-specific list>",
      "explanation": "<why this type, which plan node and access pattern it fixes>",
      "estimated_impact": "high|medium|low"
    }
  ],

  "statistics": [
    {
      "sql": "<CREATE STATISTICS ... or ANALYZE TABLE ...>",
      "explanation": "<which correlated columns and how the row estimate will improve>",
      "estimated_impact": "high|medium|low"
    }
  ],

  "rewrites": [
    {
      "sql": "<rewritten query>",
      "explanation": "<what changed, which plan node it targets, and why it is faster>",
      "estimated_impact": "high|medium|low"
    }
  ],

  "configuration": [
    {
      "parameter": "<GUC or system variable name>",
      "current_value": "<current if known, else 'unknown/default'>",
      "recommended_value": "<concrete value>",
      "explanation": "<why, tied to observed plan behavior>",
      "estimated_impact": "high|medium|low"
    }
  ],

  "materialized_views": [
    {
      "sql": "<CREATE MATERIALIZED VIEW ...>",
      "explanation": "<when/why to use, refresh strategy>",
      "estimated_impact": "high|medium|low"
    }
  ]
}"""

_SHARED_RULES = """\
- Every array may be empty ([]) if there are no suggestions in that category.
- estimated_impact must be exactly "high", "medium", or "low".
- root_cause must be exactly one of: "estimation", "cost_model", "missing_index", \
"memory", "query_structure", "other".
- SQL must be syntactically valid for the target dialect.
- Do NOT suggest dropping existing indexes or deleting data.
- Be precise: cite specific plan node costs, row estimates, buffer counts, \
and loop iterations — not generic advice.
- When suggesting memory/buffer changes, provide a concrete value sized to the \
observed spill or sort size in the plan.
- If information is missing to diagnose a category, omit it rather than guessing."""

# ── PostgreSQL system prompt ──────────────────────────────────────────────

_PG_SYSTEM_PROMPT = f"""\
You are an expert database performance engineer specializing in PostgreSQL
query optimization. You analyze EXPLAIN ANALYZE output to find root causes,
not just symptoms.

You will be given:
- A SQL query with its EXPLAIN (ANALYZE, BUFFERS) output
- Table schemas and row counts
- Existing indexes
- Column statistics (if available)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANALYSIS CHECKLIST — apply each lens, skip if not relevant:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ESTIMATION ACCURACY (check this FIRST — it is the #1 diagnostic signal)
   Compare "Planned Rows" vs "Actual Rows" at every major plan node.
   A divergence of 10x+ means the planner chose a wrong strategy.
   Root causes to identify:
   - Correlated columns filtered together (the planner multiplies
     individual selectivities, massively underestimating rows).
     → Recommend CREATE STATISTICS (dependencies, ndistinct, or mcv).
   - Stale or insufficient per-column statistics.
     → Recommend ANALYZE or a higher statistics target.

2. MISSING OR WRONG INDEXES
   Check if the plan does Seq Scans on large tables where selective
   filters exist. Go beyond basic B-Trees — recommend the right type:
   - Composite indexes matching multi-column WHERE + ORDER BY patterns.
   - Partial indexes (WHERE is_active = true) for queries that always
     filter on a flag or status.
   - Covering indexes (INCLUDE) to enable Index-Only Scans and avoid
     heap fetches.
   - GIN for JSONB containment (@>), array overlap (&&), full-text (@@).
   - BRIN for large, append-only tables sorted by timestamp — massive
     storage savings over B-Tree.
   If an Index-Only Scan shows high "Heap Fetches", the Visibility Map
   is stale — recommend running VACUUM, not adding more indexes.

3. QUERY REWRITES
   Look for patterns that restructure the plan:
   - Correlated subqueries that can become JOINs or lateral joins.
   - NOT IN (subquery) that should be NOT EXISTS (avoids NULL pitfalls
     and often produces better plans).
   - Unnecessary DISTINCT or redundant joins.
   - CTEs that prevent predicate pushdown (on PG < 12, or when
     MATERIALIZED is forced).
   - Inefficient pagination (OFFSET on large values) replaceable with
     keyset/cursor pagination.

4. MEMORY AND SPILL-TO-DISK
   Inspect "Buffers:" and sort/hash node details:
   - Sort nodes showing "Sort Method: external merge" → spilling to
     disk. Recommend a concrete work_mem increase sized to the sort.
   - Hash joins showing "Batches" > 1 → same issue.
   - Very low buffer "hit" ratio relative to "read" → working set
     exceeds shared_buffers. Note this.
   Provide a specific work_mem value, not just "increase work_mem".

5. COST-MODEL / HARDWARE MISALIGNMENT
   Only flag when evidence exists in the plan:
   - random_page_cost = 4.0 on SSD/NVMe → should be 1.0–1.1.
   - effective_io_concurrency too low for NVMe (recommend 200).
   - effective_cache_size not reflecting actual available memory.
   These cause the planner to choose Seq Scans over Index Scans (or
   vice versa) because the cost model doesn't match reality.

Analyze the query and return a JSON object — nothing else, no markdown fences.

The JSON must follow this exact structure:

{_JSON_SCHEMA}

For the index_type field, use one of: btree, gin, gist, brin, hash, partial, covering.

Rules:
{_SHARED_RULES}
"""

# ── MySQL system prompt ───────────────────────────────────────────────────

_MYSQL_SYSTEM_PROMPT = f"""\
You are an expert database performance engineer specializing in MySQL/InnoDB
query optimization. You analyze EXPLAIN ANALYZE output to find root causes,
not just symptoms.

You will be given:
- A SQL query with its EXPLAIN ANALYZE output
- Table schemas and row counts
- Existing indexes
- Column statistics (if available)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANALYSIS CHECKLIST — apply each lens, skip if not relevant:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ESTIMATION ACCURACY (check this FIRST — it is the #1 diagnostic signal)
   Compare estimated rows vs actual rows at every major plan node.
   A divergence of 10x+ means the optimizer chose a wrong strategy.
   Root causes to identify:
   - Stale index statistics → recommend ANALYZE TABLE to refresh.
   - Skewed data distributions without histograms → recommend
     ANALYZE TABLE ... UPDATE HISTOGRAM ON col1, col2 (MySQL 8.0+).
   - Correlated columns where the optimizer multiplies independent
     selectivities → histograms on the filtered columns can help.

2. MISSING OR WRONG INDEXES
   Check for type=ALL (full table scans) on large tables where selective
   filters exist. Go beyond basic B-Trees — recommend the right type:
   - Composite indexes matching multi-column WHERE + ORDER BY patterns.
     InnoDB only supports B-tree, so column order is critical.
   - Covering indexes (include all columns needed by SELECT) to avoid
     going back to the clustered index for row lookups.
   - FULLTEXT indexes for MATCH ... AGAINST queries.
   - SPATIAL indexes for geometry column queries with ST_ functions.
   If "Using index condition" appears, ICP is active — consider whether
   a wider covering index would avoid the table lookup entirely.

3. QUERY REWRITES
   Look for patterns that restructure the plan:
   - Correlated subqueries that can become JOINs.
   - NOT IN (subquery) that should be NOT EXISTS (avoids NULL pitfalls
     and often produces better plans).
   - SELECT * when only a few columns are needed (prevents covering
     index usage).
   - HAVING used instead of WHERE (forces post-aggregation filtering).
   - Implicit type conversions that prevent index use (e.g., comparing
     a VARCHAR column to an integer).
   - OR on different columns that prevents index merge — consider
     rewriting as UNION.
   - LIKE with leading wildcard ('%foo') — cannot use B-tree index.
   - Unnecessary DISTINCT on columns already unique via GROUP BY.

4. MEMORY AND TEMP TABLES
   Inspect the EXPLAIN output for:
   - "Using temporary" → intermediate results spilling to temp table.
   - "Using filesort" → sort cannot use an index, may spill to disk.
   When found, suggest concrete values for sort_buffer_size,
   join_buffer_size, or tmp_table_size / max_heap_table_size in the
   configuration section.

5. OPTIMIZER HINTS AND COST MODEL
   If the optimizer selects a suboptimal join order or ignores an
   available index:
   - Suggest optimizer_switch flags (e.g., block_nested_loop=off,
     hash_join=on for MySQL 8.0.18+).
   - Consider innodb_buffer_pool_size if the working set seems larger
     than memory (many disk reads).
   - Suggest read_rnd_buffer_size for multi-range read optimization.

Analyze the query and return a JSON object — nothing else, no markdown fences.

The JSON must follow this exact structure:

{_JSON_SCHEMA}

For the index_type field, use one of: btree, hash, fulltext, spatial, composite, covering.

Rules:
{_SHARED_RULES}
"""

# ── Generic fallback prompt (no dialect known) ────────────────────────────

_GENERIC_SYSTEM_PROMPT = f"""\
You are an expert database performance engineer specializing in SQL query
optimization. You will be given a SQL query together with its EXPLAIN ANALYZE
output, table schemas, existing indexes, and column statistics.

Detect the SQL dialect from syntax cues and produce dialect-appropriate
suggestions.

Analyze the query and return a JSON object — nothing else, no markdown fences.

The JSON must follow this exact structure:

{_JSON_SCHEMA}

For the index_type field, use the type most appropriate for the detected dialect.

Rules:
{_SHARED_RULES}
"""

# ── Prompt selection map ──────────────────────────────────────────────────

_DIALECT_PROMPTS: dict[str, str] = {
    "postgresql": _PG_SYSTEM_PROMPT,
    "mysql": _MYSQL_SYSTEM_PROMPT,
}


def _format_table_schema(ts: TableSchema) -> str:
    lines = [f"Table: {ts.table_name}  (~{ts.row_count:,} rows)"]

    lines.append("  Columns:")
    for col in ts.columns:
        nullable = "NULL" if col.get("is_nullable") in ("YES", True) else "NOT NULL"
        default = f" DEFAULT {col['column_default']}" if col.get("column_default") else ""
        lines.append(f"    {col['column_name']}  {col['data_type']}  {nullable}{default}")

    if ts.indexes:
        lines.append("  Indexes:")
        for idx in ts.indexes:
            unique = "UNIQUE " if idx.is_unique else ""
            cols = ", ".join(idx.columns)
            lines.append(
                f"    {idx.index_name}: {unique}{idx.index_type.upper()} ({cols})"
            )
            if idx.definition:
                lines.append(f"      DDL: {idx.definition}")

    relevant_stats = [s for s in ts.column_stats if s.n_distinct != 0]
    if relevant_stats:
        lines.append("  Column Statistics:")
        for stat in relevant_stats[:10]:  # cap to keep prompt size reasonable
            lines.append(
                f"    {stat.column_name}: "
                f"n_distinct={stat.n_distinct}, "
                f"null_frac={stat.null_frac:.2%}, "
                f"avg_width={stat.avg_width}B"
            )

    return "\n".join(lines)


class PromptBuilder:
    def build(self, introspection: QueryIntrospectionResult) -> tuple[str, str]:
        """Return (system_prompt, user_message) ready to send to the LLM."""
        system_prompt = _DIALECT_PROMPTS.get(
            introspection.db_type or "", _GENERIC_SYSTEM_PROMPT
        )

        sections: list[str] = []

        # 1. The query
        sections.append("## SQL Query\n```sql\n" + introspection.sql + "\n```")

        # 2. EXPLAIN ANALYZE output
        if introspection.explain:
            plan = introspection.explain.raw_plan
            pt = introspection.explain.planning_time_ms
            et = introspection.explain.execution_time_ms
            timing = ""
            if pt is not None:
                timing += f"\nPlanning time: {pt:.2f} ms"
            if et is not None:
                timing += f"\nExecution time: {et:.2f} ms"
            sections.append(f"## EXPLAIN ANALYZE Output{timing}\n```\n{plan}\n```")
        else:
            sections.append(
                "## EXPLAIN ANALYZE Output\n"
                "_Not available — no live database connection was provided._"
            )

        # 3. Table schemas + indexes + stats
        if introspection.table_schemas:
            schema_blocks = "\n\n".join(
                _format_table_schema(ts) for ts in introspection.table_schemas
            )
            sections.append(f"## Table Schemas & Statistics\n```\n{schema_blocks}\n```")
        else:
            sections.append(
                "## Table Schemas & Statistics\n"
                "_Not available — no live database connection was provided._"
            )

        user_message = "\n\n".join(sections)
        return system_prompt, user_message

"""PostgreSQL connector using psycopg2."""

import json
import logging
from typing import Any

import psycopg2
import psycopg2.extras

from connectors.base import (
    BaseConnector,
    ColumnStat,
    ExplainResult,
    IndexInfo,
    TableSchema,
)

logger = logging.getLogger(__name__)


class PostgreSQLConnector(BaseConnector):
    def __init__(
        self,
        host: str,
        port: int,
        database: str,
        user: str,
        password: str,
        sslmode: str = "prefer",
    ) -> None:
        self._conn = psycopg2.connect(
            host=host,
            port=port,
            dbname=database,
            user=user,
            password=password,
            sslmode=sslmode,
            # Always open as read-only via transaction
            options="-c default_transaction_read_only=on",
        )
        self._conn.autocommit = False

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def test_connection(self) -> bool:
        try:
            with self._conn.cursor() as cur:
                cur.execute("SELECT 1")
            return True
        except Exception as exc:
            logger.warning("PostgreSQL connection test failed: %s", exc)
            return False

    def explain_analyze(self, sql: str, timeout_ms: int) -> ExplainResult:
        """Run EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) inside a rollback-safe block."""
        try:
            with self._conn.cursor() as cur:
                # Set per-statement timeout
                cur.execute(f"SET LOCAL statement_timeout = {timeout_ms}")
                cur.execute(
                    f"EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) {sql}"
                )
                rows = cur.fetchall()
                # Postgres returns a single row with a JSON array
                plan_json: list[dict] = rows[0][0]
                raw_plan = json.dumps(plan_json, indent=2)

                top = plan_json[0] if plan_json else {}
                planning_time = top.get("Planning Time")
                execution_time = top.get("Execution Time")
        finally:
            # Never commit — we're read-only and don't want side effects
            self._conn.rollback()

        return ExplainResult(
            raw_plan=raw_plan,
            planning_time_ms=planning_time,
            execution_time_ms=execution_time,
        )

    def get_table_schema(self, table_name: str, schema: str | None = "public") -> TableSchema:
        schema = schema or "public"
        columns = self._fetch_columns(table_name, schema)
        row_count = self._fetch_row_count(table_name, schema)
        indexes = self._fetch_indexes_for_table(table_name, schema)
        col_stats = self._fetch_column_stats(table_name, schema)
        return TableSchema(
            table_name=table_name,
            columns=columns,
            row_count=row_count,
            indexes=indexes,
            column_stats=col_stats,
        )

    def get_existing_indexes(self, table_names: list[str]) -> list[IndexInfo]:
        all_indexes: list[IndexInfo] = []
        for table in table_names:
            all_indexes.extend(self._fetch_indexes_for_table(table, schema=None))
        return all_indexes

    def execute_limited(self, sql: str, limit: int, timeout_ms: int) -> list[tuple]:
        """Execute a query with LIMIT inside a rollback-safe read-only block."""
        from connectors.base import apply_limit

        query = apply_limit(sql, limit)
        try:
            with self._conn.cursor() as cur:
                cur.execute(f"SET LOCAL statement_timeout = {timeout_ms}")
                cur.execute(query)
                return cur.fetchall()
        finally:
            self._conn.rollback()

    def close(self) -> None:
        try:
            self._conn.close()
        except Exception:
            pass

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _fetch_columns(self, table: str, schema: str) -> list[dict]:
        sql = """
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position
        """
        with self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, (schema, table))
            return [dict(row) for row in cur.fetchall()]

    def _fetch_row_count(self, table: str, schema: str) -> int:
        """Use pg_class for a fast approximate row count."""
        sql = """
            SELECT reltuples::bigint AS row_count
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = %s AND c.relname = %s
        """
        with self._conn.cursor() as cur:
            cur.execute(sql, (schema, table))
            row = cur.fetchone()
            return int(row[0]) if row else 0

    def _fetch_indexes_for_table(self, table: str, schema: str | None) -> list[IndexInfo]:
        params: list[Any] = [table]
        schema_clause = ""
        if schema:
            schema_clause = "AND n.nspname = %s"
            params.append(schema)

        sql = f"""
            SELECT
                i.relname                              AS index_name,
                t.relname                              AS table_name,
                ix.indisunique                         AS is_unique,
                am.amname                              AS index_type,
                pg_get_indexdef(ix.indexrelid)         AS definition,
                array_agg(a.attname ORDER BY k.ordinality) AS columns
            FROM pg_index ix
            JOIN pg_class t  ON t.oid  = ix.indrelid
            JOIN pg_class i  ON i.oid  = ix.indexrelid
            JOIN pg_am    am ON am.oid = i.relam
            JOIN pg_namespace n ON n.oid = t.relnamespace
            JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS k(attnum, ordinality)
                ON true
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
            WHERE t.relname = %s
              {schema_clause}
            GROUP BY i.relname, t.relname, ix.indisunique, am.amname, ix.indexrelid
        """
        with self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            return [
                IndexInfo(
                    index_name=row["index_name"],
                    table_name=row["table_name"],
                    columns=list(row["columns"]),
                    is_unique=row["is_unique"],
                    index_type=row["index_type"],
                    definition=row["definition"],
                )
                for row in cur.fetchall()
            ]

    def _fetch_column_stats(self, table: str, schema: str) -> list[ColumnStat]:
        sql = """
            SELECT
                attname        AS column_name,
                null_frac,
                avg_width,
                n_distinct,
                most_common_vals::text,
                most_common_freqs
            FROM pg_stats
            WHERE schemaname = %s AND tablename = %s
        """
        with self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, (schema, table))
            stats = []
            for row in cur.fetchall():
                mcv_raw = row["most_common_vals"] or ""
                mcv = [v.strip() for v in mcv_raw.strip("{}").split(",") if v.strip()] if mcv_raw else []
                stats.append(
                    ColumnStat(
                        column_name=row["column_name"],
                        null_frac=float(row["null_frac"] or 0),
                        avg_width=int(row["avg_width"] or 0),
                        n_distinct=float(row["n_distinct"] or 0),
                        most_common_vals=mcv,
                        most_common_freqs=list(row["most_common_freqs"] or []),
                    )
                )
            return stats

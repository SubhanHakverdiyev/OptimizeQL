"""MySQL connector using mysql-connector-python."""

import logging

import mysql.connector
import mysql.connector.cursor

from connectors.base import (
    BaseConnector,
    ColumnStat,
    ExplainResult,
    IndexInfo,
    TableSchema,
)

logger = logging.getLogger(__name__)


class MySQLConnector(BaseConnector):
    def __init__(
        self,
        host: str,
        port: int,
        database: str,
        user: str,
        password: str,
        ssl_ca: str | None = None,
    ) -> None:
        kwargs: dict = dict(
            host=host,
            port=port,
            database=database,
            user=user,
            password=password,
            autocommit=False,
        )
        if ssl_ca:
            kwargs["ssl_ca"] = ssl_ca

        self._conn = mysql.connector.connect(**kwargs)
        # Make the session read-only at the transaction level
        cur = self._conn.cursor()
        cur.execute("SET SESSION TRANSACTION READ ONLY")
        cur.close()

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def test_connection(self) -> bool:
        try:
            cur = self._conn.cursor()
            cur.execute("SELECT 1")
            cur.fetchall()
            cur.close()
            return True
        except Exception as exc:
            logger.warning("MySQL connection test failed: %s", exc)
            return False

    def explain_analyze(self, sql: str, timeout_ms: int) -> ExplainResult:
        """Use EXPLAIN ANALYZE (MySQL 8.0.18+) with a max_execution_time hint."""
        timeout_sec = max(1, timeout_ms // 1000)
        # Inject MAX_EXECUTION_TIME hint
        hinted_sql = f"SELECT /*+ MAX_EXECUTION_TIME({timeout_ms}) */ 1"  # dummy
        analyze_sql = f"EXPLAIN ANALYZE {sql}"
        raw_lines: list[str] = []
        try:
            cur = self._conn.cursor()
            cur.execute(f"SET SESSION MAX_EXECUTION_TIME={timeout_ms}")
            cur.execute(analyze_sql)
            rows = cur.fetchall()
            raw_lines = [str(r[0]) for r in rows]
            cur.close()
        finally:
            self._conn.rollback()

        raw_plan = "\n".join(raw_lines)
        return ExplainResult(
            raw_plan=raw_plan,
            planning_time_ms=None,   # MySQL doesn't expose planning time separately
            execution_time_ms=None,  # Embedded in the tree output
        )

    def get_table_schema(self, table_name: str, schema: str | None = None) -> TableSchema:
        db = schema or self._conn.database
        columns = self._fetch_columns(table_name, db)
        row_count = self._fetch_row_count(table_name, db)
        indexes = self._fetch_indexes_for_table(table_name, db)
        col_stats = self._fetch_column_stats(table_name, db)
        return TableSchema(
            table_name=table_name,
            columns=columns,
            row_count=row_count,
            indexes=indexes,
            column_stats=col_stats,
        )

    def get_existing_indexes(self, table_names: list[str]) -> list[IndexInfo]:
        all_indexes: list[IndexInfo] = []
        db = self._conn.database
        for table in table_names:
            all_indexes.extend(self._fetch_indexes_for_table(table, db))
        return all_indexes

    def close(self) -> None:
        try:
            self._conn.close()
        except Exception:
            pass

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _fetch_columns(self, table: str, db: str) -> list[dict]:
        sql = """
            SELECT COLUMN_NAME AS column_name,
                   COLUMN_TYPE AS data_type,
                   IS_NULLABLE AS is_nullable,
                   COLUMN_DEFAULT AS column_default
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
            ORDER BY ORDINAL_POSITION
        """
        cur = self._conn.cursor(dictionary=True)
        cur.execute(sql, (db, table))
        rows = cur.fetchall()
        cur.close()
        return [dict(r) for r in rows]

    def _fetch_row_count(self, table: str, db: str) -> int:
        sql = """
            SELECT TABLE_ROWS
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
        """
        cur = self._conn.cursor()
        cur.execute(sql, (db, table))
        row = cur.fetchone()
        cur.close()
        return int(row[0]) if row and row[0] is not None else 0

    def _fetch_indexes_for_table(self, table: str, db: str) -> list[IndexInfo]:
        sql = "SHOW INDEX FROM `{db}`.`{table}`".format(db=db, table=table)
        cur = self._conn.cursor(dictionary=True)
        cur.execute(sql)
        rows = cur.fetchall()
        cur.close()

        # Group by index name
        index_map: dict[str, dict] = {}
        for row in rows:
            name = row["Key_name"]
            if name not in index_map:
                index_map[name] = {
                    "index_name": name,
                    "table_name": table,
                    "is_unique": not row["Non_unique"],
                    "index_type": row["Index_type"].lower(),
                    "columns": [],
                    "definition": "",
                }
            index_map[name]["columns"].append(row["Column_name"])

        return [
            IndexInfo(
                index_name=v["index_name"],
                table_name=v["table_name"],
                columns=v["columns"],
                is_unique=v["is_unique"],
                index_type=v["index_type"],
                definition=v["definition"],
            )
            for v in index_map.values()
        ]

    def _fetch_column_stats(self, table: str, db: str) -> list[ColumnStat]:
        """MySQL doesn't expose pg_stats equivalents easily; return basic histogram info."""
        sql = """
            SELECT COLUMN_NAME, HISTOGRAM
            FROM information_schema.COLUMN_STATISTICS
            WHERE SCHEMA_NAME = %s AND TABLE_NAME = %s
        """
        stats: list[ColumnStat] = []
        try:
            cur = self._conn.cursor(dictionary=True)
            cur.execute(sql, (db, table))
            rows = cur.fetchall()
            cur.close()
            for row in rows:
                stats.append(
                    ColumnStat(
                        column_name=row["COLUMN_NAME"],
                        null_frac=0.0,
                        avg_width=0,
                        n_distinct=-1.0,
                        most_common_vals=[],
                        most_common_freqs=[],
                    )
                )
        except Exception:
            # COLUMN_STATISTICS requires MySQL 8+; silently skip on older versions
            pass
        return stats

"""Extract table names from SQL and gather schema + explain info from the database."""

import logging
import re

import sqlglot
import sqlglot.expressions as exp

from connectors.base import BaseConnector, ExplainResult, TableSchema
from core.config import settings

logger = logging.getLogger(__name__)


def extract_table_names(sql: str) -> list[str]:
    """Parse the SQL and return all referenced table names (lowercase, deduplicated).

    Falls back to a simple regex scan if sqlglot cannot parse the dialect.
    """
    try:
        tree = sqlglot.parse_one(sql, error_level=sqlglot.ErrorLevel.WARN)
        tables = {
            node.name.lower()
            for node in tree.find_all(exp.Table)
            if node.name
        }
        if tables:
            return sorted(tables)
    except Exception as exc:
        logger.debug("sqlglot parsing failed (%s), falling back to regex", exc)

    # Regex fallback: match FROM/JOIN <identifier>
    pattern = re.compile(
        r"(?:FROM|JOIN)\s+([`\"]?[\w]+[`\"]?(?:\.[`\"]?[\w]+[`\"]?)?)",
        re.IGNORECASE,
    )
    tables = set()
    for match in pattern.finditer(sql):
        raw = match.group(1).strip("`\"")
        # Strip schema prefix if present (schema.table → table)
        table = raw.split(".")[-1].lower()
        tables.add(table)
    return sorted(tables)


class QueryIntrospectionResult:
    """All context gathered about a query before calling the LLM."""

    def __init__(
        self,
        sql: str,
        explain: ExplainResult | None,
        table_schemas: list[TableSchema],
        table_names: list[str],
        db_type: str | None = None,
    ) -> None:
        self.sql = sql
        self.explain = explain
        self.table_schemas = table_schemas
        self.table_names = table_names
        self.db_type = db_type


class QueryIntrospector:
    """Orchestrates EXPLAIN ANALYZE + schema collection for a query."""

    def __init__(self, connector: BaseConnector) -> None:
        self._connector = connector

    def introspect(self, sql: str) -> QueryIntrospectionResult:
        table_names = extract_table_names(sql)
        logger.info("Detected tables: %s", table_names)

        # 1. Run EXPLAIN ANALYZE
        explain: ExplainResult | None = None
        try:
            explain = self._connector.explain_analyze(sql, settings.explain_timeout_ms)
        except Exception as exc:
            logger.warning("EXPLAIN ANALYZE failed: %s", exc)

        # 2. Fetch schema + stats for each referenced table
        table_schemas: list[TableSchema] = []
        for table in table_names:
            try:
                schema = self._connector.get_table_schema(table)
                table_schemas.append(schema)
            except Exception as exc:
                logger.warning("Could not fetch schema for %r: %s", table, exc)

        return QueryIntrospectionResult(
            sql=sql,
            explain=explain,
            table_schemas=table_schemas,
            table_names=table_names,
        )

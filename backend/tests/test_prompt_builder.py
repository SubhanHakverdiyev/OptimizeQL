"""Tests for the PromptBuilder."""

from connectors.base import ColumnStat, ExplainResult, IndexInfo, TableSchema
from services.prompt_builder import PromptBuilder
from services.query_introspector import QueryIntrospectionResult


def _make_introspection(
    sql="SELECT * FROM users",
    explain=None,
    table_schemas=None,
    table_names=None,
    db_type=None,
) -> QueryIntrospectionResult:
    return QueryIntrospectionResult(
        sql=sql,
        explain=explain,
        table_schemas=table_schemas or [],
        table_names=table_names or ["users"],
        db_type=db_type,
    )


class TestPromptBuilder:
    def setup_method(self):
        self.builder = PromptBuilder()

    def test_full_introspection(self):
        explain = ExplainResult(raw_plan="Seq Scan on users", planning_time_ms=0.5, execution_time_ms=1.2)
        schema = TableSchema(
            table_name="users",
            columns=[{"column_name": "id", "data_type": "integer", "is_nullable": "NO"}],
            row_count=1000,
            indexes=[IndexInfo("idx_id", "users", ["id"], True, "btree", "CREATE INDEX ...")],
            column_stats=[ColumnStat("id", 0.0, 4, -1000.0)],
        )
        introspection = _make_introspection(explain=explain, table_schemas=[schema], db_type="postgresql")
        system_prompt, user_message = self.builder.build(introspection)

        assert "PostgreSQL" in system_prompt
        assert "SELECT * FROM users" in user_message
        assert "Seq Scan" in user_message
        assert "users" in user_message
        assert "1,000 rows" in user_message

    def test_no_explain(self):
        introspection = _make_introspection()
        _, user_message = self.builder.build(introspection)
        assert "Not available" in user_message

    def test_no_tables(self):
        introspection = _make_introspection(table_schemas=[], table_names=[])
        _, user_message = self.builder.build(introspection)
        assert "Not available" in user_message

    def test_mysql_dialect(self):
        introspection = _make_introspection(db_type="mysql")
        system_prompt, _ = self.builder.build(introspection)
        assert "MySQL" in system_prompt

    def test_generic_fallback(self):
        introspection = _make_introspection(db_type=None)
        system_prompt, _ = self.builder.build(introspection)
        assert "Detect the SQL dialect" in system_prompt

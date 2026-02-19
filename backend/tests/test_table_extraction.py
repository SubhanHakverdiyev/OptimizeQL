"""Tests for SQL table name extraction."""

from services.query_introspector import extract_table_names


class TestExtractTableNames:
    def test_simple_select(self):
        tables = extract_table_names("SELECT * FROM users")
        assert "users" in tables

    def test_join(self):
        sql = "SELECT * FROM users JOIN orders ON users.id = orders.user_id"
        tables = extract_table_names(sql)
        assert "users" in tables
        assert "orders" in tables

    def test_multiple_tables_comma(self):
        tables = extract_table_names("SELECT * FROM a, b, c")
        assert set(tables) >= {"a", "b", "c"}

    def test_subquery(self):
        sql = "SELECT * FROM (SELECT id FROM users) AS t"
        tables = extract_table_names(sql)
        assert "users" in tables

    def test_cte(self):
        sql = "WITH cte AS (SELECT * FROM users) SELECT * FROM cte"
        tables = extract_table_names(sql)
        assert "users" in tables

    def test_insert_target(self):
        sql = "INSERT INTO orders (user_id) SELECT id FROM users"
        tables = extract_table_names(sql)
        assert "orders" in tables
        assert "users" in tables

    def test_returns_sorted_lowercase(self):
        tables = extract_table_names("SELECT * FROM Zebra JOIN Apple ON 1=1")
        assert tables == sorted(tables)
        assert all(t == t.lower() for t in tables)

    def test_deduplication(self):
        sql = "SELECT * FROM users u1 JOIN users u2 ON u1.id = u2.id"
        tables = extract_table_names(sql)
        assert tables.count("users") == 1

"""Tests for query comparison feature."""

from unittest.mock import MagicMock

import pytest

from api.models.schemas import CompareRequest
from services.query_comparator import compare_queries


# ─── Schema validation ───────────────────────────────────────────────────────


def test_compare_request_valid():
    req = CompareRequest(
        original_sql="SELECT 1",
        rewritten_sql="SELECT 1",
        connection_id="abc-123",
    )
    assert req.row_limit == 100


def test_compare_request_strips_whitespace():
    req = CompareRequest(
        original_sql="  SELECT 1  ",
        rewritten_sql="\nSELECT 1\n",
        connection_id="abc",
    )
    assert req.original_sql == "SELECT 1"
    assert req.rewritten_sql == "SELECT 1"


def test_compare_request_rejects_empty_sql():
    with pytest.raises(Exception):
        CompareRequest(
            original_sql="",
            rewritten_sql="SELECT 1",
            connection_id="abc",
        )


def test_compare_request_rejects_zero_limit():
    with pytest.raises(Exception):
        CompareRequest(
            original_sql="SELECT 1",
            rewritten_sql="SELECT 1",
            connection_id="abc",
            row_limit=0,
        )


def test_compare_request_rejects_limit_over_1000():
    with pytest.raises(Exception):
        CompareRequest(
            original_sql="SELECT 1",
            rewritten_sql="SELECT 1",
            connection_id="abc",
            row_limit=1001,
        )


# ─── Comparator service ──────────────────────────────────────────────────────


def _mock_connector(original_rows: list[tuple], rewritten_rows: list[tuple]) -> MagicMock:
    connector = MagicMock()
    connector.execute_limited.side_effect = [original_rows, rewritten_rows]
    return connector


def test_identical_results_match():
    rows = [(1, "alice"), (2, "bob")]
    connector = _mock_connector(rows, rows)
    result = compare_queries(connector, "SELECT 1", "SELECT 1", row_limit=100)
    assert result.results_match is True
    assert result.rows_compared == 2
    assert result.first_diff is None


def test_different_results_do_not_match():
    original = [(1, "alice"), (2, "bob")]
    rewritten = [(1, "alice"), (2, "charlie")]
    connector = _mock_connector(original, rewritten)
    result = compare_queries(connector, "SELECT 1", "SELECT 2", row_limit=100)
    assert result.results_match is False
    assert result.first_diff is not None
    assert result.first_diff.row_number == 2
    assert result.first_diff.original_row == [2, "bob"]
    assert result.first_diff.rewritten_row == [2, "charlie"]


def test_different_row_counts_do_not_match():
    original = [(1,), (2,), (3,)]
    rewritten = [(1,), (2,)]
    connector = _mock_connector(original, rewritten)
    result = compare_queries(connector, "SELECT 1", "SELECT 2", row_limit=100)
    assert result.results_match is False
    assert result.original_row_count == 3
    assert result.rewritten_row_count == 2
    assert result.first_diff.row_number == 3


def test_empty_results_match():
    connector = _mock_connector([], [])
    result = compare_queries(connector, "SELECT 1", "SELECT 1", row_limit=100)
    assert result.results_match is True
    assert result.rows_compared == 0


def test_first_row_differs():
    original = [(1,)]
    rewritten = [(2,)]
    connector = _mock_connector(original, rewritten)
    result = compare_queries(connector, "SELECT 1", "SELECT 2", row_limit=100)
    assert result.results_match is False
    assert result.first_diff.row_number == 1


# ─── API endpoint ────────────────────────────────────────────────────────────


def test_compare_endpoint_missing_connection(client):
    resp = client.post("/api/v1/analyze/compare", json={
        "original_sql": "SELECT 1",
        "rewritten_sql": "SELECT 1",
        "connection_id": "nonexistent",
    })
    assert resp.status_code == 404

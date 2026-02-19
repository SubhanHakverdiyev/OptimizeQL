"""Tests for /api/v1/analyze endpoints."""

from unittest.mock import patch, MagicMock

from api.models.schemas import AnalysisResult


class TestAnalyzeAPI:
    def test_analyze_without_connection(self, client):
        """Analyze SQL without a live DB connection — should still work via LLM."""
        mock_result = AnalysisResult(
            query_id="test-id",
            summary="Test analysis",
            tables_analyzed=["users"],
        )
        with patch("api.routes.analyze.LLMAnalyzer") as MockAnalyzer:
            instance = MockAnalyzer.return_value
            instance.analyze.return_value = mock_result
            resp = client.post("/api/v1/analyze", json={"sql": "SELECT * FROM users"})

        assert resp.status_code == 200
        data = resp.json()
        assert data["summary"] == "Test analysis"
        assert "users" in data["tables_analyzed"]

    def test_analyze_empty_sql_rejected(self, client):
        resp = client.post("/api/v1/analyze", json={"sql": ""})
        assert resp.status_code == 422  # Pydantic validation error

    def test_analyze_sql_exceeds_max_length(self, client):
        long_sql = "SELECT " + "x" * 60_000
        with patch("api.routes.analyze.settings") as mock_settings:
            mock_settings.max_query_length = 50_000
            mock_settings.rate_limit = "100/minute"
            resp = client.post("/api/v1/analyze", json={"sql": long_sql})
        assert resp.status_code == 400

    def test_history_returns_list(self, client):
        resp = client.get("/api/v1/analyze/history")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_history_respects_limit(self, client):
        resp = client.get("/api/v1/analyze/history?limit=5")
        assert resp.status_code == 200
        assert len(resp.json()) <= 5

"""Tests for API key authentication dependency."""

from unittest.mock import patch


class TestRequireApiKey:
    def test_auth_disabled_when_no_api_key_configured(self, client):
        """When API_KEY is empty, all requests pass without header."""
        with patch("api.dependencies.settings") as mock_settings:
            mock_settings.api_key = None
            resp = client.get("/health")
        assert resp.status_code == 200

    def test_valid_api_key_passes(self, client):
        with patch("api.dependencies.settings") as mock_settings:
            mock_settings.api_key = "test-secret-key"
            resp = client.get("/api/v1/connections", headers={"X-API-Key": "test-secret-key"})
        assert resp.status_code == 200

    def test_invalid_api_key_returns_401(self, client):
        with patch("api.dependencies.settings") as mock_settings:
            mock_settings.api_key = "test-secret-key"
            resp = client.get("/api/v1/connections", headers={"X-API-Key": "wrong-key"})
        assert resp.status_code == 401

    def test_missing_header_returns_401(self, client):
        with patch("api.dependencies.settings") as mock_settings:
            mock_settings.api_key = "test-secret-key"
            resp = client.get("/api/v1/connections")
        assert resp.status_code == 401

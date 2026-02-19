"""Tests for /api/v1/llm-settings endpoints."""

import pytest


class TestLLMSettingsAPI:
    def _create_config(self, client, **overrides):
        payload = {
            "name": "My Anthropic",
            "provider": "anthropic",
            "api_key": "sk-ant-test1234567890abcdef",
            **overrides,
        }
        return client.post("/api/v1/llm-settings", json=payload)

    def test_list_providers(self, client):
        resp = client.get("/api/v1/llm-settings/providers")
        assert resp.status_code == 200
        providers = resp.json()
        names = [p["name"] for p in providers]
        assert "anthropic" in names
        assert "openai" in names
        assert "gemini" in names
        assert "openrouter" in names

    def test_create_config(self, client):
        resp = self._create_config(client)
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "My Anthropic"
        assert data["provider"] == "anthropic"
        assert data["is_active"] is False

    def test_list_configs(self, client):
        self._create_config(client, name="Config 1")
        self._create_config(client, name="Config 2")
        resp = client.get("/api/v1/llm-settings")
        assert resp.status_code == 200
        assert len(resp.json()) >= 2

    def test_api_key_preview_is_masked(self, client):
        resp = self._create_config(client, api_key="sk-ant-test1234567890abcdef")
        data = resp.json()
        preview = data["api_key_preview"]
        assert "..." in preview
        # Full key should NOT be in the response
        assert "sk-ant-test1234567890abcdef" != preview

    def test_update_name(self, client):
        create_resp = self._create_config(client)
        config_id = create_resp.json()["id"]
        resp = client.patch(f"/api/v1/llm-settings/{config_id}", json={"name": "Renamed"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "Renamed"

    def test_update_api_key(self, client):
        create_resp = self._create_config(client)
        config_id = create_resp.json()["id"]
        resp = client.patch(f"/api/v1/llm-settings/{config_id}", json={"api_key": "sk-new-key-value-12345678"})
        assert resp.status_code == 200

    def test_delete_config(self, client):
        create_resp = self._create_config(client)
        config_id = create_resp.json()["id"]
        resp = client.delete(f"/api/v1/llm-settings/{config_id}")
        assert resp.status_code == 204

    def test_activate_config(self, client):
        resp1 = self._create_config(client, name="Config A")
        resp2 = self._create_config(client, name="Config B")
        id_a = resp1.json()["id"]
        id_b = resp2.json()["id"]

        # Activate A
        resp = client.post(f"/api/v1/llm-settings/{id_a}/activate")
        assert resp.status_code == 200
        assert resp.json()["is_active"] is True

        # Activate B — A should be deactivated
        resp = client.post(f"/api/v1/llm-settings/{id_b}/activate")
        assert resp.status_code == 200
        assert resp.json()["is_active"] is True

        # Verify A is no longer active
        all_configs = client.get("/api/v1/llm-settings").json()
        active_ids = [c["id"] for c in all_configs if c["is_active"]]
        assert id_b in active_ids
        assert id_a not in active_ids

    def test_activate_not_found(self, client):
        resp = client.post("/api/v1/llm-settings/nonexistent-id/activate")
        assert resp.status_code == 404

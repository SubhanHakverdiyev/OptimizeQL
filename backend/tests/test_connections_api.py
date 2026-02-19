"""Tests for /api/v1/connections endpoints."""

import pytest


class TestConnectionsAPI:
    def _create_connection(self, client, **overrides):
        payload = {
            "name": "Test DB",
            "db_type": "postgresql",
            "host": "localhost",
            "port": 5432,
            "database": "testdb",
            "username": "user",
            "password": "secret",
            **overrides,
        }
        return client.post("/api/v1/connections", json=payload)

    def test_create_connection(self, client):
        resp = self._create_connection(client)
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Test DB"
        assert data["db_type"] == "postgresql"
        assert data["host"] == "localhost"
        assert "password" not in data  # password not in response

    def test_list_connections(self, client):
        self._create_connection(client, name="DB 1")
        self._create_connection(client, name="DB 2")
        resp = client.get("/api/v1/connections")
        assert resp.status_code == 200
        assert len(resp.json()) >= 2

    def test_get_connection(self, client):
        create_resp = self._create_connection(client)
        conn_id = create_resp.json()["id"]
        resp = client.get(f"/api/v1/connections/{conn_id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == conn_id

    def test_get_connection_not_found(self, client):
        resp = client.get("/api/v1/connections/nonexistent-id")
        assert resp.status_code == 404

    def test_update_connection_name(self, client):
        create_resp = self._create_connection(client)
        conn_id = create_resp.json()["id"]
        resp = client.patch(f"/api/v1/connections/{conn_id}", json={"name": "Renamed"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "Renamed"

    def test_update_connection_password(self, client):
        create_resp = self._create_connection(client)
        conn_id = create_resp.json()["id"]
        resp = client.patch(f"/api/v1/connections/{conn_id}", json={"password": "new-secret"})
        assert resp.status_code == 200

    def test_delete_connection(self, client):
        create_resp = self._create_connection(client)
        conn_id = create_resp.json()["id"]
        resp = client.delete(f"/api/v1/connections/{conn_id}")
        assert resp.status_code == 204

        # Verify it's gone
        resp = client.get(f"/api/v1/connections/{conn_id}")
        assert resp.status_code == 404

    def test_delete_connection_not_found(self, client):
        resp = client.delete("/api/v1/connections/nonexistent-id")
        assert resp.status_code == 404

    def test_password_not_in_response(self, client):
        resp = self._create_connection(client)
        data = resp.json()
        assert "password" not in data
        assert "encrypted_password" not in data

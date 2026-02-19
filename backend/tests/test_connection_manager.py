"""Tests for connection manager host resolution."""

from unittest.mock import patch


class TestResolveHost:
    def test_localhost_in_production(self):
        with patch("services.connection_manager.settings") as mock_settings:
            mock_settings.app_env = "production"
            from services.connection_manager import _resolve_host
            assert _resolve_host("localhost") == "host.docker.internal"

    def test_127_in_production(self):
        with patch("services.connection_manager.settings") as mock_settings:
            mock_settings.app_env = "production"
            from services.connection_manager import _resolve_host
            assert _resolve_host("127.0.0.1") == "host.docker.internal"

    def test_ipv6_loopback_in_production(self):
        with patch("services.connection_manager.settings") as mock_settings:
            mock_settings.app_env = "production"
            from services.connection_manager import _resolve_host
            assert _resolve_host("::1") == "host.docker.internal"

    def test_localhost_in_development(self):
        with patch("services.connection_manager.settings") as mock_settings:
            mock_settings.app_env = "development"
            from services.connection_manager import _resolve_host
            assert _resolve_host("localhost") == "localhost"

    def test_external_host_unchanged(self):
        with patch("services.connection_manager.settings") as mock_settings:
            mock_settings.app_env = "production"
            from services.connection_manager import _resolve_host
            assert _resolve_host("mydb.example.com") == "mydb.example.com"

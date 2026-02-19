"""Tests for Settings and encryption key auto-generation."""

import os
from pathlib import Path
from unittest.mock import patch

import pytest


class TestResolveEncryptionKey:
    def test_reads_from_existing_key_file(self, tmp_path):
        key_file = tmp_path / ".encryption_key"
        key_file.write_text("existing-key-value")

        with patch("core.config._KEY_FILE", key_file):
            from core.config import _resolve_encryption_key
            result = _resolve_encryption_key()

        assert result == "existing-key-value"

    def test_generates_and_persists_when_no_file(self, tmp_path):
        key_file = tmp_path / "subdir" / ".encryption_key"
        assert not key_file.exists()

        with patch("core.config._KEY_FILE", key_file):
            from core.config import _resolve_encryption_key
            result = _resolve_encryption_key()

        assert key_file.exists()
        assert key_file.read_text().strip() == result
        assert len(result) > 0

    def test_skips_empty_key_file(self, tmp_path):
        key_file = tmp_path / ".encryption_key"
        key_file.write_text("   ")

        with patch("core.config._KEY_FILE", key_file):
            from core.config import _resolve_encryption_key
            result = _resolve_encryption_key()

        # Should have generated a new key
        assert result != "   "
        assert len(result) > 0


class TestSettingsDefaults:
    def test_default_database_url_field(self):
        """The Field default contains sql_optimizer.db (env override in tests is expected)."""
        from core.config import Settings
        field_default = Settings.model_fields["database_url"].default
        assert "sql_optimizer.db" in field_default

    def test_default_app_env(self):
        # Our test conftest sets APP_ENV=development
        from core.config import settings
        assert settings.app_env == "development"

    def test_default_rate_limit(self):
        from core.config import settings
        assert settings.rate_limit == "10/minute"

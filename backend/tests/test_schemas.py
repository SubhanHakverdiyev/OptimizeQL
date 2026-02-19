"""Tests for Pydantic request/response schema validation."""

import pytest
from pydantic import ValidationError

from api.models.schemas import (
    AnalyzeRequest,
    ConnectionCreate,
    ConnectionUpdate,
    LLMConfigCreate,
    LLMConfigUpdate,
)


class TestConnectionCreate:
    def test_valid_data(self):
        conn = ConnectionCreate(
            name="My DB",
            db_type="postgresql",
            host="localhost",
            port=5432,
            database="testdb",
            username="user",
            password="pass",
        )
        assert conn.name == "My DB"
        assert conn.ssl_enabled is False

    def test_missing_required_fields(self):
        with pytest.raises(ValidationError):
            ConnectionCreate(name="x")  # missing host, port, etc.

    def test_invalid_port_zero(self):
        with pytest.raises(ValidationError):
            ConnectionCreate(
                name="x", db_type="postgresql", host="h", port=0,
                database="d", username="u", password="p",
            )

    def test_invalid_port_too_high(self):
        with pytest.raises(ValidationError):
            ConnectionCreate(
                name="x", db_type="postgresql", host="h", port=65536,
                database="d", username="u", password="p",
            )

    def test_invalid_db_type(self):
        with pytest.raises(ValidationError):
            ConnectionCreate(
                name="x", db_type="oracle", host="h", port=1521,
                database="d", username="u", password="p",
            )


class TestConnectionUpdate:
    def test_all_none_is_valid(self):
        update = ConnectionUpdate()
        assert update.name is None
        assert update.password is None
        assert update.ssl_enabled is None


class TestAnalyzeRequest:
    def test_valid_sql(self):
        req = AnalyzeRequest(sql="SELECT * FROM users")
        assert req.sql == "SELECT * FROM users"

    def test_empty_sql_rejected(self):
        with pytest.raises(ValidationError):
            AnalyzeRequest(sql="")

    def test_strip_sql_whitespace(self):
        req = AnalyzeRequest(sql="  SELECT 1  ")
        assert req.sql == "SELECT 1"

    def test_optional_fields(self):
        req = AnalyzeRequest(sql="SELECT 1")
        assert req.connection_id is None
        assert req.model is None


class TestLLMConfigCreate:
    def test_valid_data(self):
        config = LLMConfigCreate(
            name="My Claude", provider="anthropic", api_key="sk-ant-1234"
        )
        assert config.provider == "anthropic"

    def test_invalid_provider(self):
        with pytest.raises(ValidationError):
            LLMConfigCreate(name="x", provider="invalid-provider", api_key="key")

    def test_empty_api_key(self):
        with pytest.raises(ValidationError):
            LLMConfigCreate(name="x", provider="openai", api_key="")


class TestLLMConfigUpdate:
    def test_all_none_is_valid(self):
        update = LLMConfigUpdate()
        assert update.name is None
        assert update.api_key is None

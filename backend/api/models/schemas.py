"""Pydantic request/response schemas."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


# ─────────────────────────────  Connections  ──────────────────────────────────

class ConnectionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    db_type: Literal["postgresql", "mysql"]
    host: str = Field(..., min_length=1)
    port: int = Field(..., gt=0, lt=65536)
    database: str = Field(..., min_length=1)
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)
    ssl_enabled: bool = False


class ConnectionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    password: str | None = None
    ssl_enabled: bool | None = None


class ConnectionResponse(BaseModel):
    id: str
    name: str
    db_type: str
    host: str
    port: int
    database: str
    username: str
    ssl_enabled: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ConnectionTestResult(BaseModel):
    success: bool
    message: str


# ─────────────────────────────  Analysis  ────────────────────────────────────

class AnalyzeRequest(BaseModel):
    sql: str = Field(..., min_length=1)
    connection_id: str | None = None  # Optional: skip live DB introspection if None
    model: str | None = None  # Optional: override model for this analysis

    @field_validator("sql")
    @classmethod
    def strip_sql(cls, v: str) -> str:
        return v.strip()


class SuggestionItem(BaseModel):
    sql: str | None = None
    explanation: str
    estimated_impact: str   # "high" | "medium" | "low"
    plan_node: str | None = None      # bottlenecks: the specific EXPLAIN node
    root_cause: str | None = None     # bottlenecks: estimation|cost_model|missing_index|memory|query_structure|other
    index_type: str | None = None     # indexes: btree|gin|gist|brin|hash|partial|covering|fulltext|spatial|composite


class ConfigurationItem(BaseModel):
    parameter: str
    current_value: str = "unknown"
    recommended_value: str
    explanation: str
    estimated_impact: str   # "high" | "medium" | "low"


class AnalysisResult(BaseModel):
    query_id: str
    indexes: list[SuggestionItem] = []
    rewrites: list[SuggestionItem] = []
    materialized_views: list[SuggestionItem] = []
    bottlenecks: list[SuggestionItem] = []
    statistics: list[SuggestionItem] = []
    configuration: list[ConfigurationItem] = []
    summary: str = ""
    explain_plan: str | None = None
    explain_error: str | None = None
    tables_analyzed: list[str] = []


# ─────────────────────────────  Comparison  ──────────────────────────────────

class CompareRequest(BaseModel):
    original_sql: str = Field(..., min_length=1)
    rewritten_sql: str = Field(..., min_length=1)
    connection_id: str = Field(..., min_length=1)
    row_limit: int = Field(default=100, gt=0, le=1000)

    @field_validator("original_sql", "rewritten_sql")
    @classmethod
    def strip_sql_fields(cls, v: str) -> str:
        return v.strip()


class RowDiff(BaseModel):
    row_number: int
    original_row: list
    rewritten_row: list


class CompareResult(BaseModel):
    results_match: bool
    rows_compared: int
    original_row_count: int
    rewritten_row_count: int
    first_diff: RowDiff | None = None
    original_error: str | None = None
    rewritten_error: str | None = None


# ─────────────────────────────  LLM Config  ──────────────────────────────────

class LLMConfigCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    provider: Literal["anthropic", "openai", "gemini", "deepseek", "xai", "qwen", "meta", "kimi", "openrouter"]
    api_key: str = Field(..., min_length=1)


class LLMConfigUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    api_key: str | None = None


class LLMConfigResponse(BaseModel):
    id: str
    name: str
    provider: str
    is_active: bool
    api_key_preview: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProviderInfo(BaseModel):
    name: str
    label: str
    default_model: str
    models: list[str]


# ─────────────────────────────  Query History  ───────────────────────────────

class QueryHistoryItem(BaseModel):
    id: str
    connection_id: str | None
    sql_query: str
    llm_response: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}

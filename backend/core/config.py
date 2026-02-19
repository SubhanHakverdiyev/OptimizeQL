import logging
from pathlib import Path

from cryptography.fernet import Fernet
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, model_validator

logger = logging.getLogger(__name__)

_KEY_FILE = Path("data/.encryption_key")


def _resolve_encryption_key() -> str:
    """Return an encryption key from the environment, a persisted file, or generate a new one."""
    # 1. Check if a key file already exists (from a previous run)
    if _KEY_FILE.exists():
        key = _KEY_FILE.read_text().strip()
        if key:
            return key

    # 2. No persisted key — generate a new one and save it
    key = Fernet.generate_key().decode()
    _KEY_FILE.parent.mkdir(parents=True, exist_ok=True)
    _KEY_FILE.write_text(key)
    logger.info("Auto-generated encryption key → %s", _KEY_FILE)
    return key


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Internal DB (stored in data/ so Docker volume persists it)
    database_url: str = Field(
        default="sqlite:///./data/sql_optimizer.db",
        description="Internal storage DB URL",
    )

    # LLM provider
    llm_provider: str = Field(default="openrouter", description="Active LLM provider")

    # Google AI (Gemini)
    google_api_key: str | None = Field(default=None, description="Google AI API key")

    # Anthropic (Claude)
    anthropic_api_key: str | None = Field(default=None, description="Anthropic API key")

    # OpenAI
    openai_api_key: str | None = Field(default=None, description="OpenAI API key")

    # DeepSeek
    deepseek_api_key: str | None = Field(default=None, description="DeepSeek API key")

    # xAI (Grok)
    xai_api_key: str | None = Field(default=None, description="xAI API key")

    # Qwen (Alibaba DashScope)
    qwen_api_key: str | None = Field(default=None, description="Alibaba DashScope API key")

    # Meta Llama
    meta_api_key: str | None = Field(default=None, description="Meta Llama API key")

    # Kimi / Moonshot
    kimi_api_key: str | None = Field(default=None, description="Moonshot API key")
    kimi_base_url: str = Field(default="https://api.moonshot.cn/v1", description="Moonshot API base URL")

    # OpenRouter
    openrouter_api_key: str | None = Field(default=None, description="OpenRouter API key")

    # Encryption — auto-generated if not provided or empty
    encryption_key: str = Field(
        default="",
        description="Fernet key for credential encryption (auto-generated if empty)",
    )

    @model_validator(mode="after")
    def _ensure_encryption_key(self) -> "Settings":
        if not self.encryption_key:
            self.encryption_key = _resolve_encryption_key()
        return self

    # API authentication (optional — if unset, auth is disabled)
    api_key: str | None = Field(default=None, description="Static API key for X-API-Key header auth")

    # CORS (comma-separated origins for production)
    cors_origins: str = Field(default="", description="Comma-separated allowed origins for CORS")

    # App
    app_env: str = Field(default="development")
    log_level: str = Field(default="INFO")
    app_title: str = "OptimizeQL"
    app_version: str = "1.0.0"

    # LLM
    llm_model: str = Field(default="meta-llama/llama-3.3-70b-instruct:free", description="LLM model ID")
    llm_max_tokens: int = Field(default=4096, description="Max output tokens for LLM response")

    # Rate limiting
    rate_limit: str = Field(default="10/minute", description="Rate limit for analyze endpoint")

    # Safety
    explain_timeout_ms: int = Field(
        default=10_000,
        description="Max milliseconds for EXPLAIN ANALYZE execution",
    )
    max_query_length: int = Field(
        default=50_000,
        description="Max characters in a submitted SQL query",
    )


settings = Settings()

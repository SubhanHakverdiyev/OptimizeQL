"""SQLAlchemy ORM models for internal storage."""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class DBConnection(Base):
    """Stored database connection configuration (credentials encrypted)."""

    __tablename__ = "db_connections"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    db_type: Mapped[str] = mapped_column(String(20), nullable=False)   # "postgresql" | "mysql"
    host: Mapped[str] = mapped_column(String(255), nullable=False)
    port: Mapped[int] = mapped_column(Integer, nullable=False)
    database: Mapped[str] = mapped_column(String(255), nullable=False)
    username: Mapped[str] = mapped_column(String(255), nullable=False)
    # Fernet-encrypted password stored as ciphertext
    encrypted_password: Mapped[str] = mapped_column(Text, nullable=False)
    ssl_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    query_history: Mapped[list["QueryHistory"]] = relationship(
        "QueryHistory", back_populates="connection", passive_deletes=True
    )


class QueryHistory(Base):
    """Record of a query analysis session."""

    __tablename__ = "query_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    connection_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("db_connections.id", ondelete="SET NULL"), nullable=True
    )
    sql_query: Mapped[str] = mapped_column(Text, nullable=False)
    explain_plan: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Full JSON response from Claude stored as text
    llm_response: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    connection: Mapped["DBConnection | None"] = relationship(
        "DBConnection", back_populates="query_history"
    )


class LLMConfig(Base):
    """User-configured LLM provider API key (one key per provider)."""

    __tablename__ = "llm_configs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)  # gemini | kimi | openrouter
    encrypted_api_key: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[str | None] = mapped_column(String(255), nullable=True)  # legacy, unused
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

"""Internal SQLAlchemy setup for storing connection configs and query history."""

from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session
from typing import Generator

from core.config import settings

# Ensure the data directory exists for SQLite storage
if "sqlite" in settings.database_url:
    Path("data").mkdir(parents=True, exist_ok=True)

engine = create_engine(
    settings.database_url,
    # SQLite needs this flag; ignored by other drivers
    connect_args={"check_same_thread": False} if "sqlite" in settings.database_url else {},
    echo=(settings.app_env == "development"),
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a DB session and closes it afterwards."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables on startup."""
    # Import models so Base registers them before create_all
    import api.models.orm  # noqa: F401
    Base.metadata.create_all(bind=engine)

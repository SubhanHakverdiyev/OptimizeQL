"""Shared fixtures for the OptimizeQL test suite."""

import os
import sys

# Ensure the backend package is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Set a valid encryption key BEFORE any app code imports settings
os.environ["ENCRYPTION_KEY"] = "dGVzdGtleS0xMjM0NTY3ODkwYWJjZGVm"  # will be overridden below

import pytest
from cryptography.fernet import Fernet
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

# Generate a real Fernet key for tests
_TEST_FERNET_KEY = Fernet.generate_key().decode()
os.environ["ENCRYPTION_KEY"] = _TEST_FERNET_KEY
os.environ["APP_ENV"] = "development"
os.environ["DATABASE_URL"] = "sqlite://"  # in-memory

from core.database import Base, get_db
from main import app

from fastapi.testclient import TestClient


_engine = create_engine("sqlite://", connect_args={"check_same_thread": False})

# SQLite doesn't support server_default=func.now() the same way — use a listener
@event.listens_for(_engine, "connect")
def _set_sqlite_pragma(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.close()


_TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)


@pytest.fixture(scope="session", autouse=True)
def _create_tables():
    """Create all tables once for the test session."""
    import api.models.orm  # noqa: F401 — register ORM models
    Base.metadata.create_all(bind=_engine)
    yield
    Base.metadata.drop_all(bind=_engine)


@pytest.fixture()
def db_session():
    """Yield a fresh DB session that rolls back after each test."""
    connection = _engine.connect()
    transaction = connection.begin()
    session = _TestSessionLocal(bind=connection)
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture()
def client(db_session):
    """FastAPI TestClient with the DB session overridden."""
    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def fernet_key():
    """Return the test Fernet key."""
    return _TEST_FERNET_KEY

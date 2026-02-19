"""CRUD operations for stored DB connections, with encrypted credentials."""

import logging

from sqlalchemy.orm import Session

from api.models.orm import DBConnection
from api.models.schemas import ConnectionCreate, ConnectionUpdate
from connectors.mysql import MySQLConnector
from connectors.postgresql import PostgreSQLConnector
from connectors.base import BaseConnector
from core.config import settings
from core.encryption import decrypt, encrypt

logger = logging.getLogger(__name__)

_LOCALHOST_ALIASES = {"localhost", "127.0.0.1", "::1"}


def _resolve_host(host: str) -> str:
    """In production (Docker), rewrite localhost to host.docker.internal."""
    if settings.app_env != "development" and host.lower() in _LOCALHOST_ALIASES:
        logger.info("Rewriting host %r → host.docker.internal (running in Docker)", host)
        return "host.docker.internal"
    return host


class ConnectionManager:
    def __init__(self, db: Session) -> None:
        self._db = db

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------

    def create(self, data: ConnectionCreate) -> DBConnection:
        encrypted_pw = encrypt(data.password)
        conn = DBConnection(
            name=data.name,
            db_type=data.db_type,
            host=_resolve_host(data.host),
            port=data.port,
            database=data.database,
            username=data.username,
            encrypted_password=encrypted_pw,
            ssl_enabled=data.ssl_enabled,
        )
        self._db.add(conn)
        self._db.commit()
        self._db.refresh(conn)
        logger.info("Created connection %s (%s)", conn.id, conn.name)
        return conn

    def get(self, connection_id: str) -> DBConnection | None:
        return self._db.get(DBConnection, connection_id)

    def list_all(self) -> list[DBConnection]:
        return self._db.query(DBConnection).order_by(DBConnection.created_at.desc()).all()

    def update(self, connection_id: str, data: ConnectionUpdate) -> DBConnection | None:
        conn = self.get(connection_id)
        if not conn:
            return None
        if data.name is not None:
            conn.name = data.name
        if data.password is not None:
            conn.encrypted_password = encrypt(data.password)
        if data.ssl_enabled is not None:
            conn.ssl_enabled = data.ssl_enabled
        self._db.commit()
        self._db.refresh(conn)
        return conn

    def delete(self, connection_id: str) -> bool:
        conn = self.get(connection_id)
        if not conn:
            return False
        self._db.delete(conn)
        self._db.commit()
        return True

    # ------------------------------------------------------------------
    # Connection factory
    # ------------------------------------------------------------------

    def open_connector(self, connection_id: str) -> BaseConnector:
        """Decrypt credentials and return a live connector instance."""
        conn = self.get(connection_id)
        if not conn:
            raise ValueError(f"Connection {connection_id!r} not found")

        password = decrypt(conn.encrypted_password)

        if conn.db_type == "postgresql":
            return PostgreSQLConnector(
                host=_resolve_host(conn.host),
                port=conn.port,
                database=conn.database,
                user=conn.username,
                password=password,
                sslmode="require" if conn.ssl_enabled else "prefer",
            )
        elif conn.db_type == "mysql":
            return MySQLConnector(
                host=_resolve_host(conn.host),
                port=conn.port,
                database=conn.database,
                user=conn.username,
                password=password,
            )
        else:
            raise ValueError(f"Unsupported db_type: {conn.db_type!r}")

    def test_connection(self, connection_id: str) -> bool:
        connector = self.open_connector(connection_id)
        try:
            return connector.test_connection()
        finally:
            connector.close()

"""CRUD + test endpoints for stored database connections."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from api.models.schemas import (
    ConnectionCreate,
    ConnectionResponse,
    ConnectionTestResult,
    ConnectionUpdate,
)
from api.dependencies import require_api_key
from core.database import get_db
from services.connection_manager import ConnectionManager

router = APIRouter(prefix="/connections", tags=["connections"], dependencies=[Depends(require_api_key)])


def _manager(db: Session = Depends(get_db)) -> ConnectionManager:
    return ConnectionManager(db)


@router.post("", response_model=ConnectionResponse, status_code=status.HTTP_201_CREATED)
def create_connection(
    data: ConnectionCreate,
    manager: ConnectionManager = Depends(_manager),
):
    return manager.create(data)


@router.get("", response_model=list[ConnectionResponse])
def list_connections(manager: ConnectionManager = Depends(_manager)):
    return manager.list_all()


@router.get("/{connection_id}", response_model=ConnectionResponse)
def get_connection(
    connection_id: str,
    manager: ConnectionManager = Depends(_manager),
):
    conn = manager.get(connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    return conn


@router.patch("/{connection_id}", response_model=ConnectionResponse)
def update_connection(
    connection_id: str,
    data: ConnectionUpdate,
    manager: ConnectionManager = Depends(_manager),
):
    conn = manager.update(connection_id, data)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    return conn


@router.delete("/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_connection(
    connection_id: str,
    manager: ConnectionManager = Depends(_manager),
):
    if not manager.delete(connection_id):
        raise HTTPException(status_code=404, detail="Connection not found")


@router.post("/{connection_id}/test", response_model=ConnectionTestResult)
def test_connection(
    connection_id: str,
    manager: ConnectionManager = Depends(_manager),
):
    conn = manager.get(connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    try:
        ok = manager.test_connection(connection_id)
        if ok:
            return ConnectionTestResult(success=True, message="Connection successful")
        return ConnectionTestResult(success=False, message="Connection failed")
    except Exception as exc:
        return ConnectionTestResult(success=False, message=str(exc))

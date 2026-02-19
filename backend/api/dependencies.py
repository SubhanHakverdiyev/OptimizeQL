"""Shared FastAPI dependencies."""

import secrets

from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader

from core.config import settings

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def require_api_key(api_key: str | None = Security(_api_key_header)) -> None:
    """Validate X-API-Key header. Skip validation if API_KEY is not configured."""
    if not settings.api_key:
        return
    if api_key is None or not secrets.compare_digest(api_key, settings.api_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key",
        )

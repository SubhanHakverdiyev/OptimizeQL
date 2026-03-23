"""Shared FastAPI dependencies."""

import secrets

from fastapi import HTTPException, Request, Security, status
from fastapi.security import APIKeyHeader
from slowapi.util import get_remote_address

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


def get_real_ip(request: Request) -> str:
    """Extract the real client IP behind reverse proxies.

    Checks headers in order of specificity:
    1. CF-Connecting-IP  (Cloudflare)
    2. X-Real-IP         (Nginx)
    3. X-Forwarded-For   (standard proxy header — first IP is the client)
    4. request.client.host (direct connection fallback)
    """
    if cf_ip := request.headers.get("CF-Connecting-IP"):
        return cf_ip.strip()
    if real_ip := request.headers.get("X-Real-IP"):
        return real_ip.strip()
    if forwarded := request.headers.get("X-Forwarded-For"):
        return forwarded.split(",")[0].strip()
    return get_remote_address(request)

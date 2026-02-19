"""SQL Query Optimizer — FastAPI entry point."""

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from core.config import settings
from core.database import init_db
from api.routes.connections import router as connections_router
from api.routes.analyze import router as analyze_router
from api.routes.llm_settings import router as llm_settings_router

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address, default_limits=[])

app = FastAPI(
    title=settings.app_title,
    version=settings.app_version,
    docs_url="/docs",
    redoc_url="/redoc",
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — tighten allowed_origins in production
_cors_origins = (
    ["*"]
    if settings.app_env == "development"
    else [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    logger.info("Initializing database tables…")
    init_db()
    logger.info("Startup complete.")


app.include_router(connections_router, prefix="/api/v1")
app.include_router(analyze_router, prefix="/api/v1")
app.include_router(llm_settings_router, prefix="/api/v1")


@app.get("/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok", "version": settings.app_version}

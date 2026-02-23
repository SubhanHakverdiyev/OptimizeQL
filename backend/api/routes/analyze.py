"""Query analysis endpoint — the core of the application."""

import json
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from api.dependencies import require_api_key
from api.models.orm import LLMConfig, QueryHistory
from api.models.schemas import AnalysisResult, AnalyzeRequest, CompareRequest, CompareResult, QueryHistoryItem
from core.config import settings
from core.database import get_db
from core.encryption import decrypt
from services.connection_manager import ConnectionManager
from services.llm_analyzer import LLMAnalyzer
from services.llm_providers import get_provider
from services.query_comparator import compare_queries
from services.query_introspector import QueryIntrospectionResult, QueryIntrospector

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analyze", tags=["analyze"], dependencies=[Depends(require_api_key)])

limiter = Limiter(key_func=get_remote_address)


@router.post("", response_model=AnalysisResult)
@limiter.limit(settings.rate_limit)
def analyze_query(
    request: Request,
    body: AnalyzeRequest,
    db: Session = Depends(get_db),
):
    # Basic length guard
    if len(body.sql) > settings.max_query_length:
        raise HTTPException(
            status_code=400,
            detail=f"Query exceeds maximum allowed length of {settings.max_query_length} characters.",
        )

    query_id = str(uuid.uuid4())

    # ── Live DB introspection (optional) ─────────────────────────────────────
    conn_record = None
    introspection: QueryIntrospectionResult | None = None

    if body.connection_id:
        manager = ConnectionManager(db)
        conn_record = manager.get(body.connection_id)
        if not conn_record:
            raise HTTPException(status_code=404, detail="Connection not found")

        try:
            connector = manager.open_connector(body.connection_id)
            try:
                introspector = QueryIntrospector(connector)
                introspection = introspector.introspect(body.sql)
                introspection.db_type = conn_record.db_type
            finally:
                connector.close()
        except Exception as exc:
            logger.warning("DB introspection failed: %s — proceeding without live data", exc)

    # Build a minimal introspection object when no live DB is available
    if introspection is None:
        from services.query_introspector import extract_table_names

        introspection = QueryIntrospectionResult(
            sql=body.sql,
            explain=None,
            table_schemas=[],
            table_names=extract_table_names(body.sql),
            db_type=conn_record.db_type if conn_record else None,
        )

    # ── Resolve LLM provider (DB config takes priority over .env) ────────────
    provider_override = None
    active_config = db.query(LLMConfig).filter(LLMConfig.is_active.is_(True)).first()
    if active_config:
        try:
            api_key = decrypt(active_config.encrypted_api_key)
            provider_override = get_provider(
                provider_name=active_config.provider,
                api_key=api_key,
                model=body.model,  # model chosen at analysis time
            )
        except Exception as exc:
            logger.warning("Failed to load active LLM config %s: %s — falling back to .env", active_config.id, exc)

    # ── LLM Analysis ─────────────────────────────────────────────────────────
    try:
        analyzer = LLMAnalyzer()
        result = analyzer.analyze(introspection, query_id=query_id, provider_override=provider_override)
    except Exception as exc:
        logger.exception("LLM analysis failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"LLM analysis failed: {exc}")

    # ── Attach EXPLAIN error if query execution failed ──────────────────────
    if introspection.explain_error:
        result.explain_error = introspection.explain_error

    # ── Persist to query history ──────────────────────────────────────────────
    try:
        history = QueryHistory(
            id=query_id,
            connection_id=body.connection_id,
            sql_query=body.sql,
            explain_plan=introspection.explain.raw_plan if introspection.explain else None,
            llm_response=result.model_dump_json(),
        )
        db.add(history)
        db.commit()
    except Exception as exc:
        logger.warning("Failed to persist query history: %s", exc)

    return result


@router.get("/history", response_model=list[QueryHistoryItem])
def get_history(
    limit: int = 50,
    db: Session = Depends(get_db),
):
    rows = (
        db.query(QueryHistory)
        .order_by(QueryHistory.created_at.desc())
        .limit(limit)
        .all()
    )
    return rows


@router.post("/compare", response_model=CompareResult)
@limiter.limit(settings.rate_limit)
def compare_rewrites(
    request: Request,
    body: CompareRequest,
    db: Session = Depends(get_db),
):
    """Compare original and rewritten SQL by executing both and diffing results."""
    manager = ConnectionManager(db)
    conn_record = manager.get(body.connection_id)
    if not conn_record:
        raise HTTPException(status_code=404, detail="Connection not found")

    try:
        connector = manager.open_connector(body.connection_id)
        try:
            result = compare_queries(
                connector=connector,
                original_sql=body.original_sql,
                rewritten_sql=body.rewritten_sql,
                row_limit=body.row_limit,
            )
        finally:
            connector.close()
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Query comparison failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Query comparison failed: {exc}")

    return result

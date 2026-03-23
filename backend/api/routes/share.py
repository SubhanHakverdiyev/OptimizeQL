"""Share link endpoints — create and retrieve shareable analysis snapshots."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from sqlalchemy.orm import Session

from api.dependencies import get_real_ip
from api.models.orm import ShareLink
from api.models.schemas import ShareLinkCreate, ShareLinkResponse
from core.config import settings
from core.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/share", tags=["share"])

limiter = Limiter(key_func=get_real_ip)


@router.post("", response_model=ShareLinkResponse, status_code=201)
@limiter.limit("10/hour")
def create_share_link(
    request: Request,
    body: ShareLinkCreate,
    db: Session = Depends(get_db),
):
    """Create a shareable link from a playground analysis."""
    link = ShareLink(
        schema_ddl=body.schema_ddl,
        sql_query=body.sql_query,
        llm_response=body.llm_response,
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    logger.info("Created share link %s", link.id)
    return link


@router.get("/{link_id}", response_model=ShareLinkResponse)
def get_share_link(
    link_id: str,
    db: Session = Depends(get_db),
):
    """Retrieve a shared analysis by its short ID."""
    link = db.query(ShareLink).filter(ShareLink.id == link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Share link not found")
    return link

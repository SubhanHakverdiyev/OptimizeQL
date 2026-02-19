"""CRUD endpoints for user-configured LLM provider settings."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.dependencies import require_api_key
from api.models.orm import LLMConfig
from api.models.schemas import (
    LLMConfigCreate,
    LLMConfigResponse,
    LLMConfigUpdate,
    ProviderInfo,
)
from core.database import get_db
from core.encryption import decrypt, encrypt

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/llm-settings",
    tags=["llm-settings"],
    dependencies=[Depends(require_api_key)],
)

PROVIDERS = [
    ProviderInfo(
        name="anthropic",
        label="Anthropic (Claude)",
        default_model="claude-sonnet-4-6",
        models=[
            "claude-opus-4-6",
            "claude-sonnet-4-6",
            "claude-haiku-4-5-20251001",
        ],
    ),
    ProviderInfo(
        name="openai",
        label="OpenAI",
        default_model="gpt-4.1",
        models=[
            "o3",
            "o4-mini",
            "gpt-4.1",
            "gpt-4.1-mini",
            "gpt-4o",
            "gpt-4o-mini",
        ],
    ),
    ProviderInfo(
        name="gemini",
        label="Google Gemini",
        default_model="gemini-2.5-flash",
        models=[
            "gemini-2.5-pro",
            "gemini-2.5-flash",
            "gemini-2.5-flash-lite",
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
        ],
    ),
    ProviderInfo(
        name="deepseek",
        label="DeepSeek",
        default_model="deepseek-chat",
        models=[
            "deepseek-chat",
            "deepseek-reasoner",
        ],
    ),
    ProviderInfo(
        name="xai",
        label="xAI (Grok)",
        default_model="grok-3",
        models=[
            "grok-3",
            "grok-3-mini",
            "grok-2-1212",
            "grok-2-mini",
        ],
    ),
    ProviderInfo(
        name="qwen",
        label="Qwen (Alibaba)",
        default_model="qwen-max",
        models=[
            "qwen-max",
            "qwen-plus",
            "qwen-turbo",
            "qwq-32b",
        ],
    ),
    ProviderInfo(
        name="meta",
        label="Meta Llama",
        default_model="Llama-4-Maverick-17B-128E-Instruct-FP8",
        models=[
            "Llama-4-Maverick-17B-128E-Instruct-FP8",
            "Llama-4-Scout-17B-16E-Instruct",
            "Llama-3.3-70B-Instruct",
            "Llama-3.1-405B-Instruct-FP8",
        ],
    ),
    ProviderInfo(
        name="openrouter",
        label="OpenRouter",
        default_model="meta-llama/llama-4-maverick:free",
        models=[
            "meta-llama/llama-4-maverick:free",
            "meta-llama/llama-4-scout:free",
            "google/gemini-2.5-pro-exp-03-25:free",
            "deepseek/deepseek-chat-v3-0324:free",
            "deepseek/deepseek-r1-zero:free",
            "qwen/qwen3-coder-480b:free",
            "mistralai/mistral-small-3.1-24b-instruct:free",
            "nvidia/llama-3.1-nemotron-nano-8b-v1:free",
            "meta-llama/llama-3.3-70b-instruct:free",
            "deepseek/deepseek-v3-base:free",
        ],
    ),
    ProviderInfo(
        name="kimi",
        label="Kimi / Moonshot",
        default_model="kimi-k2.5",
        models=[
            "kimi-k2.5",
            "moonshot-v1-8k",
            "moonshot-v1-32k",
            "moonshot-v1-128k",
        ],
    ),
]


def _mask_key(encrypted_key: str) -> str:
    """Decrypt an API key and return a masked preview."""
    try:
        key = decrypt(encrypted_key)
    except ValueError:
        return "***"
    if len(key) <= 8:
        return "***"
    return f"{key[:4]}...{key[-4:]}"


def _to_response(config: LLMConfig) -> LLMConfigResponse:
    return LLMConfigResponse(
        id=config.id,
        name=config.name,
        provider=config.provider,
        is_active=config.is_active,
        api_key_preview=_mask_key(config.encrypted_api_key),
        created_at=config.created_at,
        updated_at=config.updated_at,
    )


@router.get("/providers", response_model=list[ProviderInfo])
def list_providers():
    return PROVIDERS


@router.post("", response_model=LLMConfigResponse, status_code=201)
def create_llm_config(body: LLMConfigCreate, db: Session = Depends(get_db)):
    config = LLMConfig(
        name=body.name,
        provider=body.provider,
        encrypted_api_key=encrypt(body.api_key),
        is_active=False,
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    logger.info("Created LLM config %s (%s)", config.id, config.provider)
    return _to_response(config)


@router.get("", response_model=list[LLMConfigResponse])
def list_llm_configs(db: Session = Depends(get_db)):
    configs = (
        db.query(LLMConfig)
        .order_by(LLMConfig.created_at.desc())
        .all()
    )
    return [_to_response(c) for c in configs]


@router.patch("/{config_id}", response_model=LLMConfigResponse)
def update_llm_config(
    config_id: str,
    body: LLMConfigUpdate,
    db: Session = Depends(get_db),
):
    config = db.query(LLMConfig).filter(LLMConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="LLM config not found")

    if body.name is not None:
        config.name = body.name
    if body.api_key is not None:
        config.encrypted_api_key = encrypt(body.api_key)

    db.commit()
    db.refresh(config)
    return _to_response(config)


@router.delete("/{config_id}", status_code=204)
def delete_llm_config(config_id: str, db: Session = Depends(get_db)):
    config = db.query(LLMConfig).filter(LLMConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="LLM config not found")
    db.delete(config)
    db.commit()


@router.post("/{config_id}/activate", response_model=LLMConfigResponse)
def activate_llm_config(config_id: str, db: Session = Depends(get_db)):
    config = db.query(LLMConfig).filter(LLMConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="LLM config not found")

    # Deactivate all others
    db.query(LLMConfig).filter(LLMConfig.id != config_id).update({"is_active": False})
    config.is_active = True
    db.commit()
    db.refresh(config)
    logger.info("Activated LLM config %s (%s)", config.id, config.provider)
    return _to_response(config)

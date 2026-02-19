"""LLM provider factory — import get_provider() to obtain the active provider."""

from core.config import settings
from services.llm_providers.base import BaseLLMProvider

# Base URLs for OpenAI-compatible providers (None = use the SDK default, i.e. official OpenAI)
_OPENAI_COMPATIBLE_URLS: dict[str, str | None] = {
    "openai":     None,
    "deepseek":   "https://api.deepseek.com/v1",
    "xai":        "https://api.x.ai/v1",
    "qwen":       "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "meta":       "https://api.llama.com/compat/v1",
    "kimi":       "https://api.moonshot.cn/v1",
    "openrouter": "https://openrouter.ai/api/v1",
}


def get_provider(
    provider_name: str | None = None,
    api_key: str | None = None,
    model: str | None = None,
) -> BaseLLMProvider:
    """Return an LLM provider instance.

    When called with explicit arguments, creates a provider using those
    credentials. When called without arguments, falls back to the
    global settings from .env.
    """
    name = (provider_name or settings.llm_provider).lower()
    resolved_model = model or settings.llm_model

    # Anthropic — uses its own SDK
    if name == "anthropic":
        from services.llm_providers.anthropic_provider import AnthropicProvider

        return AnthropicProvider(
            api_key=api_key or settings.anthropic_api_key or "",
            model=resolved_model,
        )

    # Gemini — uses google-genai SDK
    if name == "gemini":
        from services.llm_providers.gemini import GeminiProvider

        return GeminiProvider(
            api_key=api_key or settings.google_api_key or "",
            model=resolved_model,
        )

    # All OpenAI-compatible providers
    if name in _OPENAI_COMPATIBLE_URLS:
        from services.llm_providers.openai_compatible import OpenAICompatibleProvider

        return OpenAICompatibleProvider(
            api_key=api_key or _get_env_api_key(name),
            model=resolved_model,
            base_url=_OPENAI_COMPATIBLE_URLS[name],
        )

    raise ValueError(
        f"Unknown LLM provider '{name}'. "
        "Supported: anthropic, gemini, openai, deepseek, xai, qwen, meta, kimi, openrouter"
    )


def _get_env_api_key(name: str) -> str:
    """Resolve the .env fallback API key for a given provider name."""
    return getattr(settings, f"{name}_api_key", None) or ""

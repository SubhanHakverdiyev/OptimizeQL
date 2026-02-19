"""Generic OpenAI-compatible provider (covers OpenAI, DeepSeek, xAI, Qwen, Meta Llama, etc.)."""

import logging

from openai import OpenAI

from services.llm_providers.base import BaseLLMProvider

logger = logging.getLogger(__name__)


class OpenAICompatibleProvider(BaseLLMProvider):
    def __init__(self, api_key: str, model: str, base_url: str | None = None) -> None:
        self._client = OpenAI(api_key=api_key, base_url=base_url)
        self._model = model

    def generate(self, system_prompt: str, user_message: str, max_tokens: int) -> str:
        response = self._client.chat.completions.create(
            model=self._model,
            max_tokens=max_tokens,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
        )

        choice = response.choices[0] if response.choices else None
        if not choice:
            logger.error("Provider returned no choices. model=%s", self._model)
            return ""

        content = choice.message.content or ""
        if not content:
            logger.error(
                "Provider returned empty content. finish_reason=%s, model=%s",
                choice.finish_reason,
                self._model,
            )
        return content

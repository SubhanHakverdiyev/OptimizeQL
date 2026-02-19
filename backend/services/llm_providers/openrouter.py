"""OpenRouter provider using the OpenAI-compatible API."""

import logging

from openai import OpenAI

from services.llm_providers.base import BaseLLMProvider

logger = logging.getLogger(__name__)


class OpenRouterProvider(BaseLLMProvider):
    def __init__(self, api_key: str, model: str) -> None:
        self._client = OpenAI(
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1",
        )
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
            logger.error("OpenRouter returned no choices. Full response: %s", response)
            return ""

        msg = choice.message
        content = msg.content

        # Some "thinking" models put the real answer in content but reasoning in a
        # separate field.  If content is empty, check for reasoning_content fallback.
        if not content:
            reasoning = getattr(msg, "reasoning_content", None) or getattr(msg, "reasoning", None)
            if reasoning:
                logger.warning(
                    "Model returned empty content but has reasoning_content (%d chars). "
                    "Using reasoning as fallback.",
                    len(reasoning),
                )
                content = reasoning

        if not content:
            # Log everything we got so we can diagnose
            finish = choice.finish_reason
            logger.error(
                "OpenRouter returned empty content. finish_reason=%s, "
                "model=%s, message_keys=%s",
                finish,
                response.model,
                list(vars(msg).keys()) if hasattr(msg, "__dict__") else str(msg),
            )
            return ""

        return content

"""Anthropic Claude provider using the anthropic SDK."""

from anthropic import Anthropic

from services.llm_providers.base import BaseLLMProvider


class AnthropicProvider(BaseLLMProvider):
    def __init__(self, api_key: str, model: str) -> None:
        self._client = Anthropic(api_key=api_key)
        self._model = model

    def generate(self, system_prompt: str, user_message: str, max_tokens: int) -> str:
        message = self._client.messages.create(
            model=self._model,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )
        return message.content[0].text

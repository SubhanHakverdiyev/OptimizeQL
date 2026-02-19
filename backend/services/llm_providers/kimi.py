"""Kimi / Moonshot provider using the OpenAI-compatible API."""

from openai import OpenAI

from services.llm_providers.base import BaseLLMProvider


class KimiProvider(BaseLLMProvider):
    def __init__(self, api_key: str, model: str, base_url: str = "https://api.moonshot.cn/v1") -> None:
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
        return response.choices[0].message.content

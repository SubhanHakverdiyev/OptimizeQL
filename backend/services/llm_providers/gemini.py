"""Google Gemini provider using the google-genai SDK."""

from google import genai
from google.genai import types

from services.llm_providers.base import BaseLLMProvider


class GeminiProvider(BaseLLMProvider):
    def __init__(self, api_key: str, model: str) -> None:
        self._client = genai.Client(api_key=api_key)
        self._model = model

    def generate(self, system_prompt: str, user_message: str, max_tokens: int) -> str:
        response = self._client.models.generate_content(
            model=self._model,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                max_output_tokens=max_tokens,
            ),
            contents=user_message,
        )
        return response.text

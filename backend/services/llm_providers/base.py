"""Abstract base for LLM providers."""

from abc import ABC, abstractmethod


class BaseLLMProvider(ABC):
    """Every provider must implement generate()."""

    @abstractmethod
    def generate(self, system_prompt: str, user_message: str, max_tokens: int) -> str:
        """Send a prompt to the LLM and return the raw text response."""

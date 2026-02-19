"""Call the configured LLM provider and parse its JSON response into suggestion categories."""

import json
import logging
import re

from api.models.schemas import AnalysisResult, ConfigurationItem, SuggestionItem
from core.config import settings
from services.llm_providers import get_provider
from services.llm_providers.base import BaseLLMProvider
from services.prompt_builder import PromptBuilder
from services.query_introspector import QueryIntrospectionResult

logger = logging.getLogger(__name__)

# Strip markdown code fences that LLMs sometimes wrap around JSON
_FENCE_RE = re.compile(r"^```(?:json)?\s*\n?(.*?)\n?\s*```$", re.DOTALL)


def _parse_suggestion_list(raw: list) -> list[SuggestionItem]:
    items: list[SuggestionItem] = []
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        impact = entry.get("estimated_impact", "medium")
        if impact not in ("high", "medium", "low"):
            impact = "medium"
        items.append(
            SuggestionItem(
                sql=entry.get("sql") or None,
                explanation=entry.get("explanation", ""),
                estimated_impact=impact,
                plan_node=entry.get("plan_node") or None,
                root_cause=entry.get("root_cause") or None,
                index_type=entry.get("index_type") or None,
            )
        )
    return items


def _parse_configuration_list(raw: list) -> list[ConfigurationItem]:
    items: list[ConfigurationItem] = []
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        impact = entry.get("estimated_impact", "medium")
        if impact not in ("high", "medium", "low"):
            impact = "medium"
        items.append(
            ConfigurationItem(
                parameter=entry.get("parameter", ""),
                current_value=entry.get("current_value", "unknown"),
                recommended_value=entry.get("recommended_value", ""),
                explanation=entry.get("explanation", ""),
                estimated_impact=impact,
            )
        )
    return items


class LLMAnalyzer:
    _instance: "LLMAnalyzer | None" = None

    def __new__(cls) -> "LLMAnalyzer":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._provider = get_provider()
            cls._instance._prompt_builder = PromptBuilder()
        return cls._instance

    def analyze(
        self,
        introspection: QueryIntrospectionResult,
        query_id: str,
        provider_override: BaseLLMProvider | None = None,
    ) -> AnalysisResult:
        provider = provider_override or self._provider
        system_prompt, user_message = self._prompt_builder.build(introspection)

        logger.info(
            "Calling LLM for query_id=%s (override=%s)",
            query_id,
            provider_override is not None,
        )
        raw_text = (
            provider.generate(
                system_prompt=system_prompt,
                user_message=user_message,
                max_tokens=settings.llm_max_tokens,
            )
            or ""
        ).strip()

        logger.debug("Raw LLM response: %s", raw_text[:500] if raw_text else "(empty)")

        if not raw_text:
            logger.error("LLM returned an empty response for query_id=%s", query_id)
            return AnalysisResult(
                query_id=query_id,
                summary=f"The model ({settings.llm_model}) returned an empty response. "
                "This usually means the model is overloaded or does not support structured JSON output. "
                "Try a different model or retry.",
                bottlenecks=[],
                explain_plan=introspection.explain.raw_plan if introspection.explain else None,
                tables_analyzed=introspection.table_names,
            )

        # Strip markdown fences if present
        fence_match = _FENCE_RE.match(raw_text)
        if fence_match:
            raw_text = fence_match.group(1).strip()

        try:
            data = json.loads(raw_text)
        except json.JSONDecodeError as exc:
            logger.error("LLM did not return valid JSON: %s\nRaw: %s", exc, raw_text)
            return AnalysisResult(
                query_id=query_id,
                summary=f"The model ({settings.llm_model}) did not return valid JSON. "
                "Try a more capable model or retry.",
                bottlenecks=[
                    SuggestionItem(
                        explanation=f"Raw model response:\n{raw_text[:1000]}",
                        estimated_impact="low",
                    )
                ],
                explain_plan=introspection.explain.raw_plan if introspection.explain else None,
                tables_analyzed=introspection.table_names,
            )

        return AnalysisResult(
            query_id=query_id,
            summary=data.get("summary", ""),
            indexes=_parse_suggestion_list(data.get("indexes", [])),
            rewrites=_parse_suggestion_list(data.get("rewrites", [])),
            materialized_views=_parse_suggestion_list(data.get("materialized_views", [])),
            bottlenecks=_parse_suggestion_list(data.get("bottlenecks", [])),
            statistics=_parse_suggestion_list(data.get("statistics", [])),
            configuration=_parse_configuration_list(data.get("configuration", [])),
            explain_plan=introspection.explain.raw_plan if introspection.explain else None,
            tables_analyzed=introspection.table_names,
        )

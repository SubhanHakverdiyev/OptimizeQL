"""Tests for LLM response parsing in LLMAnalyzer."""

import json

from api.models.schemas import AnalysisResult
from services.llm_analyzer import _parse_configuration_list, _parse_suggestion_list


class TestParseSuggestionList:
    def test_valid_entries(self):
        raw = [
            {"sql": "CREATE INDEX ...", "explanation": "Speeds up lookup", "estimated_impact": "high"},
            {"explanation": "Minor rewrite", "estimated_impact": "low"},
        ]
        items = _parse_suggestion_list(raw)
        assert len(items) == 2
        assert items[0].estimated_impact == "high"
        assert items[0].sql == "CREATE INDEX ..."
        assert items[1].sql is None

    def test_invalid_impact_defaults_to_medium(self):
        raw = [{"explanation": "test", "estimated_impact": "extreme"}]
        items = _parse_suggestion_list(raw)
        assert items[0].estimated_impact == "medium"

    def test_skips_non_dict_entries(self):
        raw = [{"explanation": "valid"}, "not a dict", 42, None]
        items = _parse_suggestion_list(raw)
        assert len(items) == 1

    def test_empty_list(self):
        assert _parse_suggestion_list([]) == []


class TestParseConfigurationList:
    def test_valid_entries(self):
        raw = [
            {
                "parameter": "work_mem",
                "current_value": "4MB",
                "recommended_value": "64MB",
                "explanation": "Sort spills to disk",
                "estimated_impact": "high",
            }
        ]
        items = _parse_configuration_list(raw)
        assert len(items) == 1
        assert items[0].parameter == "work_mem"

    def test_defaults_for_missing_fields(self):
        raw = [{"explanation": "test"}]
        items = _parse_configuration_list(raw)
        assert items[0].parameter == ""
        assert items[0].current_value == "unknown"
        assert items[0].recommended_value == ""

    def test_empty_list(self):
        assert _parse_configuration_list([]) == []


class TestMarkdownFenceStripping:
    def test_strip_json_fence(self):
        from services.llm_analyzer import _FENCE_RE
        raw = '```json\n{"summary": "test"}\n```'
        match = _FENCE_RE.match(raw)
        assert match is not None
        assert json.loads(match.group(1))["summary"] == "test"

    def test_strip_plain_fence(self):
        from services.llm_analyzer import _FENCE_RE
        raw = '```\n{"summary": "test"}\n```'
        match = _FENCE_RE.match(raw)
        assert match is not None

    def test_no_fence(self):
        from services.llm_analyzer import _FENCE_RE
        raw = '{"summary": "test"}'
        match = _FENCE_RE.match(raw)
        assert match is None

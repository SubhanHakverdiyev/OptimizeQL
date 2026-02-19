"use client";

import type { LLMConfigResponse } from "@/lib/types";
import { activateLLMConfig, deleteLLMConfig } from "@/lib/api-client";

interface LLMConfigListProps {
  configs: LLMConfigResponse[];
  onRefresh: () => void;
}

const providerLabels: Record<string, string> = {
  anthropic:  "Anthropic (Claude)",
  openai:     "OpenAI",
  gemini:     "Google Gemini",
  deepseek:   "DeepSeek",
  xai:        "xAI (Grok)",
  qwen:       "Qwen (Alibaba)",
  meta:       "Meta Llama",
  kimi:       "Kimi / Moonshot",
  openrouter: "OpenRouter",
};

export function LLMConfigList({ configs, onRefresh }: LLMConfigListProps) {
  if (configs.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-gray-400">No LLM configurations yet.</p>
        <p className="text-xs text-gray-300 mt-1">
          Add one to start using a custom LLM provider.
        </p>
      </div>
    );
  }

  const handleActivate = async (id: string) => {
    try {
      await activateLLMConfig(id);
      onRefresh();
    } catch {
      // silent
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLLMConfig(id);
      onRefresh();
    } catch {
      // silent
    }
  };

  return (
    <div className="space-y-3">
      {configs.map((config) => (
        <div
          key={config.id}
          className={`rounded-xl border p-5 transition-shadow hover:shadow-sm ${
            config.is_active
              ? "border-blue-200 bg-blue-50/30"
              : "border-gray-100 bg-white"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 mb-1">
                <h4 className="text-base font-semibold text-gray-900 truncate">
                  {config.name}
                </h4>
                {config.is_active && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Active
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                <span>{providerLabels[config.provider] || config.provider}</span>
                <span className="font-mono text-xs text-gray-300">{config.api_key_preview}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!config.is_active && (
                <button
                  onClick={() => handleActivate(config.id)}
                  className="px-3 py-1.5 text-xs font-medium text-[#1e3a5f] bg-blue-50 border border-blue-100
                             rounded-lg hover:bg-blue-100 transition-colors"
                >
                  Set Active
                </button>
              )}
              <button
                onClick={() => handleDelete(config.id)}
                className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-100
                           rounded-lg hover:bg-red-100 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

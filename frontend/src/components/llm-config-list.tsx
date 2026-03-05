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
              ? "border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/20"
              : "border-(--color-border) bg-(--color-surface)"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 mb-1">
                <h4 className="text-base font-semibold text-(--color-foreground) truncate">
                  {config.name}
                </h4>
                {config.is_active && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Active
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-(--color-text-muted)">
                <span>{providerLabels[config.provider] || config.provider}</span>
                <span className="font-mono text-xs text-(--color-text-faint)">{config.api_key_preview}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!config.is_active && (
                <button
                  onClick={() => handleActivate(config.id)}
                  className="px-3 py-1.5 text-xs font-medium text-[#1e3a5f] dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-800
                             rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                >
                  Set Active
                </button>
              )}
              <button
                onClick={() => handleDelete(config.id)}
                className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800
                           rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
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

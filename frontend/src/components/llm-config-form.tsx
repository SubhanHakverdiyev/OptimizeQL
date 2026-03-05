"use client";

import { useEffect, useState } from "react";
import type { LLMConfigCreate, ProviderInfo } from "@/lib/types";
import { listProviders } from "@/lib/api-client";

interface LLMConfigFormProps {
  onSubmit: (data: LLMConfigCreate) => Promise<void>;
  onCancel: () => void;
}

export function LLMConfigForm({ onSubmit, onCancel }: LLMConfigFormProps) {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<LLMConfigCreate["provider"]>("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listProviders()
      .then((p) => {
        setProviders(p);
        if (p.length > 0) {
          setProvider(p[0].name as LLMConfigCreate["provider"]);
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({ name, provider, api_key: apiKey });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-(--color-border-strong) bg-(--color-surface) p-6 space-y-4"
    >
      <h3 className="text-lg font-semibold text-(--color-foreground)">Add API Key</h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-(--color-text-muted) mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My Gemini Key"
            required
            className="w-full px-3 py-2 border border-(--color-border-strong) rounded-lg text-sm bg-(--color-surface) text-(--color-foreground)
                       focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 focus:border-blue-200 dark:focus:border-blue-700"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-(--color-text-muted) mb-1">Provider</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as LLMConfigCreate["provider"])}
            className="w-full px-3 py-2 border border-(--color-border-strong) rounded-lg text-sm bg-(--color-surface) text-(--color-foreground)
                       focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 focus:border-blue-200 dark:focus:border-blue-700"
          >
            {providers.map((p) => (
              <option key={p.name} value={p.name}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-(--color-text-muted) mb-1">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your API key"
            required
            className="w-full px-3 py-2 border border-(--color-border-strong) rounded-lg text-sm font-mono bg-(--color-surface) text-(--color-foreground)
                       focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 focus:border-blue-200 dark:focus:border-blue-700"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting || !name || !apiKey}
          className="px-4 py-2 bg-[#1e3a5f] dark:bg-blue-600 text-white text-sm font-medium rounded-lg
                     hover:bg-[#2a4d7a] dark:hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-(--color-text-muted) hover:text-(--color-foreground) transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

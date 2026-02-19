"use client";

import { useEffect, useState } from "react";
import type { LLMConfigResponse, ProviderInfo } from "@/lib/types";
import { listLLMConfigs, listProviders } from "@/lib/api-client";

const CUSTOM_SENTINEL = "__custom__";

interface ModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const [configs, setConfigs] = useState<LLMConfigResponse[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isCustom, setIsCustom] = useState(false);

  useEffect(() => {
    Promise.all([listLLMConfigs(), listProviders()])
      .then(([c, p]) => {
        setConfigs(c);
        setProviders(p);

        const active = c.find((cfg) => cfg.is_active);
        if (active) {
          const providerInfo = p.find((pr) => pr.name === active.provider);
          const knownModels = providerInfo?.models ?? [];

          if (!value) {
            // No value yet — auto-select default
            if (providerInfo) onChange(providerInfo.default_model);
          } else if (value && !knownModels.includes(value)) {
            // Stored value is a custom model name
            setIsCustom(true);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeConfig = configs.find((c) => c.is_active);

  if (!loaded) return null;

  // No active provider configured
  if (!activeConfig) {
    return (
      <select
        disabled
        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50
                   text-gray-400 cursor-not-allowed"
      >
        <option>No active LLM — using .env default</option>
      </select>
    );
  }

  const providerInfo = providers.find((p) => p.name === activeConfig.provider);
  const models = providerInfo?.models ?? [];

  const handleSelectChange = (selected: string) => {
    if (selected === CUSTOM_SENTINEL) {
      setIsCustom(true);
      onChange("");
    } else {
      setIsCustom(false);
      onChange(selected);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <select
        value={isCustom ? CUSTOM_SENTINEL : value}
        onChange={(e) => handleSelectChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white
                   focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-200
                   transition-all"
      >
        {models.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
        <option value={CUSTOM_SENTINEL}>Custom model name...</option>
      </select>

      {isCustom && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. my-fine-tuned-model-v2"
          autoFocus
          className="w-full px-3 py-2 border border-blue-200 rounded-xl text-sm font-mono bg-white
                     focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
        />
      )}
    </div>
  );
}

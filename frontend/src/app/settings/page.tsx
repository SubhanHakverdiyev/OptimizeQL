"use client";

import { useCallback, useEffect, useState } from "react";
import { LLMConfigList } from "@/components/llm-config-list";
import { LLMConfigForm } from "@/components/llm-config-form";
import { createLLMConfig, listLLMConfigs } from "@/lib/api-client";
import type { LLMConfigCreate, LLMConfigResponse } from "@/lib/types";

export default function SettingsPage() {
  const [configs, setConfigs] = useState<LLMConfigResponse[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchConfigs = useCallback(async () => {
    try {
      const data = await listLLMConfigs();
      setConfigs(data);
    } catch {
      // silently fail — user will see empty list
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const handleCreate = async (data: LLMConfigCreate) => {
    await createLLMConfig(data);
    setShowForm(false);
    fetchConfigs();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">LLM Settings</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure LLM providers and API keys. The active configuration will be used for query analysis.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-[#1e3a5f] text-white text-sm font-medium rounded-lg hover:bg-[#2a4d7a] transition-colors"
          >
            Add LLM
          </button>
        )}
      </div>

      {showForm && (
        <LLMConfigForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading configurations...</p>
      ) : (
        <LLMConfigList configs={configs} onRefresh={fetchConfigs} />
      )}
    </div>
  );
}

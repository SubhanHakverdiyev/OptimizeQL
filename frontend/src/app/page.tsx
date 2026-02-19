"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SqlEditor } from "@/components/sql-editor";
import { ConnectionSelector } from "@/components/connection-selector";
import { ModelSelector } from "@/components/model-selector";
import { AnalysisResults } from "@/components/analysis-results";
import { listConnections, analyzeQuery } from "@/lib/api-client";
import { useAnalysis } from "@/context/analysis-context";
import type { ConnectionResponse } from "@/lib/types";

function AnalyzePageInner() {
  const searchParams = useSearchParams();
  const {
    sql,
    setSql,
    connectionId,
    setConnectionId,
    result,
    setResult,
    loading,
    setLoading,
    error,
    setError,
  } = useAnalysis();

  const [connections, setConnections] = useState<ConnectionResponse[]>([]);
  const [model, setModel] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("selected-model") ?? "";
    }
    return "";
  });

  const handleModelChange = (m: string) => {
    setModel(m);
    localStorage.setItem("selected-model", m);
  };

  useEffect(() => {
    const sqlParam = searchParams.get("sql");
    if (sqlParam) setSql(sqlParam);
  }, [searchParams, setSql]);

  useEffect(() => {
    listConnections()
      .then(setConnections)
      .catch(() => {});
  }, []);

  const handleAnalyze = async () => {
    if (!sql.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await analyzeQuery({
        sql: sql.trim(),
        connection_id: connectionId,
        model: model || null,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">Analyze SQL Query</h1>
        <p className="text-[15px] text-gray-400 mt-1">
          Paste your query and get AI-powered optimization suggestions.
        </p>
      </div>

      {/* Input area */}
      <div className="space-y-3">
        <SqlEditor value={sql} onChange={setSql} />

        <div className="flex flex-col sm:flex-row gap-3 items-start">
          <div className="flex-1 w-full">
            <ConnectionSelector
              connections={connections}
              value={connectionId}
              onChange={setConnectionId}
            />
          </div>
          <div className="flex-1 w-full">
            <ModelSelector value={model} onChange={handleModelChange} />
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading || !sql.trim()}
            className="px-5 py-2 bg-[#1e3a5f] text-white text-sm font-medium rounded-xl
                       hover:bg-[#2a4d7a] disabled:opacity-40 disabled:cursor-not-allowed
                       transition-all whitespace-nowrap"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analyzing...
              </span>
            ) : (
              "Analyze"
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="pt-4 border-t border-gray-100">
          <AnalysisResults result={result} />
        </div>
      )}
    </div>
  );
}

export default function AnalyzePage() {
  return (
    <Suspense>
      <AnalyzePageInner />
    </Suspense>
  );
}

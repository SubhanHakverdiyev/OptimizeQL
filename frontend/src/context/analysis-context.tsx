"use client";

import { createContext, useCallback, useContext, useState } from "react";
import type { AnalysisResult } from "@/lib/types";

interface AnalysisState {
  sql: string;
  connectionId: string | null;
  result: AnalysisResult | null;
  loading: boolean;
  error: string;
}

interface AnalysisContextValue extends AnalysisState {
  setSql: (sql: string) => void;
  setConnectionId: (id: string | null) => void;
  setResult: (result: AnalysisResult | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string) => void;
  /** Load a completed analysis (from history) without re-running it. */
  loadHistoryResult: (sql: string, result: AnalysisResult) => void;
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

export function AnalysisProvider({ children }: { children: React.ReactNode }) {
  const [sql, setSql] = useState("");
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadHistoryResult = useCallback(
    (historySql: string, historyResult: AnalysisResult) => {
      setSql(historySql);
      setResult(historyResult);
      setError("");
      setLoading(false);
    },
    [],
  );

  return (
    <AnalysisContext.Provider
      value={{
        sql,
        connectionId,
        result,
        loading,
        error,
        setSql,
        setConnectionId,
        setResult,
        setLoading,
        setError,
        loadHistoryResult,
      }}
    >
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis() {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error("useAnalysis must be used within AnalysisProvider");
  return ctx;
}

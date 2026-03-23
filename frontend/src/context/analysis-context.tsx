"use client";

import { createContext, useCallback, useContext, useState } from "react";
import type { AnalysisResult } from "@/lib/types";

interface AnalysisState {
  sql: string;
  connectionId: string | null;
  dbType: string | null;
  playgroundMode: boolean;
  result: AnalysisResult | null;
  loading: boolean;
  error: string;
  historySchemaDDL: string | null;
}

interface AnalysisContextValue extends AnalysisState {
  setSql: (sql: string) => void;
  setConnectionId: (id: string | null) => void;
  setDbType: (dbType: string | null) => void;
  setPlaygroundMode: (v: boolean) => void;
  setResult: (result: AnalysisResult | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string) => void;
  /** Load a completed analysis (from history) without re-running it. */
  loadHistoryResult: (sql: string, result: AnalysisResult, schemaDDL?: string | null) => void;
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

export function AnalysisProvider({ children }: { children: React.ReactNode }) {
  const [sql, setSql] = useState("");
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [dbType, setDbType] = useState<string | null>(null);
  const [playgroundMode, setPlaygroundMode] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [historySchemaDDL, setHistorySchemaDDL] = useState<string | null>(null);

  const loadHistoryResult = useCallback(
    (historySql: string, historyResult: AnalysisResult, schemaDDL?: string | null) => {
      setSql(historySql);
      setResult(historyResult);
      setHistorySchemaDDL(schemaDDL ?? null);
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
        dbType,
        playgroundMode,
        result,
        loading,
        error,
        historySchemaDDL,
        setSql,
        setConnectionId,
        setDbType,
        setPlaygroundMode,
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

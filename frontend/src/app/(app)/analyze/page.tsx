"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SqlEditor } from "@/components/sql-editor";
import { ConnectionSelector } from "@/components/connection-selector";
import { ModelSelector } from "@/components/model-selector";
import { AnalysisResults } from "@/components/analysis-results";
import ModeSelector from "@/components/mode-selector";
import PlaygroundPanel, {
  type SchemaStatus,
} from "@/components/playground-panel";
import { listConnections, analyzeQuery, createShareLink } from "@/lib/api-client";
import { saveAnalysis } from "@/lib/local-history";
import { useAnalysis } from "@/context/analysis-context";
import type { AnalyzeMode, ConnectionResponse } from "@/lib/types";

function AnalyzePageInner() {
  const searchParams = useSearchParams();
  const {
    sql,
    setSql,
    connectionId,
    setConnectionId,
    setDbType,
    setPlaygroundMode,
    result,
    setResult,
    loading,
    setLoading,
    error,
    setError,
    historySchemaDDL,
  } = useAnalysis();

  const [connections, setConnections] = useState<ConnectionResponse[]>([]);
  const [model, setModel] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("selected-model") ?? "";
    }
    return "";
  });

  // ── Mode state ─────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<AnalyzeMode>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("playground-mode") as AnalyzeMode | null;
      if (stored === "connect" || stored === "playground" || stored === "none") return stored;
    }
    return "playground";
  });

  // ── Playground state ──────────────────────────────────────────────────────
  const [schemaDDL, setSchemaDDL] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("playground-schema-ddl") ?? "";
    }
    return "";
  });
  const [playgroundQuery, setPlaygroundQuery] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("playground-query-sql") ?? "";
    }
    return "";
  });
  const [schemaStatus, setSchemaStatus] = useState<SchemaStatus>({
    state: "empty",
  });
  const [playgroundSubTab, setPlaygroundSubTab] = useState<"schema" | "query" | "data">("schema");
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const autoAnalyzeRef = useRef(false);

  const handleModelChange = (m: string) => {
    setModel(m);
    localStorage.setItem("selected-model", m);
  };

  const handleModeChange = (m: AnalyzeMode) => {
    setMode(m);
    localStorage.setItem("playground-mode", m);
    // Clear previous results when switching modes
    setResult(null);
    setError("");
  };

  useEffect(() => {
    const sqlParam = searchParams.get("sql");
    if (sqlParam) setSql(sqlParam);
  }, [searchParams, setSql]);

  // Restore schema DDL from history into playground state
  useEffect(() => {
    if (historySchemaDDL) {
      setSchemaDDL(historySchemaDDL);
      setMode("playground");
    }
  }, [historySchemaDDL]);

  // ── Landing page handoff: pick up sessionStorage and auto-load ──────────
  useEffect(() => {
    const landingSchema = sessionStorage.getItem("landing-schema");
    const landingQuery = sessionStorage.getItem("landing-query");
    if (landingSchema && landingQuery) {
      sessionStorage.removeItem("landing-schema");
      sessionStorage.removeItem("landing-query");
      setSchemaDDL(landingSchema);
      setPlaygroundQuery(landingQuery);
      setMode("playground");
      localStorage.setItem("playground-mode", "playground");
      localStorage.setItem("playground-schema-ddl", landingSchema);
      localStorage.setItem("playground-query-sql", landingQuery);
      autoAnalyzeRef.current = true;
      return;
    }

    // Quick Analyze handoff (no-connection mode)
    const quickSql = sessionStorage.getItem("landing-quick-sql");
    if (quickSql) {
      sessionStorage.removeItem("landing-quick-sql");
      setSql(quickSql);
      setMode("none");
      localStorage.setItem("playground-mode", "none");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isHosted = !!(process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes("localhost"));

  useEffect(() => {
    if (isHosted) return;
    listConnections()
      .then((conns) => {
        setConnections(conns);
        // Default to "connect" if connections exist and no mode was stored
        if (conns.length > 0 && !localStorage.getItem("playground-mode")) {
          setMode("connect");
        }
      })
      .catch(() => {});
  }, [isHosted]);

  // ── Standard analyze (connect / no-connection mode) ────────────────────────
  const handleAnalyze = async () => {
    if (!sql.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    setPlaygroundMode(false);
    try {
      const res = await analyzeQuery({
        sql: sql.trim(),
        connection_id: connectionId,
        model: model || null,
      });
      setResult(res);
      if (isHosted) saveAnalysis(sql.trim(), res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  // ── Playground: Load Schema ────────────────────────────────────────────────
  const handleLoadSchema = useCallback(async () => {
    if (!schemaDDL.trim()) return;
    setSchemaStatus({ state: "loading" });

    try {
      const pglite = await import("@/lib/pglite-service");
      await pglite.reset();
      const { tables, error: ddlError } = await pglite.executeDDL(schemaDDL);

      if (ddlError) {
        setSchemaStatus({ state: "error", message: ddlError });
        return;
      }
      if (tables.length === 0) {
        setSchemaStatus({
          state: "error",
          message: "No tables created. Check your DDL syntax.",
        });
        return;
      }

      // Ensure planner settings are at defaults
      await pglite.resetPlannerSettings();

      setSchemaStatus({ state: "ready", tables });
    } catch (err) {
      setSchemaStatus({
        state: "error",
        message: err instanceof Error ? err.message : "Failed to load schema",
      });
    }
  }, [schemaDDL]);

  // ── Auto-load schema from landing page handoff ───────────────────────────
  useEffect(() => {
    if (autoAnalyzeRef.current && schemaDDL.trim() && schemaStatus.state === "empty") {
      handleLoadSchema();
    }
  }, [schemaDDL, schemaStatus.state, handleLoadSchema]);

  // ── Playground: Analyze ────────────────────────────────────────────────────
  const handlePlaygroundAnalyze = async () => {
    if (!playgroundQuery.trim()) return;
    if (schemaStatus.state !== "ready") {
      setError("Load your schema first before analyzing.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setPlaygroundMode(true);
    setDbType("postgresql");
    setSql(playgroundQuery.trim());

    try {
      const pglite = await import("@/lib/pglite-service");

      // Regenerate data with query hints so filter values exist in the dataset
      const { generateAndInsertData } = await import("@/lib/data-generator");
      const pgInstance = await pglite.getDB();
      // Truncate existing data before regenerating
      for (const t of schemaStatus.tables || []) {
        await pgInstance.exec(`TRUNCATE TABLE "${t}" CASCADE`);
      }
      const { emptyTables } = await generateAndInsertData(
        schemaDDL,
        schemaStatus.tables || [],
        pgInstance,
        10000,
        playgroundQuery,
      );
      if (emptyTables.length > 0) {
        setError(
          `Data generation failed for table(s): ${emptyTables.join(", ")}. ` +
          `Check that your DDL column types and constraints are compatible.`,
        );
        setLoading(false);
        return;
      }
      await pglite.resetPlannerSettings();

      const explainResult = await pglite.runExplainAnalyze(playgroundQuery);
      const tableSchemas = await pglite.getTableSchemas(
        schemaStatus.tables,
      );

      const res = await analyzeQuery({
        sql: playgroundQuery.trim(),
        model: model || null,
        client_explain: explainResult,
        client_table_schemas: tableSchemas,
        client_db_type: "postgresql",
      });
      setResult(res);
      if (isHosted) saveAnalysis(playgroundQuery.trim(), res, schemaDDL);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  // ── Auto-analyze once schema is ready from landing handoff ──────────────
  useEffect(() => {
    if (autoAnalyzeRef.current && schemaStatus.state === "ready") {
      autoAnalyzeRef.current = false;
      handlePlaygroundAnalyze();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schemaStatus.state]);

  // ── Playground: Reset ──────────────────────────────────────────────────────
  const handleReset = async () => {
    const pglite = await import("@/lib/pglite-service");
    await pglite.reset();
    setSchemaStatus({ state: "empty" });
    setResult(null);
    setError("");
  };

  // ── Share ──────────────────────────────────────────────────────────────────
  const handleShare = async () => {
    if (!result) return;
    setSharing(true);
    setShareUrl(null);
    try {
      const link = await createShareLink({
        schema_ddl: mode === "playground" ? schemaDDL || null : null,
        sql_query: mode === "playground" ? playgroundQuery.trim() : sql.trim(),
        llm_response: JSON.stringify(result),
      });
      const url = `${window.location.origin}/p/${link.id}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
    } catch {
      setError("Failed to create share link");
    } finally {
      setSharing(false);
    }
  };

  // Determine which analyze function to call
  const onAnalyze =
    mode === "playground" ? handlePlaygroundAnalyze : handleAnalyze;
  const analyzeDisabled =
    mode === "playground"
      ? loading || !playgroundQuery.trim() || schemaStatus.state !== "ready"
      : loading || !sql.trim();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-(--color-foreground)">
            Analyze SQL Query
          </h1>
          <p className="text-[15px] text-(--color-text-faint) mt-1">
            {mode === "playground"
              ? "Paste your schema, load it into the browser database, then analyze your query."
              : "Paste your query and get AI-powered optimization suggestions."}
          </p>
        </div>
        <ModeSelector mode={mode} onChange={handleModeChange} />
      </div>

      {/* Input area — varies by mode */}
      <div className="space-y-3">
        {mode === "playground" ? (
          <PlaygroundPanel
            schemaDDL={schemaDDL}
            onSchemaDDLChange={setSchemaDDL}
            querySql={playgroundQuery}
            onQuerySqlChange={setPlaygroundQuery}
            schemaStatus={schemaStatus}
            onLoadSchema={handleLoadSchema}
            onReset={handleReset}
            onSubTabChange={setPlaygroundSubTab}
          />
        ) : (
          <SqlEditor value={sql} onChange={setSql} />
        )}

        {(mode === "connect" || playgroundSubTab === "query") && (
        <div className="flex flex-col sm:flex-row gap-3 items-start">
          {mode === "connect" && (
            <div className="flex-1 w-full">
              <ConnectionSelector
                connections={connections}
                value={connectionId}
                onChange={(id) => {
                  setConnectionId(id);
                  const conn = connections.find((c) => c.id === id);
                  setDbType(conn?.db_type ?? null);
                }}
              />
            </div>
          )}
          {!isHosted && (
            <div className="flex-1 w-full">
              <ModelSelector value={model} onChange={handleModelChange} />
            </div>
          )}
          <button
            onClick={onAnalyze}
            disabled={analyzeDisabled}
            className="px-5 py-2 bg-[#1e3a5f] dark:bg-blue-600 text-white text-sm font-medium rounded-xl
                       hover:bg-[#2a4d7a] dark:hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed
                       transition-all whitespace-nowrap"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Analyzing...
              </span>
            ) : (
              "Analyze"
            )}
          </button>
        </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 px-4 py-3">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="pt-4 border-t border-(--color-border)">
          <div className="flex items-center justify-end mb-3 gap-2">
            {shareUrl && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400">
                Link copied!
              </span>
            )}
            <button
              onClick={handleShare}
              disabled={sharing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                         border border-(--color-border) text-(--color-text-muted)
                         hover:bg-gray-50 dark:hover:bg-white/5 transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15m0-3-3-3m0 0-3 3m3-3v11.25" />
              </svg>
              {sharing ? "Sharing..." : "Share"}
            </button>
          </div>
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

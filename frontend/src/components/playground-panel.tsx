"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Editor from "@monaco-editor/react";
import { useTheme } from "@/context/theme-context";
import { PRESETS } from "@/lib/playground-presets";

interface TablePreview {
  name: string;
  rowCount: number;
  columns: string[];
  rows: Record<string, unknown>[];
}

export type SchemaStatus =
  | { state: "empty" }
  | { state: "loading" }
  | { state: "ready"; tables: string[] }
  | { state: "error"; message: string };

interface PlaygroundPanelProps {
  schemaDDL: string;
  onSchemaDDLChange: (ddl: string) => void;
  querySql: string;
  onQuerySqlChange: (sql: string) => void;
  schemaStatus: SchemaStatus;
  onLoadSchema: () => void;
  onReset: () => void;
  onSubTabChange?: (tab: "schema" | "query" | "data") => void;
}

type SubTab = "schema" | "query" | "data";

const SCHEMA_PLACEHOLDER = `-- Paste your schema here (CREATE TABLE, CREATE INDEX, etc.)
-- Or click a preset below to load an example.
--
-- Example:
-- CREATE TABLE users (
--   id SERIAL PRIMARY KEY,
--   email VARCHAR(255) NOT NULL,
--   created_at TIMESTAMP DEFAULT NOW()
-- );`;

const QUERY_PLACEHOLDER = `-- Write the query you want to optimize
-- Example:
-- SELECT * FROM users WHERE email = 'test@example.com';`;

export default function PlaygroundPanel({
  schemaDDL,
  onSchemaDDLChange,
  querySql,
  onQuerySqlChange,
  schemaStatus,
  onLoadSchema,
  onReset,
  onSubTabChange,
}: PlaygroundPanelProps) {
  const [subTab, setSubTab] = useState<SubTab>("schema");
  const { theme } = useTheme();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const changeSubTab = useCallback(
    (tab: SubTab) => {
      setSubTab(tab);
      onSubTabChange?.(tab);
    },
    [onSubTabChange],
  );

  // Data tab state
  const [tablePreviews, setTablePreviews] = useState<TablePreview[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  // Persist DDL to localStorage with debounce
  const handleDDLChange = useCallback(
    (val: string) => {
      onSchemaDDLChange(val);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        localStorage.setItem("playground-schema-ddl", val);
      }, 500);
    },
    [onSchemaDDLChange],
  );

  // Persist query to localStorage with debounce
  const handleQueryChange = useCallback(
    (val: string) => {
      onQuerySqlChange(val);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        localStorage.setItem("playground-query-sql", val);
      }, 500);
    },
    [onQuerySqlChange],
  );

  // Load preset
  const handlePreset = (presetName: string) => {
    const preset = PRESETS.find((p) => p.name === presetName);
    if (!preset) return;
    onSchemaDDLChange(preset.ddl);
    onQuerySqlChange(preset.sampleQuery);
    localStorage.setItem("playground-schema-ddl", preset.ddl);
    localStorage.setItem("playground-query-sql", preset.sampleQuery);
    changeSubTab("schema");
  };

  // Load table data when switching to Data tab or schema becomes ready
  const loadTableData = useCallback(async () => {
    if (schemaStatus.state !== "ready") return;
    setDataLoading(true);
    try {
      const pglite = await import("@/lib/pglite-service");
      const db = await pglite.getDB();
      const previews: TablePreview[] = [];

      for (const table of schemaStatus.tables) {
        const countRes = await db.query<{ count: number }>(
          `SELECT COUNT(*)::int AS count FROM "${table}"`,
        );
        const rowCount = countRes.rows[0]?.count ?? 0;

        const sampleRes = await db.query(
          `SELECT * FROM "${table}" LIMIT 20`,
        );
        const columns = sampleRes.fields?.map((f: { name: string }) => f.name) ?? [];

        previews.push({
          name: table,
          rowCount,
          columns,
          rows: sampleRes.rows as Record<string, unknown>[],
        });
      }

      setTablePreviews(previews);
      if (previews.length > 0 && !selectedTable) {
        setSelectedTable(previews[0].name);
      }
    } catch (err) {
      console.warn("[playground] Failed to load table data:", err);
    } finally {
      setDataLoading(false);
    }
  }, [schemaStatus, selectedTable]);

  useEffect(() => {
    if (subTab === "data" && schemaStatus.state === "ready") {
      loadTableData();
    }
  }, [subTab, schemaStatus, loadTableData]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const editorOptions = {
    minimap: { enabled: false },
    fontSize: 14,
    lineNumbers: "off" as const,
    scrollBeyondLastLine: false,
    wordWrap: "on" as const,
    padding: { top: 16, bottom: 16 },
    renderLineHighlight: "none" as const,
    overviewRulerLanes: 0,
    hideCursorInOverviewRuler: true,
    scrollbar: { vertical: "auto" as const, horizontal: "hidden" as const },
    suggest: { showKeywords: true },
    folding: false,
    glyphMargin: false,
    lineDecorationsWidth: 16,
    lineNumbersMinChars: 0,
  };

  return (
    <div className="space-y-3">
      {/* Sub-tabs + Status */}
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-0.5 gap-0.5">
          <button
            onClick={() => changeSubTab("schema")}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
              subTab === "schema"
                ? "bg-[#1e3a5f] text-white shadow-sm"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)]"
            }`}
          >
            Schema (DDL)
          </button>
          <button
            onClick={() => changeSubTab("query")}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
              subTab === "query"
                ? "bg-[#1e3a5f] text-white shadow-sm"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)]"
            }`}
          >
            Query
          </button>
          {schemaStatus.state === "ready" && (
            <button
              onClick={() => changeSubTab("data")}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                subTab === "data"
                  ? "bg-[#1e3a5f] text-white shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)]"
              }`}
            >
              Data
            </button>
          )}
        </div>

        {/* Schema status badge */}
        <div className="text-sm">
          {schemaStatus.state === "empty" && (
            <span className="text-[var(--color-text-faint)]">No schema loaded</span>
          )}
          {schemaStatus.state === "loading" && (
            <span className="text-blue-500 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading schema...
            </span>
          )}
          {schemaStatus.state === "ready" && (
            <span className="text-emerald-600 dark:text-emerald-400">
              {schemaStatus.tables.length} table{schemaStatus.tables.length !== 1 ? "s" : ""} ready
              <span className="text-[var(--color-text-faint)] ml-1">
                ({schemaStatus.tables.join(", ")})
              </span>
            </span>
          )}
          {schemaStatus.state === "error" && (
            <span className="text-red-500">
              Error: {schemaStatus.message}
            </span>
          )}
        </div>
      </div>

      {/* Editor area */}
      <div className="relative rounded-xl overflow-hidden border border-(--color-border-strong)
                      focus-within:ring-2 focus-within:ring-blue-100 dark:focus-within:ring-blue-900
                      focus-within:border-blue-200 dark:focus-within:border-blue-700 transition-all">
        {subTab === "schema" && (
          <>
            <Editor
              height="240px"
              language="sql"
              theme={theme === "dark" ? "vs-dark" : "vs"}
              value={schemaDDL}
              onChange={(val) => handleDDLChange(val ?? "")}
              options={editorOptions}
            />
            {!schemaDDL && (
              <div className="absolute top-4 left-4 pointer-events-none text-sm text-(--color-text-faint) font-mono whitespace-pre">
                {SCHEMA_PLACEHOLDER}
              </div>
            )}
          </>
        )}
        {subTab === "query" && (
          <>
            <Editor
              height="176px"
              language="sql"
              theme={theme === "dark" ? "vs-dark" : "vs"}
              value={querySql}
              onChange={(val) => handleQueryChange(val ?? "")}
              options={editorOptions}
            />
            {!querySql && (
              <div className="absolute top-4 left-4 pointer-events-none text-sm text-(--color-text-faint) font-mono whitespace-pre">
                {QUERY_PLACEHOLDER}
              </div>
            )}
          </>
        )}
        {subTab === "data" && (
          <div className="h-[280px] flex flex-col">
            {dataLoading ? (
              <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-text-faint)]">
                <svg className="w-4 h-4 animate-spin mr-2" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading data...
              </div>
            ) : tablePreviews.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-text-faint)]">
                No tables found. Load a schema first.
              </div>
            ) : (
              <>
                {/* Table selector tabs */}
                <div className="flex items-center gap-1 px-3 pt-2 pb-1 border-b border-[var(--color-border)] overflow-x-auto flex-shrink-0">
                  {tablePreviews.map((tp) => (
                    <button
                      key={tp.name}
                      onClick={() => setSelectedTable(tp.name)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                        selectedTable === tp.name
                          ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]"
                      }`}
                    >
                      {tp.name}
                      <span className="ml-1 text-[10px] opacity-60">({tp.rowCount.toLocaleString()})</span>
                    </button>
                  ))}
                  <button
                    onClick={loadTableData}
                    className="ml-auto px-1.5 py-1 text-xs text-[var(--color-text-faint)] hover:text-[var(--color-text)] transition-colors"
                    title="Refresh data"
                  >
                    ↻
                  </button>
                </div>
                {/* Table data grid */}
                {(() => {
                  const preview = tablePreviews.find((tp) => tp.name === selectedTable);
                  if (!preview) return null;
                  return (
                    <div className="flex-1 overflow-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead className="sticky top-0 z-10">
                          <tr>
                            {preview.columns.map((col) => (
                              <th
                                key={col}
                                className="px-2.5 py-1.5 text-left font-semibold text-[var(--color-text-muted)] bg-[var(--color-surface)] dark:bg-[var(--color-surface-muted)] border-b border-[var(--color-border)] whitespace-nowrap"
                              >
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {preview.rows.map((row, i) => (
                            <tr
                              key={i}
                              className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
                            >
                              {preview.columns.map((col) => {
                                const val = row[col];
                                const display =
                                  val === null
                                    ? "NULL"
                                    : typeof val === "object"
                                      ? JSON.stringify(val)
                                      : String(val);
                                return (
                                  <td
                                    key={col}
                                    className={`px-2.5 py-1.5 whitespace-nowrap max-w-[200px] truncate ${
                                      val === null
                                        ? "text-[var(--color-text-faint)] italic"
                                        : "text-[var(--color-text)]"
                                    }`}
                                    title={display}
                                  >
                                    {display}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {preview.rowCount > 20 && (
                        <div className="px-3 py-1.5 text-[10px] text-[var(--color-text-faint)] border-t border-[var(--color-border)]">
                          Showing 20 of {preview.rowCount.toLocaleString()} rows
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}
      </div>

      {/* Schema tab actions */}
      {subTab === "schema" && (
        <div className="flex items-center justify-between">
          {/* Presets */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--color-text-secondary)]">Presets:</span>
            {PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => handlePreset(preset.name)}
                className="px-2.5 py-1 text-xs font-medium rounded-lg
                          border border-[var(--color-border)]
                          text-[var(--color-text-secondary)]
                          hover:bg-[var(--color-bg-tertiary)]
                          hover:text-[var(--color-text)]
                          transition-colors"
                title={preset.description}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Load / Reset */}
          <div className="flex items-center gap-2">
            {schemaStatus.state === "ready" && (
              <button
                onClick={onReset}
                className="px-3 py-1.5 text-xs font-medium text-red-500
                          hover:text-red-600 transition-colors"
              >
                Reset
              </button>
            )}
            <button
              onClick={onLoadSchema}
              disabled={!schemaDDL.trim() || schemaStatus.state === "loading"}
              className="px-4 py-1.5 text-sm font-semibold rounded-lg
                        bg-emerald-600 text-white
                        hover:bg-emerald-700 transition-colors
                        disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {schemaStatus.state === "loading" ? "Loading..." : "Load Schema"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

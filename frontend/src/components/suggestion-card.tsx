"use client";

import { useState } from "react";
import type { SuggestionItem, CompareResult, SimulateIndexResult } from "@/lib/types";
import { compareQueries, simulateIndex } from "@/lib/api-client";
import { ImpactBadge } from "./impact-badge";
import { SqlHighlight } from "./sql-highlight";
import { CopyButton } from "./copy-button";

function parseTotalCost(plan: unknown): number {
  try {
    const parsed = typeof plan === "string" ? JSON.parse(plan) : plan;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = Array.isArray(parsed) ? (parsed as any[])[0]?.Plan : (parsed as any)?.Plan;
    return node?.["Total Cost"] ?? 0;
  } catch {
    return 0;
  }
}

interface SuggestionCardProps {
  item: SuggestionItem;
  originalSql?: string;
  connectionId?: string | null;
  /** Original SELECT query for index simulation */
  querySql?: string;
  /** Database type — "postgresql" enables simulation */
  dbType?: string | null;
  /** When true, run compare/simulate via PGlite instead of the API */
  playgroundMode?: boolean;
}

export function SuggestionCard({ item, originalSql, connectionId, querySql, dbType, playgroundMode }: SuggestionCardProps) {
  const [comparing, setComparing] = useState(false);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [compareError, setCompareError] = useState("");

  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<SimulateIndexResult | null>(null);
  const [simError, setSimError] = useState("");

  const canCompare = !!(item.sql && originalSql && (connectionId || playgroundMode));
  const canSimulate = !!(item.sql && querySql && (connectionId || playgroundMode) && dbType === "postgresql" && item.index_type);

  async function handleCompare() {
    if (!item.sql || !originalSql) return;
    setComparing(true);
    setCompareResult(null);
    setCompareError("");
    try {
      if (playgroundMode) {
        const pglite = await import("@/lib/pglite-service");
        const db = await pglite.getDB();
        const [origRes, rewrittenRes] = await Promise.all([
          db.query(originalSql),
          db.query(item.sql),
        ]);
        const origRows = origRes.rows;
        const rewrittenRows = rewrittenRes.rows;
        const maxRows = Math.max(origRows.length, rewrittenRows.length);
        let firstDiff: CompareResult["first_diff"] = null;
        let match = origRows.length === rewrittenRows.length;
        let orderDiffers = false;
        if (match) {
          for (let i = 0; i < maxRows; i++) {
            if (JSON.stringify(origRows[i]) !== JSON.stringify(rewrittenRows[i])) {
              match = false;
              firstDiff = { row_number: i + 1, original_row: origRows[i] as unknown as unknown[], rewritten_row: rewrittenRows[i] as unknown as unknown[] };
              break;
            }
          }
        }
        // If order-sensitive comparison failed, try order-insensitive
        if (!match && origRows.length === rewrittenRows.length) {
          const toSorted = (rows: unknown[]) =>
            rows.map((r) => JSON.stringify(r)).sort();
          const sortedOrig = toSorted(origRows);
          const sortedRewritten = toSorted(rewrittenRows);
          const setsMatch = sortedOrig.every((r, i) => r === sortedRewritten[i]);
          if (setsMatch) {
            match = true;
            orderDiffers = true;
            firstDiff = null;
          }
        }
        setCompareResult({
          results_match: match,
          order_differs: orderDiffers,
          rows_compared: Math.min(origRows.length, rewrittenRows.length),
          original_row_count: origRows.length,
          rewritten_row_count: rewrittenRows.length,
          first_diff: firstDiff,
          original_error: null,
          rewritten_error: null,
        });
      } else {
        if (!connectionId) return;
        const result = await compareQueries({
          original_sql: originalSql,
          rewritten_sql: item.sql,
          connection_id: connectionId,
        });
        setCompareResult(result);
      }
    } catch (err) {
      setCompareError(err instanceof Error ? err.message : "Comparison failed");
    } finally {
      setComparing(false);
    }
  }

  async function handleSimulate() {
    if (!item.sql || !querySql) return;
    setSimulating(true);
    setSimResult(null);
    setSimError("");
    try {
      if (playgroundMode) {
        const pglite = await import("@/lib/pglite-service");
        const db = await pglite.getDB();
        await pglite.resetPlannerSettings();

        // Discover all public tables so we can inflate every one
        const tablesRes = await db.query<{ table_name: string }>(
          `SELECT table_name FROM information_schema.tables
           WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
        );
        const allTables = tablesRes.rows.map((r) => r.table_name);

        // ── BEFORE: inflate stats → EXPLAIN ──────────────────────
        await pglite.inflateTableStats(allTables);
        const beforeExplain = await db.query<{ "QUERY PLAN": string }>(
          `EXPLAIN (FORMAT JSON) ${querySql}`,
        );
        const beforePlan = beforeExplain.rows[0]?.["QUERY PLAN"];
        const beforeCost = parseTotalCost(beforePlan);

        // ── CREATE INDEX → re-inflate (ANALYZE resets pg_class) → EXPLAIN ──
        await db.exec(item.sql);
        await pglite.inflateTableStats(allTables);
        const afterExplain = await db.query<{ "QUERY PLAN": string }>(
          `EXPLAIN (FORMAT JSON) ${querySql}`,
        );
        const afterPlan = afterExplain.rows[0]?.["QUERY PLAN"];
        const afterCost = parseTotalCost(afterPlan);

        // ── Cleanup: drop index + restore real stats ─────────────
        const idxNameMatch = item.sql.match(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i);
        if (idxNameMatch) {
          await db.exec(`DROP INDEX IF EXISTS ${idxNameMatch[1]}`);
        }
        await pglite.runAnalyze(); // restore real pg_class stats

        const reduction = beforeCost > 0 ? Math.round(((beforeCost - afterCost) / beforeCost) * 100) : 0;
        setSimResult({
          success: true,
          error: null,
          hypopg_available: true,
          original_cost: beforeCost,
          simulated_cost: afterCost,
          cost_reduction_pct: reduction,
          original_plan: JSON.stringify(beforePlan, null, 2),
          simulated_plan: JSON.stringify(afterPlan, null, 2),
          node_changes: [],
        });
      } else {
        if (!connectionId) return;
        const result = await simulateIndex({
          index_sql: item.sql,
          query_sql: querySql,
          connection_id: connectionId,
        });
        setSimResult(result);
      }
    } catch (err) {
      setSimError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setSimulating(false);
    }
  }

  return (
    <div className="rounded-xl border border-(--color-border) bg-(--color-surface) p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <p className="text-base leading-[1.75] text-(--color-foreground) flex-1">
          {item.explanation}
        </p>
        <ImpactBadge impact={item.estimated_impact} />
      </div>
      {(item.plan_node || item.root_cause || item.index_type) && (
        <div className="flex flex-wrap gap-2 mt-2.5">
          {item.plan_node && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-[12px] font-mono text-(--color-text-muted)">
              {item.plan_node}
            </span>
          )}
          {item.root_cause && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-orange-50 dark:bg-orange-900/30 text-[12px] font-medium text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-800">
              {item.root_cause.replace(/_/g, " ")}
            </span>
          )}
          {item.index_type && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/30 text-[12px] font-medium text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800">
              {item.index_type.toUpperCase()}
            </span>
          )}
        </div>
      )}
      {item.sql && (
        <div className="mt-4">
          <div className="relative">
            <SqlHighlight code={item.sql} />
            <div className="absolute top-2 right-2">
              <CopyButton text={item.sql} />
            </div>
          </div>
          {(canSimulate || canCompare) && (
            <div className="flex justify-end gap-1.5 mt-2">
              {canSimulate && (
                <button
                  onClick={handleSimulate}
                  disabled={simulating}
                  className="px-2.5 py-1 rounded-md text-[12px] font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors disabled:opacity-50"
                >
                  {simulating ? "Simulating..." : "Simulate"}
                </button>
              )}
              {canCompare && (
                <button
                  onClick={handleCompare}
                  disabled={comparing}
                  className="px-2.5 py-1 rounded-md text-[12px] font-medium bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors disabled:opacity-50"
                >
                  {comparing ? "Comparing..." : "Verify"}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Index simulation result */}
      {simResult && simResult.success && (
        <SimulationResultPanel result={simResult} />
      )}

      {/* Simulation not available (hypopg missing) */}
      {simResult && !simResult.success && !simResult.hypopg_available && (
        <div className="mt-3 rounded-lg px-4 py-3 text-[13px] bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300">
          <p className="font-medium mb-1">HypoPG extension not available</p>
          <p className="text-[12px] opacity-80">
            Install it on your PostgreSQL server to enable index simulation:{" "}
            <code className="bg-blue-100 dark:bg-blue-800/50 px-1.5 py-0.5 rounded text-[11px]">
              CREATE EXTENSION hypopg;
            </code>
          </p>
        </div>
      )}

      {/* Simulation error */}
      {simResult && !simResult.success && simResult.hypopg_available && simResult.error && (
        <div className="mt-3 rounded-lg overflow-hidden border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
            </svg>
            <span className="text-[13px] font-semibold">Simulation Failed</span>
          </div>
          <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20">
            <pre className="font-mono text-[13px] leading-relaxed text-red-800 dark:text-red-300 whitespace-pre-wrap">{simResult.error}</pre>
          </div>
        </div>
      )}

      {simError && (
        <div className="mt-3 rounded-lg overflow-hidden border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
            </svg>
            <span className="text-[13px] font-semibold">Simulation Error</span>
          </div>
          <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20">
            <pre className="font-mono text-[13px] leading-relaxed text-red-800 dark:text-red-300 whitespace-pre-wrap">{simError}</pre>
          </div>
        </div>
      )}

      {/* Comparison result */}
      {compareResult && !compareResult.original_error && !compareResult.rewritten_error && (
        <div
          className={`mt-3 rounded-lg px-4 py-3 text-[13px] ${
            compareResult.results_match
              ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
              : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
          }`}
        >
          {compareResult.results_match ? (
            <p>
              Results match — {compareResult.rows_compared} rows compared, outputs are identical.
              {compareResult.order_differs && (
                <span className="block text-[12px] mt-1 opacity-80">
                  Note: Row order differs (no ORDER BY clause). Data content is the same.
                </span>
              )}
            </p>
          ) : (
            <>
              <p>
                Results differ — compared {compareResult.rows_compared} rows
                (original: {compareResult.original_row_count}, rewritten: {compareResult.rewritten_row_count}).
              </p>
              {compareResult.first_diff && (
                <div className="mt-2 font-mono text-[11px] space-y-1">
                  <p>First diff at row {compareResult.first_diff.row_number}:</p>
                  <p className="text-red-600">- {JSON.stringify(compareResult.first_diff.original_row)}</p>
                  <p className="text-emerald-600">+ {JSON.stringify(compareResult.first_diff.rewritten_row)}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Rewritten query error — IDE-inspired styling */}
      {compareResult?.rewritten_error && (
        <div className="mt-3 rounded-lg overflow-hidden border border-red-200">
          <div className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
            </svg>
            <span className="text-[13px] font-semibold">Rewritten Query Error</span>
          </div>
          <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20">
            <pre className="font-mono text-[13px] leading-relaxed text-red-800 dark:text-red-300 whitespace-pre-wrap">{compareResult.rewritten_error}</pre>
          </div>
        </div>
      )}

      {compareError && (
        <div className="mt-3 rounded-lg overflow-hidden border border-red-200">
          <div className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
            </svg>
            <span className="text-[13px] font-semibold">Comparison Failed</span>
          </div>
          <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20">
            <pre className="font-mono text-[13px] leading-relaxed text-red-800 dark:text-red-300 whitespace-pre-wrap">{compareError}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

function SimulationResultPanel({ result }: { result: SimulateIndexResult }) {
  const [showPlans, setShowPlans] = useState(false);
  const pct = result.cost_reduction_pct ?? 0;

  const panelColor =
    pct > 50
      ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
      : pct > 10
        ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
        : "bg-gray-50 dark:bg-gray-800/50 border-(--color-border)";

  const pctColor =
    pct > 50
      ? "text-emerald-700 dark:text-emerald-300"
      : pct > 10
        ? "text-amber-700 dark:text-amber-300"
        : "text-(--color-text-muted)";

  const barColor =
    pct > 50
      ? "bg-emerald-500"
      : pct > 10
        ? "bg-amber-500"
        : "bg-gray-400";

  function formatCost(cost: number | null): string {
    if (cost === null) return "—";
    return cost >= 1000 ? cost.toLocaleString("en-US", { maximumFractionDigits: 0 }) : cost.toFixed(2);
  }

  return (
    <div className={`mt-3 rounded-lg border p-4 ${panelColor}`}>
      <div className="flex items-center gap-2 mb-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={pctColor} strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
        <span className={`text-[13px] font-semibold ${pctColor}`}>Index Simulation Result</span>
      </div>

      {/* Cost reduction bar */}
      <div className="mb-3">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-[12px] text-(--color-text-muted)">Estimated Cost Reduction</span>
          <span className={`text-lg font-bold ${pctColor}`}>
            {pct > 0 ? `${pct}%` : "No improvement"}
          </span>
        </div>
        <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            className={`h-full rounded-full ${barColor} transition-all`}
            style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-[11px] text-(--color-text-faint)">
          <span>Before: {formatCost(result.original_cost)}</span>
          <span>After: {formatCost(result.simulated_cost)}</span>
        </div>
      </div>

      {/* Plan node changes */}
      {result.node_changes.length > 0 && (
        <div className="space-y-1.5 mb-3">
          <p className="text-[12px] font-medium text-(--color-text-muted)">Plan Changes</p>
          {result.node_changes.map((change, i) => (
            <div key={i} className="flex flex-col gap-0.5 text-[12px] font-mono">
              <div className="flex items-center gap-2">
                <span className="text-red-500 dark:text-red-400 shrink-0">✕</span>
                <span className="text-red-600 dark:text-red-400">{change.before}</span>
                <span className="text-(--color-text-faint) ml-auto">cost: {formatCost(change.cost_before)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-500 dark:text-emerald-400 shrink-0">✓</span>
                <span className="text-emerald-600 dark:text-emerald-400">{change.after}</span>
                <span className="text-(--color-text-faint) ml-auto">cost: {formatCost(change.cost_after)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Collapsible full plans */}
      {(result.original_plan || result.simulated_plan) && (
        <button
          onClick={() => setShowPlans(!showPlans)}
          className="text-[12px] font-medium text-(--color-text-muted) hover:text-(--color-foreground) transition-colors flex items-center gap-1"
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform ${showPlans ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          {showPlans ? "Hide" : "View"} Full Plans
        </button>
      )}
      {showPlans && (
        <div className="mt-2 space-y-2">
          {result.original_plan && (
            <details open>
              <summary className="text-[11px] font-medium text-(--color-text-faint) cursor-pointer mb-1">Original Plan</summary>
              <pre className="text-[11px] font-mono bg-white/50 dark:bg-black/20 rounded-md p-3 overflow-x-auto max-h-48 text-(--color-foreground)">{result.original_plan}</pre>
            </details>
          )}
          {result.simulated_plan && (
            <details open>
              <summary className="text-[11px] font-medium text-(--color-text-faint) cursor-pointer mb-1">Simulated Plan (with index)</summary>
              <pre className="text-[11px] font-mono bg-white/50 dark:bg-black/20 rounded-md p-3 overflow-x-auto max-h-48 text-(--color-foreground)">{result.simulated_plan}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

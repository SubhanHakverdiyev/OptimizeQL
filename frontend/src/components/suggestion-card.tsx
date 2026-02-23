"use client";

import { useState } from "react";
import type { SuggestionItem, CompareResult } from "@/lib/types";
import { compareQueries } from "@/lib/api-client";
import { ImpactBadge } from "./impact-badge";
import { SqlHighlight } from "./sql-highlight";
import { CopyButton } from "./copy-button";

interface SuggestionCardProps {
  item: SuggestionItem;
  originalSql?: string;
  connectionId?: string | null;
}

export function SuggestionCard({ item, originalSql, connectionId }: SuggestionCardProps) {
  const [comparing, setComparing] = useState(false);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [compareError, setCompareError] = useState("");

  const canCompare = !!(item.sql && originalSql && connectionId);

  async function handleCompare() {
    if (!item.sql || !originalSql || !connectionId) return;
    setComparing(true);
    setCompareResult(null);
    setCompareError("");
    try {
      const result = await compareQueries({
        original_sql: originalSql,
        rewritten_sql: item.sql,
        connection_id: connectionId,
      });
      setCompareResult(result);
    } catch (err) {
      setCompareError(err instanceof Error ? err.message : "Comparison failed");
    } finally {
      setComparing(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <p className="text-base leading-[1.75] text-[#1f1f1f] flex-1">
          {item.explanation}
        </p>
        <ImpactBadge impact={item.estimated_impact} />
      </div>
      {(item.plan_node || item.root_cause || item.index_type) && (
        <div className="flex flex-wrap gap-2 mt-2.5">
          {item.plan_node && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-[12px] font-mono text-gray-600">
              {item.plan_node}
            </span>
          )}
          {item.root_cause && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-orange-50 text-[12px] font-medium text-orange-600 border border-orange-100">
              {item.root_cause.replace(/_/g, " ")}
            </span>
          )}
          {item.index_type && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-[12px] font-medium text-blue-600 border border-blue-100">
              {item.index_type.toUpperCase()}
            </span>
          )}
        </div>
      )}
      {item.sql && (
        <div className="relative mt-4">
          <div className="absolute top-2.5 right-2.5 z-10 flex gap-1.5">
            {canCompare && (
              <button
                onClick={handleCompare}
                disabled={comparing}
                className="px-2.5 py-1 rounded-md text-[12px] font-medium bg-violet-50 text-violet-600 border border-violet-200 hover:bg-violet-100 transition-colors disabled:opacity-50"
              >
                {comparing ? "Comparing..." : "Verify"}
              </button>
            )}
            <CopyButton text={item.sql} />
          </div>
          <SqlHighlight code={item.sql} />
        </div>
      )}

      {/* Comparison result */}
      {compareResult && !compareResult.original_error && !compareResult.rewritten_error && (
        <div
          className={`mt-3 rounded-lg px-4 py-3 text-[13px] ${
            compareResult.results_match
              ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {compareResult.results_match ? (
            <p>
              Results match — {compareResult.rows_compared} rows compared, outputs are identical.
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
          <div className="px-4 py-3 bg-red-50">
            <pre className="font-mono text-[13px] leading-relaxed text-red-800 whitespace-pre-wrap">{compareResult.rewritten_error}</pre>
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
          <div className="px-4 py-3 bg-red-50">
            <pre className="font-mono text-[13px] leading-relaxed text-red-800 whitespace-pre-wrap">{compareError}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

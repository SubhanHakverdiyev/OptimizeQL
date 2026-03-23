"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getShareLink } from "@/lib/api-client";
import { AnalysisResults } from "@/components/analysis-results";
import { SqlHighlight } from "@/components/sql-highlight";
import type { AnalysisResult } from "@/lib/types";

export default function SharedPage() {
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [schemaDDL, setSchemaDDL] = useState<string | null>(null);
  const [sqlQuery, setSqlQuery] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    const id = params.id as string;
    if (!id) return;

    getShareLink(id)
      .then((link) => {
        setSqlQuery(link.sql_query);
        setSchemaDDL(link.schema_ddl ?? null);
        if (link.llm_response) {
          try {
            setResult(JSON.parse(link.llm_response));
          } catch {
            // result stays null
          }
        }
      })
      .catch(() => {
        setError("Share link not found or has expired.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center mt-20">
        <div className="flex items-center gap-2 text-sm text-(--color-text-muted)">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading shared analysis...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center space-y-4">
        <h1 className="text-xl font-semibold text-(--color-foreground)">Link Not Found</h1>
        <p className="text-sm text-(--color-text-muted)">{error}</p>
        <a
          href="/analyze"
          className="inline-block px-4 py-2 bg-[#1e3a5f] dark:bg-blue-600 text-white text-sm rounded-lg hover:bg-[#2a4d7a] dark:hover:bg-blue-700 transition-colors"
        >
          Go to Analyze
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-semibold text-(--color-foreground)">
            Shared Analysis
          </h1>
          <span className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-gray-100 dark:bg-gray-800 text-(--color-text-muted) border border-(--color-border)">
            Read-only
          </span>
        </div>
        <p className="text-[15px] text-(--color-text-faint)">
          This is a shared analysis snapshot. Results are read-only.
        </p>
      </div>

      {/* Schema DDL — collapsible */}
      {schemaDDL && (
        <details className="group rounded-xl border border-(--color-border) bg-(--color-surface-muted) overflow-hidden">
          <summary className="cursor-pointer px-4 py-3 text-[14px] font-medium text-(--color-text-muted) hover:text-(--color-foreground) transition-colors flex items-center gap-2">
            <svg
              className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-90"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            Schema DDL
          </summary>
          <div className="px-4 pb-4">
            <SqlHighlight code={schemaDDL} />
          </div>
        </details>
      )}

      {/* SQL Query */}
      {sqlQuery && (
        <div className="space-y-2">
          <h3 className="text-[14px] font-medium text-(--color-text-muted)">Query</h3>
          <SqlHighlight code={sqlQuery} />
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="pt-4 border-t border-(--color-border)">
          <AnalysisResults result={result} readOnly />
        </div>
      )}

      {!result && (
        <div className="text-center py-8">
          <p className="text-base text-(--color-text-faint)">No analysis results available.</p>
        </div>
      )}

      {/* CTA */}
      <div className="text-center pt-4 pb-8">
        <a
          href="/analyze"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1e3a5f] dark:bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-[#2a4d7a] dark:hover:bg-blue-700 transition-colors"
        >
          Try OptimizeQL
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </a>
      </div>
    </div>
  );
}

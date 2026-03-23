"use client";

import { useRouter } from "next/navigation";
import type { QueryHistoryItem, AnalysisResult } from "@/lib/types";
import { useAnalysis } from "@/context/analysis-context";

interface HistoryListProps {
  items: QueryHistoryItem[];
}

export function HistoryList({ items }: HistoryListProps) {
  const { loadHistoryResult } = useAnalysis();
  const router = useRouter();

  if (items.length === 0) {
    return <p className="text-sm text-gray-500">No query history yet. Analyze a query to get started.</p>;
  }

  const handleView = (item: QueryHistoryItem) => {
    if (!item.llm_response) return;
    try {
      const result: AnalysisResult = JSON.parse(item.llm_response);
      loadHistoryResult(item.sql_query, result, item.schema_ddl);
      router.push("/analyze");
    } catch {
      // If JSON parsing fails, fall back to re-analyze
      router.push(`/analyze?sql=${encodeURIComponent(item.sql_query)}`);
    }
  };

  const handleReanalyze = (item: QueryHistoryItem) => {
    // Load schema into context (without result) so playground restores DDL
    loadHistoryResult(item.sql_query, null as unknown as AnalysisResult, item.schema_ddl);
    router.push(`/analyze?sql=${encodeURIComponent(item.sql_query)}`);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-(--color-border-strong)">
            <th className="text-left py-2 px-3 font-medium text-(--color-text-muted)">Date</th>
            <th className="text-left py-2 px-3 font-medium text-(--color-text-muted)">SQL Query</th>
            <th className="text-right py-2 px-3 font-medium text-(--color-text-muted)">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-(--color-border) hover:bg-gray-50 dark:hover:bg-white/5">
              <td className="py-2 px-3 text-(--color-text-muted) whitespace-nowrap">
                {new Date(item.created_at).toLocaleString()}
              </td>
              <td className="py-2 px-3">
                <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded block truncate max-w-lg text-(--color-foreground)">
                  {item.sql_query}
                </code>
              </td>
              <td className="py-2 px-3 text-right space-x-2 whitespace-nowrap">
                {item.llm_response && (
                  <button
                    onClick={() => handleView(item)}
                    className="px-2 py-1 text-xs rounded bg-[#1e3a5f] dark:bg-blue-600 text-white hover:bg-[#2a4d7a] dark:hover:bg-blue-700 transition-colors"
                  >
                    View Result
                  </button>
                )}
                <button
                  onClick={() => handleReanalyze(item)}
                  className="px-2 py-1 text-xs rounded bg-[#eef2f9] dark:bg-blue-950/30 text-[#1e3a5f] dark:text-blue-400 hover:bg-[#dce4f2] dark:hover:bg-blue-900/40 transition-colors"
                >
                  Re-analyze
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

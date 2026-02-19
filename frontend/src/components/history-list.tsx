"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
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
      loadHistoryResult(item.sql_query, result);
      router.push("/");
    } catch {
      // If JSON parsing fails, fall back to re-analyze
      router.push(`/?sql=${encodeURIComponent(item.sql_query)}`);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-3 font-medium text-gray-600">Date</th>
            <th className="text-left py-2 px-3 font-medium text-gray-600">SQL Query</th>
            <th className="text-right py-2 px-3 font-medium text-gray-600">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2 px-3 text-gray-600 whitespace-nowrap">
                {new Date(item.created_at).toLocaleString()}
              </td>
              <td className="py-2 px-3">
                <code className="text-xs bg-gray-100 px-2 py-1 rounded block truncate max-w-lg">
                  {item.sql_query}
                </code>
              </td>
              <td className="py-2 px-3 text-right space-x-2 whitespace-nowrap">
                {item.llm_response && (
                  <button
                    onClick={() => handleView(item)}
                    className="px-2 py-1 text-xs rounded bg-[#1e3a5f] text-white hover:bg-[#2a4d7a] transition-colors"
                  >
                    View Result
                  </button>
                )}
                <Link
                  href={`/?sql=${encodeURIComponent(item.sql_query)}`}
                  className="px-2 py-1 text-xs rounded bg-[#eef2f9] text-[#1e3a5f] hover:bg-[#dce4f2] transition-colors"
                >
                  Re-analyze
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

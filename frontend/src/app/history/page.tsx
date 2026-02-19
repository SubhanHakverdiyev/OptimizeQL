"use client";

import { useEffect, useState } from "react";
import { HistoryList } from "@/components/history-list";
import { getHistory } from "@/lib/api-client";
import type { QueryHistoryItem } from "@/lib/types";

export default function HistoryPage() {
  const [items, setItems] = useState<QueryHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHistory()
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Query History</h1>
        <p className="text-sm text-gray-500 mt-1">
          View previously analyzed queries and re-analyze them.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading history...</p>
      ) : (
        <HistoryList items={items} />
      )}
    </div>
  );
}

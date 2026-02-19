"use client";

import type { SuggestionItem } from "@/lib/types";
import { ImpactBadge } from "./impact-badge";
import { SqlHighlight } from "./sql-highlight";
import { CopyButton } from "./copy-button";

export function SuggestionCard({ item }: { item: SuggestionItem }) {
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
          <div className="absolute top-2.5 right-2.5 z-10">
            <CopyButton text={item.sql} />
          </div>
          <SqlHighlight code={item.sql} />
        </div>
      )}
    </div>
  );
}

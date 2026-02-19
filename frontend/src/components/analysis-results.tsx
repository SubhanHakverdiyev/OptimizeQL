"use client";

import type { AnalysisResult, ConfigurationItem } from "@/lib/types";
import { SuggestionCard } from "./suggestion-card";
import { SqlHighlight } from "./sql-highlight";
import { ImpactBadge } from "./impact-badge";

const sectionMeta: Record<string, { icon: string; color: string }> = {
  Bottlenecks: { icon: "!!", color: "text-red-500" },
  "Suggested Indexes": { icon: "+", color: "text-blue-500" },
  "Query Rewrites": { icon: "~", color: "text-violet-500" },
  "Materialized Views": { icon: "#", color: "text-amber-500" },
  Statistics: { icon: "S", color: "text-teal-500" },
  Configuration: { icon: "C", color: "text-indigo-500" },
};

const impactOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

function sortByImpact(items: AnalysisResult["indexes"]) {
  return [...items].sort(
    (a, b) => (impactOrder[a.estimated_impact] ?? 3) - (impactOrder[b.estimated_impact] ?? 3),
  );
}

interface SectionProps {
  title: string;
  items: AnalysisResult["indexes"];
}

function Section({ title, items }: SectionProps) {
  if (items.length === 0) return null;
  const meta = sectionMeta[title] || { icon: "*", color: "text-gray-500" };
  const sorted = sortByImpact(items);

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2.5 mb-4">
        <span
          className={`w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center text-xs font-bold ${meta.color}`}
        >
          {meta.icon}
        </span>
        <h3 className="text-[18px] font-semibold text-[#1f1f1f]">{title}</h3>
        <span className="text-[14px] text-gray-400 font-normal">
          {items.length} {items.length === 1 ? "suggestion" : "suggestions"}
        </span>
      </div>
      <div className="space-y-3 pl-0.5">
        {sorted.map((item, i) => (
          <SuggestionCard key={i} item={item} />
        ))}
      </div>
    </div>
  );
}

function ConfigurationCard({ item }: { item: ConfigurationItem }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-base leading-[1.75] text-[#1f1f1f]">{item.explanation}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-[12px] font-mono text-gray-600">
              {item.parameter}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-red-50 text-[12px] font-mono text-red-500">
              {item.current_value}
            </span>
            <span className="text-[12px] text-gray-400">&rarr;</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 text-[12px] font-mono text-emerald-600">
              {item.recommended_value}
            </span>
          </div>
        </div>
        <ImpactBadge impact={item.estimated_impact} />
      </div>
    </div>
  );
}

function highestImpact(items: AnalysisResult["indexes"]): number {
  if (items.length === 0) return 99;
  return Math.min(...items.map((i) => impactOrder[i.estimated_impact] ?? 3));
}

export function AnalysisResults({ result }: { result: AnalysisResult }) {
  const hasAnySuggestions =
    result.bottlenecks.length > 0 ||
    result.indexes.length > 0 ||
    result.rewrites.length > 0 ||
    result.materialized_views.length > 0 ||
    (result.statistics?.length ?? 0) > 0 ||
    (result.configuration?.length ?? 0) > 0;

  // Sort sections so the one with the highest-impact item comes first
  const sections: { title: string; items: AnalysisResult["indexes"] }[] = [
    { title: "Bottlenecks", items: result.bottlenecks },
    { title: "Suggested Indexes", items: result.indexes },
    { title: "Query Rewrites", items: result.rewrites },
    { title: "Materialized Views", items: result.materialized_views },
    { title: "Statistics", items: result.statistics ?? [] },
  ].sort((a, b) => highestImpact(a.items) - highestImpact(b.items));

  const configItems = result.configuration ?? [];

  return (
    <div className="space-y-2">
      {/* Summary box */}
      {result.summary && (
        <div className="bg-[#eef2f9] border border-[#c8d4e8] rounded-xl p-5 mb-4">
          <h3 className="text-[14px] font-semibold text-[#1e3a5f] mb-1.5">Summary</h3>
          <p className="text-base leading-[1.75] text-[#1f1f1f]">{result.summary}</p>
        </div>
      )}

      {/* Tables analyzed */}
      {result.tables_analyzed.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pb-2">
          <span className="text-[14px] text-gray-400 mr-1">Tables:</span>
          {result.tables_analyzed.map((t) => (
            <span
              key={t}
              className="px-2.5 py-0.5 bg-gray-50 border border-gray-100 rounded-md text-[14px] font-mono text-gray-600"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {/* EXPLAIN plan — collapsible */}
      {result.explain_plan && (
        <details className="group rounded-xl border border-gray-100 bg-gray-50/50 overflow-hidden">
          <summary className="cursor-pointer px-4 py-3 text-[14px] font-medium text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-2">
            <svg
              className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-90"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            EXPLAIN Plan
          </summary>
          <div className="px-4 pb-4">
            <SqlHighlight code={result.explain_plan} />
          </div>
        </details>
      )}

      {/* Suggestion sections — sorted by highest impact */}
      {sections.map((s) => (
        <Section key={s.title} title={s.title} items={s.items} />
      ))}

      {/* Configuration section — different card shape */}
      {configItems.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2.5 mb-4">
            <span className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center text-xs font-bold text-indigo-500">
              C
            </span>
            <h3 className="text-[18px] font-semibold text-[#1f1f1f]">Configuration</h3>
            <span className="text-[14px] text-gray-400 font-normal">
              {configItems.length} {configItems.length === 1 ? "suggestion" : "suggestions"}
            </span>
          </div>
          <div className="space-y-3 pl-0.5">
            {[...configItems]
              .sort(
                (a, b) =>
                  (impactOrder[a.estimated_impact] ?? 3) -
                  (impactOrder[b.estimated_impact] ?? 3),
              )
              .map((item, i) => (
                <ConfigurationCard key={i} item={item} />
              ))}
          </div>
        </div>
      )}

      {!hasAnySuggestions && (
        <div className="text-center py-8">
          <p className="text-base text-gray-400">No optimization suggestions found.</p>
          <p className="text-[14px] text-gray-300 mt-1">The query looks well-optimized.</p>
        </div>
      )}
    </div>
  );
}

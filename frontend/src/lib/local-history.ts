/**
 * Browser-local analysis history using localStorage.
 * Used in hosted mode so no user data is exposed via shared backend endpoints.
 */

import type {
  AnalysisResult,
  QueryHistoryItem,
  DashboardStats,
  CategoryCount,
  TableCount,
  QueryByDate,
  RecentAnalysis,
} from "./types";

const STORAGE_KEY = "optimizeql-history";
const MAX_ITEMS = 200;

interface LocalHistoryEntry {
  id: string;
  sql_query: string;
  schema_ddl: string | null;
  llm_response: string; // JSON-stringified AnalysisResult
  created_at: string; // ISO string
}

function readEntries(): LocalHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeEntries(entries: LocalHistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ITEMS)));
  } catch {
    // localStorage full — silently skip
  }
}

/** Save an analysis result after each query. */
export function saveAnalysis(sql: string, result: AnalysisResult, schemaDDL?: string | null): void {
  const entries = readEntries();
  entries.unshift({
    id: result.query_id || crypto.randomUUID(),
    sql_query: sql,
    schema_ddl: schemaDDL || null,
    llm_response: JSON.stringify(result),
    created_at: new Date().toISOString(),
  });
  writeEntries(entries);
}

/** Get history items (same shape as backend API). */
export function getLocalHistory(limit = 50): QueryHistoryItem[] {
  return readEntries().slice(0, limit).map((e) => ({
    id: e.id,
    connection_id: null,
    sql_query: e.sql_query,
    schema_ddl: e.schema_ddl ?? null,
    llm_response: e.llm_response,
    created_at: e.created_at,
  }));
}

/** Compute dashboard stats from local history (same shape as backend API). */
export function getLocalDashboardStats(): DashboardStats {
  const entries = readEntries();
  const suggestionKeys = ["indexes", "rewrites", "materialized_views", "bottlenecks", "statistics"] as const;

  let totalSuggestions = 0;
  let highImpactCount = 0;
  const categoryCountsMap: Record<string, number> = {};
  const tableFreq: Record<string, number> = {};
  const analysisDates = new Set<string>();
  const recentAnalyses: RecentAnalysis[] = [];
  const dateCountMap: Record<string, number> = {};

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    let suggestionCount = 0;

    try {
      const data = JSON.parse(entry.llm_response);

      for (const key of suggestionKeys) {
        const items: unknown[] = data[key] || [];
        suggestionCount += items.length;
        categoryCountsMap[key] = (categoryCountsMap[key] || 0) + items.length;
        for (const item of items) {
          if (typeof item === "object" && item !== null && (item as Record<string, unknown>).estimated_impact === "high") {
            highImpactCount++;
          }
        }
      }

      const configItems: unknown[] = data.configuration || [];
      suggestionCount += configItems.length;
      categoryCountsMap["configuration"] = (categoryCountsMap["configuration"] || 0) + configItems.length;
      for (const item of configItems) {
        if (typeof item === "object" && item !== null && (item as Record<string, unknown>).estimated_impact === "high") {
          highImpactCount++;
        }
      }

      for (const t of (data.tables_analyzed || []) as string[]) {
        tableFreq[t] = (tableFreq[t] || 0) + 1;
      }
    } catch {
      // skip malformed
    }

    totalSuggestions += suggestionCount;

    const dateStr = entry.created_at.slice(0, 10);
    analysisDates.add(dateStr);
    dateCountMap[dateStr] = (dateCountMap[dateStr] || 0) + 1;

    if (i < 5) {
      recentAnalyses.push({
        id: entry.id,
        sql_query: entry.sql_query,
        suggestion_count: suggestionCount,
        created_at: entry.created_at,
        llm_response: entry.llm_response,
      });
    }
  }

  // Streak
  let streakDays = 0;
  const today = new Date();
  const d = new Date(today);
  while (analysisDates.has(d.toISOString().slice(0, 10))) {
    streakDays++;
    d.setDate(d.getDate() - 1);
  }

  // Top categories
  const topCategories: CategoryCount[] = Object.entries(categoryCountsMap)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  // Most analyzed tables (top 5)
  const mostAnalyzedTables: TableCount[] = Object.entries(tableFreq)
    .map(([table_name, count]) => ({ table_name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Queries by date (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const queriesByDate: QueryByDate[] = Object.entries(dateCountMap)
    .filter(([date]) => new Date(date) >= thirtyDaysAgo)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  return {
    total_queries: entries.length,
    total_suggestions: totalSuggestions,
    high_impact_count: highImpactCount,
    streak_days: streakDays,
    top_categories: topCategories,
    most_analyzed_tables: mostAnalyzedTables,
    queries_by_date: queriesByDate,
    recent_analyses: recentAnalyses,
  };
}

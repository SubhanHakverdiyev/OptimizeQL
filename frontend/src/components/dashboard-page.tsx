"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { getDashboardStats } from "@/lib/api-client";
import { useAnalysis } from "@/context/analysis-context";
import { useTheme } from "@/context/theme-context";
import type { DashboardStats, AnalysisResult } from "@/lib/types";

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function timeAgo(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const CATEGORY_COLORS: Record<string, { dot: string; bar: string; darkBar: string; label: string }> = {
  indexes:            { dot: "bg-blue-500",   bar: "bg-blue-500",   darkBar: "bg-blue-400",   label: "Indexes" },
  rewrites:           { dot: "bg-violet-500", bar: "bg-violet-500", darkBar: "bg-violet-400", label: "Rewrites" },
  bottlenecks:        { dot: "bg-rose-500",   bar: "bg-rose-500",   darkBar: "bg-rose-400",   label: "Bottlenecks" },
  materialized_views: { dot: "bg-amber-500",  bar: "bg-amber-500",  darkBar: "bg-amber-400",  label: "Views" },
  configuration:      { dot: "bg-emerald-500",bar: "bg-emerald-500",darkBar: "bg-emerald-400",label: "Config" },
  statistics:         { dot: "bg-slate-400",  bar: "bg-slate-400",  darkBar: "bg-slate-500",  label: "Statistics" },
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { loadHistoryResult } = useAnalysis();
  const { theme } = useTheme();
  const router = useRouter();

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleRecentClick = (item: DashboardStats["recent_analyses"][0]) => {
    if (item.llm_response) {
      try {
        const result: AnalysisResult = JSON.parse(item.llm_response);
        loadHistoryResult(item.sql_query, result);
        router.push("/analyze");
        return;
      } catch {
        // fall through
      }
    }
    router.push(`/analyze?sql=${encodeURIComponent(item.sql_query)}`);
  };

  const isDark = theme === "dark";

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-(--color-foreground)">Dashboard</h1>
        <p className="text-sm text-(--color-text-muted) mt-1">Loading...</p>
      </div>
    );
  }

  // Empty state
  if (!stats || stats.total_queries === 0) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-(--color-foreground)">Dashboard</h1>
          <p className="text-sm text-(--color-text-muted) mt-1">Your SQL optimization overview.</p>
        </div>
        <div className="text-center py-16 rounded-xl border border-(--color-border) bg-(--color-surface-muted)">
          <svg className="mx-auto w-12 h-12 text-(--color-text-faint) mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Zm3.75 11.625a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
          </svg>
          <p className="text-base text-(--color-text-muted) mb-2">No queries analyzed yet</p>
          <p className="text-sm text-(--color-text-faint) mb-6">Analyze your first SQL query to see stats here.</p>
          <Link
            href="/analyze"
            className="px-5 py-2.5 bg-[#1e3a5f] dark:bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-[#2a4d7a] dark:hover:bg-blue-700 transition-colors"
          >
            Analyze a Query
          </Link>
        </div>
      </div>
    );
  }

  const maxCategory = Math.max(...stats.top_categories.map((c) => c.count), 1);

  // Accent color for recent card based on suggestion count
  const cardAccent = (count: number) =>
    count <= 2
      ? "border-l-emerald-400 dark:border-l-emerald-500"
      : count <= 5
        ? "border-l-amber-400 dark:border-l-amber-500"
        : "border-l-rose-400 dark:border-l-rose-500";

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-(--color-foreground)">Dashboard</h1>
        <p className="text-sm text-(--color-text-muted) mt-1">Your SQL optimization overview.</p>
      </div>

      {/* Quick action banner */}
      <div className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-800 p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
              <path d="M11 8v6M8 11h6" />
            </svg>
          </div>
          <div>
            <p className="text-white text-sm font-semibold">Ready to optimize your next query?</p>
            <p className="text-white/70 text-xs mt-0.5">Paste SQL and get AI-powered suggestions in seconds.</p>
          </div>
        </div>
        <Link
          href="/analyze"
          className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
        >
          Analyze &rarr;
        </Link>
      </div>

      {/* Stat cards — 4 colored cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Queries Analyzed */}
        <div className="rounded-xl border border-(--color-border) bg-blue-50/50 dark:bg-blue-950/20 p-5 border-l-4 border-l-blue-500">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600 dark:text-blue-400" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </div>
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">Queries Analyzed</p>
          </div>
          <p className="text-3xl font-bold text-(--color-foreground)">{stats.total_queries}</p>
        </div>

        {/* Total Suggestions */}
        <div className="rounded-xl border border-(--color-border) bg-amber-50/50 dark:bg-amber-950/20 p-5 border-l-4 border-l-amber-500">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-600 dark:text-amber-400" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.663 17h4.674M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">Suggestions</p>
          </div>
          <p className="text-3xl font-bold text-(--color-foreground)">{stats.total_suggestions}</p>
        </div>

        {/* High Impact */}
        <div className="rounded-xl border border-(--color-border) bg-rose-50/50 dark:bg-rose-950/20 p-5 border-l-4 border-l-rose-500">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-rose-600 dark:text-rose-400" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400 uppercase tracking-wide">High Impact</p>
          </div>
          <p className="text-3xl font-bold text-(--color-foreground)">{stats.high_impact_count}</p>
        </div>

        {/* Streak */}
        <div className="rounded-xl border border-(--color-border) bg-emerald-50/50 dark:bg-emerald-950/20 p-5 border-l-4 border-l-emerald-500">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-600 dark:text-emerald-400" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
              </svg>
            </div>
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Day Streak</p>
          </div>
          <p className="text-3xl font-bold text-(--color-foreground)">
            {stats.streak_days}
            <span className="text-sm font-normal text-(--color-text-muted) ml-1">
              {stats.streak_days === 1 ? "day" : "days"}
            </span>
          </p>
        </div>
      </div>

      {/* Chart + Category breakdown — 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bar chart — 2/3 width */}
        {stats.queries_by_date.length > 0 && (
          <div className="lg:col-span-2 rounded-xl border border-(--color-border) bg-(--color-surface) p-5">
            <h2 className="text-sm font-semibold text-(--color-foreground) mb-4">Query Activity</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.queries_by_date}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={isDark ? "#60a5fa" : "#3b82f6"} stopOpacity={1} />
                    <stop offset="100%" stopColor={isDark ? "#3b82f6" : "#1e3a5f"} stopOpacity={1} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isDark ? "#2a2d3a" : "#e5e7eb"}
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fill: isDark ? "#9ca3af" : "#6b7280", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: isDark ? "#9ca3af" : "#6b7280", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? "#1a1d27" : "#fff",
                    border: `1px solid ${isDark ? "#2a2d3a" : "#e5e7eb"}`,
                    borderRadius: "0.5rem",
                    color: isDark ? "#e5e7eb" : "#111827",
                    fontSize: 13,
                  }}
                  labelFormatter={(label) => formatDate(String(label))}
                />
                <Bar
                  dataKey="count"
                  fill="url(#barGradient)"
                  radius={[4, 4, 0, 0]}
                  name="Queries"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Category breakdown — 1/3 width */}
        {stats.top_categories.length > 0 && (
          <div className="rounded-xl border border-(--color-border) bg-(--color-surface) p-5">
            <h2 className="text-sm font-semibold text-(--color-foreground) mb-4">Optimization Breakdown</h2>
            <div className="space-y-3">
              {stats.top_categories.map((cat) => {
                const colors = CATEGORY_COLORS[cat.category] || { dot: "bg-gray-400", bar: "bg-gray-400", darkBar: "bg-gray-500", label: cat.category };
                const pct = Math.round((cat.count / maxCategory) * 100);
                return (
                  <div key={cat.category}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                        <span className="text-xs font-medium text-(--color-text-muted)">{colors.label}</span>
                      </div>
                      <span className="text-xs font-semibold text-(--color-foreground)">{cat.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isDark ? colors.darkBar : colors.bar} transition-all`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Most analyzed tables */}
      {stats.most_analyzed_tables.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-(--color-foreground) mb-3">Most Optimized Tables</h2>
          <div className="flex flex-wrap gap-2">
            {stats.most_analyzed_tables.map((t) => (
              <span
                key={t.table_name}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                           bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-60" strokeLinecap="round" strokeLinejoin="round">
                  <ellipse cx="12" cy="5" rx="9" ry="3" />
                  <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
                </svg>
                {t.table_name}
                <span className="text-blue-400 dark:text-blue-500">({t.count})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent analyses */}
      {stats.recent_analyses.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-(--color-foreground) mb-3">Recent Analyses</h2>
          <div className="space-y-2">
            {stats.recent_analyses.map((item) => (
              <button
                key={item.id}
                onClick={() => handleRecentClick(item)}
                className={`w-full text-left rounded-xl border border-(--color-border) bg-(--color-surface) p-4 border-l-4 ${cardAccent(item.suggestion_count)}
                           hover:shadow-md hover:border-(--color-border-strong) hover:scale-[1.003] transition-all`}
              >
                <div className="flex items-center justify-between gap-4">
                  <code className="text-sm font-mono text-(--color-foreground) truncate flex-1">
                    {item.sql_query.length > 120
                      ? item.sql_query.slice(0, 120) + "..."
                      : item.sql_query}
                  </code>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                      item.suggestion_count > 5
                        ? "bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400"
                        : item.suggestion_count > 2
                          ? "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                          : "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                    }`}>
                      {item.suggestion_count} {item.suggestion_count === 1 ? "tip" : "tips"}
                    </span>
                    <span className="text-xs text-(--color-text-faint)">{timeAgo(item.created_at)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

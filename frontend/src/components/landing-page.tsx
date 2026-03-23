"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Editor from "@monaco-editor/react";
import { useTheme } from "@/context/theme-context";
import { PRESETS } from "@/lib/playground-presets";

/* ── Animated placeholder phrases ──────────────────────────────────────── */

const SCHEMA_PHRASES = [
  "CREATE TABLE users (\n  id SERIAL PRIMARY KEY,\n  email VARCHAR(255) NOT NULL\n);",
  "CREATE INDEX idx_orders_date\n  ON orders(created_at);",
  "CREATE TABLE products (\n  id SERIAL PRIMARY KEY,\n  name VARCHAR(255),\n  price NUMERIC(10,2)\n);",
  "ALTER TABLE orders\n  ADD COLUMN status VARCHAR(50);",
];

const QUERY_PHRASES = [
  "SELECT * FROM users\n  WHERE created_at > NOW() - INTERVAL '30 days';",
  "SELECT u.email, COUNT(o.id)\n  FROM users u JOIN orders o ON o.user_id = u.id\n  GROUP BY u.email;",
  "SELECT category, AVG(price)\n  FROM products\n  GROUP BY category ORDER BY AVG(price) DESC;",
  "SELECT * FROM orders\n  WHERE status = 'pending' AND total > 100;",
];

const QUICK_PHRASES = [
  "SELECT u.email, COUNT(o.id) AS order_count\nFROM users u\nJOIN orders o ON o.user_id = u.id\nWHERE o.created_at >= NOW() - INTERVAL '90 days'\nGROUP BY u.email\nORDER BY order_count DESC;",
  "SELECT p.name, SUM(oi.quantity) AS total_sold\nFROM products p\nJOIN order_items oi ON oi.product_id = p.id\nGROUP BY p.name\nHAVING SUM(oi.quantity) > 10;",
  "SELECT * FROM events\nWHERE tenant_id = 42\n  AND event_type = 'page_view'\n  AND created_at >= '2025-01-01'\nORDER BY created_at DESC\nLIMIT 100;",
];

/* ── Typing animation hook ─────────────────────────────────────────────── */

function useTypingPlaceholder(phrases: string[], typingSpeed = 30, pauseMs = 2000, eraseSpeed = 15) {
  const [text, setText] = useState("");
  const [opacity, setOpacity] = useState(1);
  const idx = useRef(0);
  const charIdx = useRef(0);
  const phase = useRef<"typing" | "pausing" | "erasing">("typing");
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const tick = useCallback(() => {
    const currentPhrase = phrases[idx.current % phrases.length];

    if (phase.current === "typing") {
      charIdx.current++;
      setText(currentPhrase.slice(0, charIdx.current));
      if (charIdx.current >= currentPhrase.length) {
        phase.current = "pausing";
        timerRef.current = setTimeout(tick, pauseMs);
        return;
      }
      timerRef.current = setTimeout(tick, typingSpeed);
    } else if (phase.current === "pausing") {
      phase.current = "erasing";
      setOpacity(0.4);
      timerRef.current = setTimeout(tick, 300);
    } else if (phase.current === "erasing") {
      charIdx.current -= 3;
      if (charIdx.current <= 0) {
        charIdx.current = 0;
        setText("");
        setOpacity(1);
        idx.current++;
        phase.current = "typing";
        timerRef.current = setTimeout(tick, 400);
        return;
      }
      setText(currentPhrase.slice(0, charIdx.current));
      timerRef.current = setTimeout(tick, eraseSpeed);
    }
  }, [phrases, typingSpeed, pauseMs, eraseSpeed]);

  useEffect(() => {
    timerRef.current = setTimeout(tick, 600);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [tick]);

  return { text, opacity };
}

/* ── Data constants ────────────────────────────────────────────────────── */

const STEPS = [
  { num: "01", title: "Paste Schema & Query", desc: "Drop in your CREATE TABLE statements and the SQL query you want to optimize.", icon: "paste" },
  { num: "02", title: "Run Analysis", desc: "We spin up a real PostgreSQL engine in your browser, generate data, and run EXPLAIN ANALYZE.", icon: "analyze" },
  { num: "03", title: "Get Suggestions", desc: "AI reads the execution plan and returns indexes, rewrites, and config changes ranked by impact.", icon: "results" },
  { num: "04", title: "Verify & Compare", desc: "Simulate indexes, compare rewritten queries, and validate results — all in the browser.", icon: "verify" },
];

const FEATURES = [
  { icon: "play", title: "In-Browser Playground", desc: "Full PostgreSQL runs in your browser via PGlite. No server, no credentials, no risk." },
  { icon: "compare", title: "Query Comparison", desc: "Verify that rewritten queries return identical results before deploying to production." },
  { icon: "simulate", title: "Index Simulation", desc: "Test index impact on query cost without creating them on your production database." },
  { icon: "explain", title: "EXPLAIN-Based Analysis", desc: "Suggestions grounded in real execution plans, not just syntax pattern matching." },
];

const USE_CASES = [
  { title: "Slow Reports", desc: "Find bottlenecks in complex reporting queries with multi-table joins and aggregations." },
  { title: "Rewrite Validation", desc: "Verify that optimized query rewrites return the same results as the original." },
  { title: "Index Testing", desc: "Simulate index impact on query performance before committing to production changes." },
  { title: "Team Sharing", desc: "Share analysis results with your team via shareable links for review and discussion." },
];

type LandingMode = "playground" | "quick";

/* ── Icon Components ────────────────────────────────────────────────────── */

function StepIcon({ name }: { name: string }) {
  const cls = "w-5 h-5";
  switch (name) {
    case "paste":
      return (<svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></svg>);
    case "analyze":
      return (<svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /><path d="M11 8v6M8 11h6" /></svg>);
    case "results":
      return (<svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>);
    case "verify":
      return (<svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>);
    default: return null;
  }
}

function FeatureIcon({ name }: { name: string }) {
  switch (name) {
    case "play":
      return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>);
    case "compare":
      return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></svg>);
    case "simulate":
      return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>);
    case "explain":
      return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>);
    default: return null;
  }
}

/* ── Editor options ─────────────────────────────────────────────────────── */

const editorOptions = {
  minimap: { enabled: false },
  fontSize: 13,
  lineNumbers: "off" as const,
  scrollBeyondLastLine: false,
  wordWrap: "on" as const,
  padding: { top: 16, bottom: 16 },
  renderLineHighlight: "none" as const,
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  scrollbar: { vertical: "auto" as const, horizontal: "hidden" as const, handleMouseWheel: false },
  suggest: { showKeywords: true },
  folding: false,
  glyphMargin: false,
  lineDecorationsWidth: 16,
  lineNumbersMinChars: 0,
};

/* ── Main Component ─────────────────────────────────────────────────────── */

export default function LandingPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  // Mode: playground (schema+query) vs quick (just SQL)
  const [landingMode, setLandingMode] = useState<LandingMode>("playground");

  // Playground mode state
  const [schemaDDL, setSchemaDDL] = useState("");
  const [querySql, setQuerySql] = useState("");
  const [activeTab, setActiveTab] = useState<"schema" | "query">("schema");

  // Quick mode state
  const [quickSql, setQuickSql] = useState("");

  // Animated placeholders (only show when editors are empty)
  const schemaPlaceholder = useTypingPlaceholder(SCHEMA_PHRASES);
  const queryPlaceholder = useTypingPlaceholder(QUERY_PHRASES, 25, 2500);
  const quickPlaceholder = useTypingPlaceholder(QUICK_PHRASES, 20, 3000);

  const handlePreset = (name: string) => {
    const preset = PRESETS.find((p) => p.name === name);
    if (!preset) return;
    setSchemaDDL(preset.ddl);
    setQuerySql(preset.sampleQuery);
    setActiveTab("schema");
  };

  const handleAnalyze = () => {
    if (landingMode === "playground") {
      if (!schemaDDL.trim() || !querySql.trim()) return;
      sessionStorage.setItem("landing-schema", schemaDDL);
      sessionStorage.setItem("landing-query", querySql);
      router.push("/analyze");
    } else {
      if (!quickSql.trim()) return;
      sessionStorage.setItem("landing-quick-sql", quickSql);
      router.push("/analyze");
    }
  };

  const analyzeDisabled =
    landingMode === "playground"
      ? !schemaDDL.trim() || !querySql.trim()
      : !quickSql.trim();

  return (
    <div className="min-h-screen bg-(--color-background)">
      {/* ── Top Nav ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-(--color-border) bg-(--color-background)/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
              <svg width="32" height="32" viewBox="0 0 80 80" fill="none">
                <defs>
                  <linearGradient id="logoBg" x1="10" y1="8" x2="70" y2="72" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#1e3a5f"/>
                    <stop offset="1" stopColor="#2D5B8E"/>
                  </linearGradient>
                </defs>
                <rect x="4" y="4" width="72" height="72" rx="22" fill="url(#logoBg)"/>
                <circle cx="39" cy="38" r="16" stroke="white" strokeWidth="3.5"/>
                <circle cx="53" cy="30" r="4.5" fill="#F6D2B8"/>
                <path d="M50 49L59 58" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="text-base font-bold text-(--color-foreground) tracking-tight">
              OptimizeQL
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/analyze" className="text-sm font-medium text-(--color-text-muted) hover:text-(--color-foreground) transition-colors">
              Playground
            </Link>
            <button
              onClick={toggleTheme}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-(--color-text-muted) hover:bg-(--color-surface-muted) hover:text-(--color-foreground) transition-all"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 pb-20">
        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="text-center pt-8 pb-6 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1e3a5f] dark:text-blue-400">
            Open source SQL optimization with built-in verification
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold text-(--color-foreground) tracking-tight leading-[1.1]">
            Paste your query. See why it&apos;s slow.
            <br />
            <span className="text-[#1e3a5f] dark:text-blue-400">Simulate the fix.</span>
          </h1>
          <p className="text-base sm:text-lg text-(--color-text-muted) max-w-xl mx-auto leading-relaxed">
            OptimizeQL analyzes your real execution plan and suggests specific
            fixes: indexes, rewrites, config changes. Simulate the impact
            before you deploy.
          </p>
          <p className="text-xs text-(--color-text-faint) tracking-wide">
            Browser-based &middot; Privacy-first &middot; No setup required
          </p>
          <div className="flex justify-center pt-1">
            <a
              href="https://github.com/SubhanHakverdiyev/OptimizeQL"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-(--color-surface) border border-(--color-border) text-(--color-foreground) hover:border-[#1e3a5f] dark:hover:border-blue-500 hover:shadow-sm transition-all group"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
              Star on GitHub
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500 group-hover:fill-yellow-500 transition-all"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
            </a>
          </div>


        </section>

        {/* ── Editor Section ────────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-(--color-border-strong) bg-(--color-surface) overflow-hidden shadow-sm">
          {/* Toolbar: mode toggle + presets */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-(--color-border)">
            {/* Mode toggle */}
            <div className="inline-flex rounded-lg border border-(--color-border) p-0.5 gap-0.5">
              <button
                onClick={() => setLandingMode("playground")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  landingMode === "playground"
                    ? "bg-[#1e3a5f] dark:bg-blue-600 text-white shadow-sm"
                    : "text-(--color-text-muted) hover:text-(--color-foreground) hover:bg-(--color-surface-muted)"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" /></svg>
                Playground
              </button>
              <button
                onClick={() => setLandingMode("quick")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  landingMode === "quick"
                    ? "bg-[#1e3a5f] dark:bg-blue-600 text-white shadow-sm"
                    : "text-(--color-text-muted) hover:text-(--color-foreground) hover:bg-(--color-surface-muted)"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" /></svg>
                Quick Analyze
              </button>
            </div>

            {/* Presets (only in playground mode) */}
            {landingMode === "playground" && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-(--color-text-faint) mr-1">Presets:</span>
                {PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => handlePreset(preset.name)}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg border border-(--color-border) text-(--color-text-muted) hover:bg-(--color-surface-muted) hover:text-(--color-foreground) transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Editor content */}
          {landingMode === "playground" ? (
            <>
              {/* Tab bar */}
              <div className="flex items-center px-5 py-2 border-b border-(--color-border) bg-(--color-surface-muted)">
                <div className="inline-flex rounded-lg border border-(--color-border) p-0.5 gap-0.5">
                  <button
                    onClick={() => setActiveTab("schema")}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                      activeTab === "schema"
                        ? "bg-[#1e3a5f] dark:bg-blue-600 text-white shadow-sm"
                        : "text-(--color-text-muted) hover:text-(--color-foreground) hover:bg-(--color-surface)"
                    }`}
                  >
                    Schema (DDL)
                  </button>
                  <button
                    onClick={() => setActiveTab("query")}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                      activeTab === "query"
                        ? "bg-[#1e3a5f] dark:bg-blue-600 text-white shadow-sm"
                        : "text-(--color-text-muted) hover:text-(--color-foreground) hover:bg-(--color-surface)"
                    }`}
                  >
                    Query
                  </button>
                </div>
              </div>

              {/* Tabbed editors — only active tab visible */}
              <div>
                {/* Schema editor */}
                {activeTab === "schema" && (
                  <div className="relative">
                    <Editor
                      height="220px"
                      language="sql"
                      theme={theme === "dark" ? "vs-dark" : "vs"}
                      value={schemaDDL}
                      onChange={(val) => setSchemaDDL(val ?? "")}
                      options={editorOptions}
                    />
                    {!schemaDDL && (
                      <div
                        className="absolute top-4 left-4 pointer-events-none text-sm font-mono whitespace-pre-wrap max-w-[90%] leading-relaxed transition-opacity duration-300"
                        style={{ color: "var(--color-text-faint)", opacity: schemaPlaceholder.opacity }}
                      >
                        {schemaPlaceholder.text}
                        <span className="inline-block w-[2px] h-4 bg-current ml-0.5 animate-pulse align-text-bottom" />
                      </div>
                    )}
                  </div>
                )}

                {/* Query editor */}
                {activeTab === "query" && (
                  <div className="relative">
                    <Editor
                      height="220px"
                      language="sql"
                      theme={theme === "dark" ? "vs-dark" : "vs"}
                      value={querySql}
                      onChange={(val) => setQuerySql(val ?? "")}
                      options={editorOptions}
                    />
                    {!querySql && (
                      <div
                        className="absolute top-4 left-4 pointer-events-none text-sm font-mono whitespace-pre-wrap max-w-[90%] leading-relaxed transition-opacity duration-300"
                        style={{ color: "var(--color-text-faint)", opacity: queryPlaceholder.opacity }}
                      >
                        {queryPlaceholder.text}
                        <span className="inline-block w-[2px] h-4 bg-current ml-0.5 animate-pulse align-text-bottom" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Quick Analyze: single SQL editor */
            <div className="relative">
              <Editor
                height="220px"
                language="sql"
                theme={theme === "dark" ? "vs-dark" : "vs"}
                value={quickSql}
                onChange={(val) => setQuickSql(val ?? "")}
                options={editorOptions}
              />
              {!quickSql && (
                <div
                  className="absolute top-4 left-4 pointer-events-none text-sm font-mono whitespace-pre-wrap max-w-[90%] leading-relaxed transition-opacity duration-300"
                  style={{ color: "var(--color-text-faint)", opacity: quickPlaceholder.opacity }}
                >
                  {quickPlaceholder.text}
                  <span className="inline-block w-[2px] h-4 bg-current ml-0.5 animate-pulse align-text-bottom" />
                </div>
              )}
            </div>
          )}

          {/* Analyze CTA bar */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-(--color-border) bg-(--color-surface-muted)">
            <p className="text-xs text-(--color-text-faint)">
              {landingMode === "playground"
                ? "Runs in-browser via PGlite — your data never leaves your machine."
                : "Your query is never stored on our servers. No account required."}
            </p>
            <button
              onClick={handleAnalyze}
              disabled={analyzeDisabled}
              className="px-6 py-2.5 bg-[#1e3a5f] dark:bg-blue-600 text-white text-sm font-semibold rounded-xl
                         hover:bg-[#2a4d7a] dark:hover:bg-blue-700
                         disabled:opacity-40 disabled:cursor-not-allowed
                         transition-all shadow-sm hover:shadow-md
                         flex items-center gap-2"
            >
              Analyze Query
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </button>
          </div>
        </section>

        {/* ── How It Works ──────────────────────────────────────────────────── */}
        <section className="mt-20 space-y-8">
          <div className="text-center space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1e3a5f] dark:text-blue-400">How it works</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-(--color-foreground)">From query to optimized in seconds</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map((step, i) => (
              <div key={step.num} className="relative rounded-xl border border-(--color-border) bg-(--color-surface) p-5 space-y-3 hover:border-(--color-border-strong) hover:shadow-sm transition-all group">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#1e3a5f]/10 dark:bg-blue-500/15 flex items-center justify-center text-[#1e3a5f] dark:text-blue-400"><StepIcon name={step.icon} /></div>
                  <span className="text-xs font-bold text-(--color-border-strong) group-hover:text-(--color-text-muted) transition-colors">{step.num}</span>
                </div>
                <h3 className="text-sm font-semibold text-(--color-foreground)">{step.title}</h3>
                <p className="text-sm text-(--color-text-muted) leading-relaxed">{step.desc}</p>
                {i < STEPS.length - 1 && <div className="hidden lg:block absolute top-1/2 -right-2.5 w-5 h-px bg-(--color-border-strong)" />}
              </div>
            ))}
          </div>
        </section>

        {/* ── Core Features ──────────────────────────────────────────────────── */}
        <section className="mt-20 space-y-8">
          <div className="text-center space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1e3a5f] dark:text-blue-400">Core features</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-(--color-foreground)">Everything you need to optimize SQL</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-(--color-border) bg-(--color-surface) p-6 space-y-3 hover:border-(--color-border-strong) hover:shadow-sm transition-all">
                <div className="w-10 h-10 rounded-lg bg-[#1e3a5f]/10 dark:bg-blue-500/15 flex items-center justify-center text-[#1e3a5f] dark:text-blue-400"><FeatureIcon name={f.icon} /></div>
                <h3 className="text-base font-semibold text-(--color-foreground)">{f.title}</h3>
                <p className="text-sm text-(--color-text-muted) leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Use Cases ─────────────────────────────────────────────────────── */}
        <section className="mt-20 space-y-8">
          <div className="text-center space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1e3a5f] dark:text-blue-400">Use cases</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-(--color-foreground)">Built for real-world SQL problems</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {USE_CASES.map((uc) => (
              <div key={uc.title} className="flex items-start gap-4 rounded-xl border border-(--color-border) bg-(--color-surface) p-5 hover:border-(--color-border-strong) hover:shadow-sm transition-all">
                <div className="w-2 h-2 rounded-full bg-[#1e3a5f] dark:bg-blue-500 mt-2 shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-(--color-foreground)">{uc.title}</h3>
                  <p className="text-sm text-(--color-text-muted) mt-1 leading-relaxed">{uc.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Bottom CTA ────────────────────────────────────────────────────── */}
        <section className="mt-20 text-center rounded-2xl border border-(--color-border) bg-(--color-surface) p-10 space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-(--color-foreground)">Ready to optimize your queries?</h2>
          <p className="text-sm text-(--color-text-muted) max-w-md mx-auto">No sign-up required. Paste your schema, write a query, and get optimization suggestions backed by real execution plans.</p>
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="px-6 py-2.5 bg-[#1e3a5f] dark:bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-[#2a4d7a] dark:hover:bg-blue-700 transition-all shadow-sm hover:shadow-md">
            Get Started
          </button>
        </section>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-(--color-border) mt-20">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-(--color-text-faint)">
          <span>&copy; {new Date().getFullYear()} OptimizeQL. Open source under MIT.</span>
          <div className="flex items-center gap-4">
            <a href="https://github.com/SubhanHakverdiyev/OptimizeQL" target="_blank" rel="noopener noreferrer" className="hover:text-(--color-foreground) transition-colors">GitHub</a>
            <span className="text-(--color-border)">|</span>
            <span>Built with PGlite + Next.js</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

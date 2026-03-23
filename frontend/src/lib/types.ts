export interface ConnectionCreate {
  name: string;
  db_type: "postgresql" | "mysql";
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl_enabled: boolean;
}

export interface ConnectionResponse {
  id: string;
  name: string;
  db_type: string;
  host: string;
  port: number;
  database: string;
  username: string;
  ssl_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
}

// ── Playground (client-provided introspection) ─────────────────────────────

export interface ClientExplainResult {
  raw_plan: string;
  planning_time_ms: number | null;
  execution_time_ms: number | null;
}

export interface ClientTableColumn {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length?: number | null;
}

export interface ClientTableIndex {
  index_name: string;
  table_name: string;
  columns: string[];
  is_unique: boolean;
  index_type: string;
  definition: string;
}

export interface ClientColumnStat {
  column_name: string;
  null_frac: number;
  avg_width: number;
  n_distinct: number;
}

export interface ClientTableSchema {
  table_name: string;
  columns: ClientTableColumn[];
  row_count: number;
  indexes: ClientTableIndex[];
  column_stats: ClientColumnStat[];
}

export type AnalyzeMode = "connect" | "playground" | "none";

export interface AnalyzeRequest {
  sql: string;
  connection_id?: string | null;
  model?: string | null;
  client_explain?: ClientExplainResult | null;
  client_table_schemas?: ClientTableSchema[] | null;
  client_db_type?: string | null;
}

export interface SuggestionItem {
  sql: string | null;
  explanation: string;
  estimated_impact: "high" | "medium" | "low";
  plan_node?: string | null;
  root_cause?: string | null;
  index_type?: string | null;
}

export interface ConfigurationItem {
  parameter: string;
  current_value: string;
  recommended_value: string;
  explanation: string;
  estimated_impact: "high" | "medium" | "low";
}

export interface AnalysisResult {
  query_id: string;
  indexes: SuggestionItem[];
  rewrites: SuggestionItem[];
  materialized_views: SuggestionItem[];
  bottlenecks: SuggestionItem[];
  statistics: SuggestionItem[];
  configuration: ConfigurationItem[];
  summary: string;
  explain_plan: string | null;
  explain_error?: string | null;
  tables_analyzed: string[];
}

// ── Share Links ─────────────────────────────────────────────────────────────

export interface ShareLinkCreate {
  schema_ddl: string | null;
  sql_query: string;
  llm_response: string | null;
}

export interface ShareLinkResponse {
  id: string;
  schema_ddl: string | null;
  sql_query: string;
  llm_response: string | null;
  created_at: string;
}

// ── Query Comparison ────────────────────────────────────────────────────────

export interface CompareRequest {
  original_sql: string;
  rewritten_sql: string;
  connection_id: string;
  row_limit?: number;
}

export interface RowDiff {
  row_number: number;
  original_row: unknown[];
  rewritten_row: unknown[];
}

export interface CompareResult {
  results_match: boolean;
  /** True when rows are identical but returned in different order */
  order_differs?: boolean;
  rows_compared: number;
  original_row_count: number;
  rewritten_row_count: number;
  first_diff: RowDiff | null;
  original_error: string | null;
  rewritten_error: string | null;
}

// ── Index Simulation ───────────────────────────────────────────────────────

export interface SimulateIndexRequest {
  index_sql: string;
  query_sql: string;
  connection_id: string;
}

export interface PlanNodeChange {
  before: string;
  after: string;
  cost_before: number;
  cost_after: number;
}

export interface SimulateIndexResult {
  success: boolean;
  error: string | null;
  hypopg_available: boolean;
  original_cost: number | null;
  simulated_cost: number | null;
  cost_reduction_pct: number | null;
  original_plan: string | null;
  simulated_plan: string | null;
  node_changes: PlanNodeChange[];
}

// ── LLM Config ──────────────────────────────────────────────────────────────

export interface LLMConfigCreate {
  name: string;
  provider: "anthropic" | "openai" | "gemini" | "deepseek" | "xai" | "qwen" | "meta" | "kimi" | "groq" | "openrouter";
  api_key: string;
}

export interface LLMConfigResponse {
  id: string;
  name: string;
  provider: string;
  is_active: boolean;
  api_key_preview: string;
  created_at: string;
  updated_at: string;
}

export interface ProviderInfo {
  name: string;
  label: string;
  default_model: string;
  models: string[];
}

// ── Query History ───────────────────────────────────────────────────────────

export interface QueryHistoryItem {
  id: string;
  connection_id: string | null;
  sql_query: string;
  llm_response: string | null;
  schema_ddl: string | null;
  created_at: string;
}

// ── Dashboard Stats ────────────────────────────────────────────────────────

export interface QueryByDate {
  date: string;
  count: number;
}

export interface CategoryCount {
  category: string;
  count: number;
}

export interface TableCount {
  table_name: string;
  count: number;
}

export interface RecentAnalysis {
  id: string;
  sql_query: string;
  suggestion_count: number;
  created_at: string;
  llm_response: string | null;
}

export interface DashboardStats {
  total_queries: number;
  total_suggestions: number;
  high_impact_count: number;
  streak_days: number;
  top_categories: CategoryCount[];
  most_analyzed_tables: TableCount[];
  queries_by_date: QueryByDate[];
  recent_analyses: RecentAnalysis[];
}

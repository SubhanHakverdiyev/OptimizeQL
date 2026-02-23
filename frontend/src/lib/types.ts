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

export interface AnalyzeRequest {
  sql: string;
  connection_id?: string | null;
  model?: string | null;
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
  rows_compared: number;
  original_row_count: number;
  rewritten_row_count: number;
  first_diff: RowDiff | null;
  original_error: string | null;
  rewritten_error: string | null;
}

// ── LLM Config ──────────────────────────────────────────────────────────────

export interface LLMConfigCreate {
  name: string;
  provider: "anthropic" | "openai" | "gemini" | "deepseek" | "xai" | "qwen" | "meta" | "kimi" | "openrouter";
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
  created_at: string;
}

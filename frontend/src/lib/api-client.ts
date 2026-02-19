import type {
  AnalysisResult,
  AnalyzeRequest,
  ConnectionCreate,
  ConnectionResponse,
  ConnectionTestResult,
  LLMConfigCreate,
  LLMConfigResponse,
  ProviderInfo,
  QueryHistoryItem,
} from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(API_KEY ? { "X-API-Key": API_KEY } : {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// Connections
export const listConnections = () =>
  apiFetch<ConnectionResponse[]>("/api/v1/connections");

export const createConnection = (data: ConnectionCreate) =>
  apiFetch<ConnectionResponse>("/api/v1/connections", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const deleteConnection = (id: string) =>
  apiFetch<void>(`/api/v1/connections/${id}`, { method: "DELETE" });

export const testConnection = (id: string) =>
  apiFetch<ConnectionTestResult>(`/api/v1/connections/${id}/test`, {
    method: "POST",
  });

// Analysis
export const analyzeQuery = (data: AnalyzeRequest) =>
  apiFetch<AnalysisResult>("/api/v1/analyze", {
    method: "POST",
    body: JSON.stringify(data),
  });

// History
export const getHistory = (limit = 50) =>
  apiFetch<QueryHistoryItem[]>(`/api/v1/analyze/history?limit=${limit}`);

// LLM Settings
export const listLLMConfigs = () =>
  apiFetch<LLMConfigResponse[]>("/api/v1/llm-settings");

export const createLLMConfig = (data: LLMConfigCreate) =>
  apiFetch<LLMConfigResponse>("/api/v1/llm-settings", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateLLMConfig = (id: string, data: Partial<LLMConfigCreate>) =>
  apiFetch<LLMConfigResponse>(`/api/v1/llm-settings/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const deleteLLMConfig = (id: string) =>
  apiFetch<void>(`/api/v1/llm-settings/${id}`, { method: "DELETE" });

export const activateLLMConfig = (id: string) =>
  apiFetch<LLMConfigResponse>(`/api/v1/llm-settings/${id}/activate`, {
    method: "POST",
  });

export const listProviders = () =>
  apiFetch<ProviderInfo[]>("/api/v1/llm-settings/providers");

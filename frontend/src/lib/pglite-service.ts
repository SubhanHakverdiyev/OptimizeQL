import type {
  ClientExplainResult,
  ClientTableSchema,
} from "./types";

// ── Worker RPC infrastructure ─────────────────────────────────────────────────

let worker: Worker | null = null;
let reqId = 0;
const pending = new Map<
  number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { resolve: (v: any) => void; reject: (e: Error) => void }
>();

function ensureWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./pglite.worker.ts", import.meta.url));
    // Send page origin so the worker can resolve relative asset URLs
    worker.postMessage({ id: 0, type: "setOrigin", origin: location.origin });
    worker.onmessage = (e: MessageEvent) => {
      const { id, result, error } = e.data;
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      if (error) p.reject(new Error(error));
      else p.resolve(result);
    };
  }
  return worker;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function send(type: string, args: Record<string, unknown> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = ++reqId;
    pending.set(id, { resolve, reject });
    ensureWorker().postMessage({ id, type, ...args });
  });
}

// ── Lightweight DB proxy returned by getDB() ─────────────────────────────────

interface DBProxy {
  exec: (sql: string) => Promise<void>;
  query: <T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: T[]; fields: { name: string }[] }>;
}

// ── Public API (same surface as before) ───────────────────────────────────────

export async function initialize(): Promise<void> {
  await send("init");
}

export async function getDB(): Promise<DBProxy> {
  await send("init");
  return {
    exec: (sql: string) => send("exec", { sql }),
    query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) =>
      send("query", { sql, params }) as Promise<{
        rows: T[];
        fields: { name: string }[];
      }>,
  };
}

export function isReady(): boolean {
  return worker !== null;
}

export async function executeDDL(
  ddl: string,
): Promise<{ tables: string[]; error: string | null }> {
  return send("executeDDL", { ddl });
}

export async function resetPlannerSettings(): Promise<void> {
  await send("resetPlannerSettings");
}

export async function runExplainAnalyze(
  sql: string,
): Promise<ClientExplainResult> {
  return send("runExplainAnalyze", { sql });
}

export async function getTableSchemas(
  tableNames: string[],
): Promise<ClientTableSchema[]> {
  return send("getTableSchemas", { tableNames });
}

export async function reset(): Promise<void> {
  if (worker) {
    await send("reset");
    worker.terminate();
    worker = null;
    pending.clear();
  }
}

export async function runAnalyze(): Promise<void> {
  await send("runAnalyze");
}

export async function inflateTableStats(
  tableNames: string[],
  fakeRows = 10_000_000,
): Promise<void> {
  await send("inflateTableStats", { tableNames, fakeRows });
}

export async function generateAndInsertData(
  ddl: string,
  tables: string[],
  rowCount = 10000,
  query?: string,
): Promise<{ emptyTables: string[] }> {
  return send("generateAndInsertData", { ddl, tables, rowCount, query });
}

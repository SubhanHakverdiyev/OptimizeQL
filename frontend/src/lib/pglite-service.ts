import type {
  ClientExplainResult,
  ClientTableSchema,
  ClientTableColumn,
  ClientTableIndex,
  ClientColumnStat,
} from "./types";

type PGliteWorkerType = import("@electric-sql/pglite/worker").PGliteWorker;

let db: PGliteWorkerType | null = null;
let rawWorker: Worker | null = null;

async function getOrCreate(): Promise<PGliteWorkerType> {
  if (db) return db;
  const { PGliteWorker } = await import("@electric-sql/pglite/worker");
  rawWorker = new Worker(new URL("./pglite.worker.ts", import.meta.url));
  db = await PGliteWorker.create(rawWorker);
  return db;
}

export async function initialize(): Promise<void> {
  await getOrCreate();
}

export async function getDB(): Promise<PGliteWorkerType> {
  return getOrCreate();
}

export function isReady(): boolean {
  return db !== null;
}

export async function executeDDL(
  ddl: string,
): Promise<{ tables: string[]; error: string | null }> {
  const pg = await getOrCreate();
  try {
    await pg.exec(ddl);
    const res = await pg.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
    );
    return { tables: res.rows.map((r) => r.table_name), error: null };
  } catch (err) {
    return { tables: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export async function resetPlannerSettings(): Promise<void> {
  const pg = await getOrCreate();
  await pg.exec(`
    SET enable_seqscan = on;
    SET enable_indexscan = on;
    SET enable_bitmapscan = on;
    SET enable_sort = on;
    SET enable_hashjoin = on;
    SET enable_mergejoin = on;
    SET enable_nestloop = on;
  `);
}

export async function runExplainAnalyze(
  sql: string,
): Promise<ClientExplainResult> {
  const pg = await getOrCreate();
  await resetPlannerSettings();
  const res = await pg.query<{ "QUERY PLAN": string }>(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${sql}`,
  );

  const lines = res.rows.map((r) => r["QUERY PLAN"]);
  const rawPlan = lines.join("\n");

  let planningTime: number | null = null;
  let executionTime: number | null = null;

  for (const line of lines) {
    const planMatch = line.match(/Planning Time:\s*([\d.]+)\s*ms/i);
    if (planMatch) planningTime = parseFloat(planMatch[1]);
    const execMatch = line.match(/Execution Time:\s*([\d.]+)\s*ms/i);
    if (execMatch) executionTime = parseFloat(execMatch[1]);
  }

  return {
    raw_plan: rawPlan,
    planning_time_ms: planningTime,
    execution_time_ms: executionTime,
  };
}

export async function getTableSchemas(
  tableNames: string[],
): Promise<ClientTableSchema[]> {
  const pg = await getOrCreate();
  const schemas: ClientTableSchema[] = [];

  for (const tableName of tableNames) {
    // Columns
    const colRes = await pg.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_name = $1 AND table_schema = 'public'
       ORDER BY ordinal_position`,
      [tableName],
    );
    const columns: ClientTableColumn[] = colRes.rows.map((r) => ({
      column_name: r.column_name,
      data_type: r.data_type,
      is_nullable: r.is_nullable,
      column_default: r.column_default,
    }));

    // Indexes
    const idxRes = await pg.query<{
      indexname: string;
      indexdef: string;
    }>(
      `SELECT indexname, indexdef FROM pg_indexes
       WHERE tablename = $1 AND schemaname = 'public'`,
      [tableName],
    );
    const indexes: ClientTableIndex[] = idxRes.rows.map((r) => {
      const isUnique = /CREATE UNIQUE/i.test(r.indexdef);
      const colMatch = r.indexdef.match(/\(([^)]+)\)/);
      const cols = colMatch
        ? colMatch[1].split(",").map((c) => c.trim())
        : [];
      let indexType = "btree";
      const typeMatch = r.indexdef.match(/USING\s+(\w+)/i);
      if (typeMatch) indexType = typeMatch[1].toLowerCase();
      return {
        index_name: r.indexname,
        table_name: tableName,
        columns: cols,
        is_unique: isUnique,
        index_type: indexType,
        definition: r.indexdef,
      };
    });

    // Row count — use COUNT(*) since pg_class.reltuples is unreliable in PGlite
    const countRes = await pg.query<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM "${tableName}"`,
    );
    const rowCount = countRes.rows[0]?.count ?? 0;

    // Column stats
    const statsRes = await pg.query<{
      attname: string;
      null_frac: number;
      avg_width: number;
      n_distinct: number;
    }>(
      `SELECT attname, null_frac, avg_width, n_distinct
       FROM pg_stats WHERE tablename = $1 AND schemaname = 'public'`,
      [tableName],
    );
    const columnStats: ClientColumnStat[] = statsRes.rows.map((r) => ({
      column_name: r.attname,
      null_frac: r.null_frac,
      avg_width: r.avg_width,
      n_distinct: r.n_distinct,
    }));

    schemas.push({
      table_name: tableName,
      columns,
      row_count: rowCount,
      indexes,
      column_stats: columnStats,
    });
  }

  return schemas;
}

export async function reset(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
  }
  if (rawWorker) {
    rawWorker.terminate();
    rawWorker = null;
  }
}

export async function runAnalyze(): Promise<void> {
  const pg = await getOrCreate();
  await pg.exec("ANALYZE");
}

/**
 * Inflate pg_class.reltuples for a table so the planner believes it has
 * many rows.  Uses the "dirty-prime" trick:
 *
 *   1. Write reltuples = 0  (forces ANALYZE to see a real change)
 *   2. ANALYZE              (writes true row count; 0→N fires relcache invalidation)
 *   3. Write reltuples = fakeRows  (relcache is now INVALID → next EXPLAIN reloads this)
 *
 * Without step 1, ANALYZE may write the same value already in pg_class,
 * which does NOT fire relcache invalidation in PGlite's single-process WASM
 * environment, leaving the planner with stale (real) stats.
 */
export async function inflateTableStats(
  tableNames: string[],
  fakeRows = 10_000_000,
): Promise<void> {
  const pg = await getOrCreate();
  for (const table of tableNames) {
    // Sanitize identifier: double any embedded quotes (standard SQL escaping)
    const safeId = table.replace(/"/g, '""');

    // Step 1: dirty-prime — ensure ANALYZE will see a *change*
    await pg.query(
      `UPDATE pg_class SET reltuples = 0 WHERE relname = $1`,
      [table],
    );
    // Step 2: ANALYZE writes real count (0→N = change → invalidation fires)
    await pg.exec(`ANALYZE "${safeId}"`);
    // Step 3: fake — relcache is INVALID, so next access reads our value
    await pg.query(
      `UPDATE pg_class SET reltuples = $1 WHERE relname = $2`,
      [fakeRows, table],
    );
  }
}

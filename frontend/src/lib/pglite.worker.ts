import { PGlite } from "@electric-sql/pglite";
import { generateAndInsertData } from "./data-generator";
import type {
  ClientTableSchema,
  ClientTableColumn,
  ClientTableIndex,
  ClientColumnStat,
} from "./types";

let pg: PGlite | null = null;

async function getOrCreate(): Promise<PGlite> {
  if (!pg) {
    pg = new PGlite();
  }
  return pg;
}

self.onmessage = async (e: MessageEvent) => {
  const { id, type, ...args } = e.data;
  try {
    let result: unknown;

    switch (type) {
      case "init": {
        const db = await getOrCreate();
        await db.exec("SELECT 1");
        result = true;
        break;
      }

      case "exec": {
        const db = await getOrCreate();
        await db.exec(args.sql);
        result = true;
        break;
      }

      case "query": {
        const db = await getOrCreate();
        const res = await db.query(args.sql, args.params);
        result = { rows: res.rows, fields: res.fields };
        break;
      }

      case "executeDDL": {
        const db = await getOrCreate();
        try {
          await db.exec(args.ddl);
          const res = await db.query<{ table_name: string }>(
            `SELECT table_name FROM information_schema.tables
             WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
             ORDER BY table_name`,
          );
          result = {
            tables: res.rows.map((r) => r.table_name),
            error: null,
          };
        } catch (err) {
          result = {
            tables: [],
            error: err instanceof Error ? err.message : String(err),
          };
        }
        break;
      }

      case "resetPlannerSettings": {
        const db = await getOrCreate();
        await db.exec(`
          SET enable_seqscan = on;
          SET enable_indexscan = on;
          SET enable_bitmapscan = on;
          SET enable_sort = on;
          SET enable_hashjoin = on;
          SET enable_mergejoin = on;
          SET enable_nestloop = on;
        `);
        result = true;
        break;
      }

      case "runExplainAnalyze": {
        const db = await getOrCreate();
        await db.exec(`
          SET enable_seqscan = on;
          SET enable_indexscan = on;
          SET enable_bitmapscan = on;
          SET enable_sort = on;
          SET enable_hashjoin = on;
          SET enable_mergejoin = on;
          SET enable_nestloop = on;
        `);
        const res = await db.query<{ "QUERY PLAN": string }>(
          `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${args.sql}`,
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
        result = {
          raw_plan: rawPlan,
          planning_time_ms: planningTime,
          execution_time_ms: executionTime,
        };
        break;
      }

      case "getTableSchemas": {
        const db = await getOrCreate();
        const schemas: ClientTableSchema[] = [];

        for (const tableName of args.tableNames as string[]) {
          const colRes = await db.query<{
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

          const idxRes = await db.query<{
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

          const countRes = await db.query<{ count: number }>(
            `SELECT COUNT(*)::int as count FROM "${tableName}"`,
          );
          const rowCount = countRes.rows[0]?.count ?? 0;

          const statsRes = await db.query<{
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
        result = schemas;
        break;
      }

      case "reset": {
        if (pg) {
          await pg.close();
          pg = null;
        }
        result = true;
        break;
      }

      case "runAnalyze": {
        const db = await getOrCreate();
        await db.exec("ANALYZE");
        result = true;
        break;
      }

      case "inflateTableStats": {
        const db = await getOrCreate();
        const fakeRows = args.fakeRows ?? 10_000_000;
        for (const table of args.tableNames as string[]) {
          const safeId = table.replace(/"/g, '""');
          await db.query(
            `UPDATE pg_class SET reltuples = 0 WHERE relname = $1`,
            [table],
          );
          await db.exec(`ANALYZE "${safeId}"`);
          await db.query(
            `UPDATE pg_class SET reltuples = $1 WHERE relname = $2`,
            [fakeRows, table],
          );
        }
        result = true;
        break;
      }

      case "generateAndInsertData": {
        const db = await getOrCreate();
        result = await generateAndInsertData(
          args.ddl,
          args.tables,
          db,
          args.rowCount ?? 10000,
          args.query,
        );
        break;
      }

      default:
        throw new Error(`Unknown message type: ${type}`);
    }

    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({
      id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};

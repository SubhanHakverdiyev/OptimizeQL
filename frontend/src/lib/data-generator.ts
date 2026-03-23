import type { ClientTableColumn } from "./types";

type PGliteInstance = import("@electric-sql/pglite").PGlite;

/**
 * Hint extracted from the user's query.
 * - "exact": column = 'value'
 * - "year": EXTRACT(YEAR FROM col) = 2023
 * - "gte_interval": col >= NOW() - INTERVAL 'X days'
 * - "gte_date": col >= 'YYYY-MM-DD' (direct date range)
 */
interface QueryHint {
  column: string;
  kind: "exact" | "year" | "gte_interval" | "gte_date";
  value: string;
}

/** Tiered hint probabilities — higher for exact values (Verify needs matches) */
const HINT_PROBABILITY: Record<QueryHint["kind"], number> = {
  exact: 0.70,
  year: 0.60,
  gte_interval: 0.60,
  gte_date: 0.60,
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface TableInfo {
  name: string;
  columns: ClientTableColumn[];
  fkDeps: { column: string; refTable: string; refColumn: string }[];
}

export async function generateAndInsertData(
  ddl: string,
  tables: string[],
  pg: { exec: PGliteInstance["exec"]; query: PGliteInstance["query"] },
  rowCount = 10000,
  query?: string,
): Promise<{ emptyTables: string[] }> {
  const { faker } = await import("@faker-js/faker");
  faker.seed(42);

  // ── Parse query hints ───────────────────────────────────────────────────
  const queryHints = query ? parseQueryHints(query) : [];

  // ── Group hints by column name for efficient lookup ─────────────────────
  const hintsByColumn = new Map<string, QueryHint[]>();
  for (const h of queryHints) {
    const existing = hintsByColumn.get(h.column) || [];
    existing.push(h);
    hintsByColumn.set(h.column, existing);
  }

  // ── Parse FK dependencies from DDL ──────────────────────────────────────
  const explicitFkRegex =
    /FOREIGN\s+KEY\s*\((\w+)\)\s*REFERENCES\s+(\w+)\s*\((\w+)\)/gi;
  const inlineFkRegex =
    /(\w+)\s+\w+(?:\([^)]*\))?(?:\s+(?:NOT\s+NULL|NULL|UNIQUE|DEFAULT\s+\S+))*\s+REFERENCES\s+(\w+)\s*\((\w+)\)/gi;
  const fkMap = new Map<
    string,
    { column: string; refTable: string; refColumn: string }[]
  >();

  let match;
  const tableBlocks = ddl.split(/(?=CREATE\s+TABLE)/i);
  for (const block of tableBlocks) {
    const tableMatch = block.match(
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i,
    );
    if (!tableMatch) continue;
    const tableName = tableMatch[1].toLowerCase();
    const fks: { column: string; refTable: string; refColumn: string }[] = [];
    const seen = new Set<string>();

    explicitFkRegex.lastIndex = 0;
    while ((match = explicitFkRegex.exec(block)) !== null) {
      const key = `${match[1].toLowerCase()}->${match[2].toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        fks.push({
          column: match[1].toLowerCase(),
          refTable: match[2].toLowerCase(),
          refColumn: match[3].toLowerCase(),
        });
      }
    }

    inlineFkRegex.lastIndex = 0;
    while ((match = inlineFkRegex.exec(block)) !== null) {
      const key = `${match[1].toLowerCase()}->${match[2].toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        fks.push({
          column: match[1].toLowerCase(),
          refTable: match[2].toLowerCase(),
          refColumn: match[3].toLowerCase(),
        });
      }
    }

    if (fks.length > 0) fkMap.set(tableName, fks);
  }

  // ── Parse PRIMARY KEY columns from DDL ──────────────────────────────────
  const pkColumns = new Map<string, Set<string>>();
  for (const block of tableBlocks) {
    const tableMatch = block.match(
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i,
    );
    if (!tableMatch) continue;
    const tableName = tableMatch[1].toLowerCase();
    const pks = new Set<string>();

    // Inline PK: col_name TYPE ... PRIMARY KEY
    const inlinePkRegex = /(\w+)\s+\w+(?:\([^)]*\))?[^,\n]*PRIMARY\s+KEY/gi;
    inlinePkRegex.lastIndex = 0;
    while ((match = inlinePkRegex.exec(block)) !== null) {
      pks.add(match[1].toLowerCase());
    }

    // Explicit PK: PRIMARY KEY (col1, col2)
    const explicitPkRegex = /PRIMARY\s+KEY\s*\(([^)]+)\)/gi;
    explicitPkRegex.lastIndex = 0;
    while ((match = explicitPkRegex.exec(block)) !== null) {
      const cols = match[1].split(",").map((c) => c.trim().toLowerCase());
      for (const c of cols) pks.add(c);
    }

    if (pks.size > 0) pkColumns.set(tableName, pks);
  }

  // ── Parse UNIQUE constraints from DDL ───────────────────────────────────
  const uniqueColumns = new Map<string, Set<string>>();
  for (const block of tableBlocks) {
    const tableMatch = block.match(
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i,
    );
    if (!tableMatch) continue;
    const tableName = tableMatch[1].toLowerCase();
    const uq = new Set<string>();

    const inlineUqRegex = /(\w+)\s+\w+(?:\([^)]*\))?[^,\n]*\bUNIQUE\b/gi;
    inlineUqRegex.lastIndex = 0;
    while ((match = inlineUqRegex.exec(block)) !== null) {
      if (!/PRIMARY\s+KEY/i.test(match[0])) {
        uq.add(match[1].toLowerCase());
      }
    }

    if (uq.size > 0) uniqueColumns.set(tableName, uq);
  }

  // ── Topological sort: insert parent tables first ────────────────────────
  const sorted = topoSort(tables, fkMap);

  // ── Decide row counts per table ─────────────────────────────────────────
  // Only reduce row count for pure parent tables (referenced by others via FK
  // but have no outgoing FKs themselves). Standalone tables with no FK
  // relationships get full rowCount so the dataset is large enough for indexes.
  const referencedTables = new Set<string>();
  for (const fks of fkMap.values()) {
    for (const fk of fks) {
      referencedTables.add(fk.refTable.toLowerCase());
    }
  }
  const tableRowCounts = new Map<string, number>();
  for (const t of sorted) {
    const isParent = referencedTables.has(t) && !fkMap.has(t);
    if (isParent) {
      tableRowCounts.set(t, Math.max(Math.floor(rowCount / 5), 500));
    } else {
      tableRowCounts.set(t, rowCount);
    }
  }

  // ── Generate and insert data ────────────────────────────────────────────
  const insertedIds = new Map<string, number[]>();

  for (const tableName of sorted) {
    const colRes = await pg.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
      character_maximum_length: number | null;
    }>(
      `SELECT column_name, data_type, is_nullable, column_default,
              character_maximum_length
       FROM information_schema.columns
       WHERE table_name = $1 AND table_schema = 'public'
       ORDER BY ordinal_position`,
      [tableName],
    );

    const columns = colRes.rows;
    const fks = fkMap.get(tableName) || [];
    const tablePks = pkColumns.get(tableName) || new Set<string>();
    const tableUqs = uniqueColumns.get(tableName) || new Set<string>();
    const thisRowCount = tableRowCounts.get(tableName) || rowCount;

    // Skip SERIAL/identity columns (they auto-generate).
    // But KEEP non-serial PK columns — we generate sequential IDs for them.
    const insertCols = columns.filter((c) => {
      const def = c.column_default || "";
      if (def.includes("nextval") || def.includes("generated")) return false;
      return true;
    });

    if (insertCols.length === 0) continue;

    const colNames = insertCols.map((c) => `"${c.column_name}"`).join(", ");
    const ids: number[] = [];

    // Detect which insertCols are non-serial PKs (need sequential IDs)
    const isNonSerialPk = insertCols.map((c) =>
      tablePks.has(c.column_name.toLowerCase()),
    );

    // Track UNIQUE columns — we suffix them with index to avoid collisions
    const isUniqueCol = insertCols.map((c) =>
      tableUqs.has(c.column_name.toLowerCase()),
    );

    // Composite FK PK tables (e.g. post_tags) need special handling
    const compositePkFkCols = insertCols.filter(
      (c) =>
        tablePks.has(c.column_name.toLowerCase()) &&
        fks.some((f) => f.column === c.column_name.toLowerCase()),
    );
    const isCompositeFkPk = compositePkFkCols.length >= 2;

    const batchSize = 500;

    if (isCompositeFkPk) {
      // Junction tables: generate unique FK pair combinations
      const fkCols = compositePkFkCols.map((c) => {
        const fk = fks.find(
          (f) => f.column === c.column_name.toLowerCase(),
        )!;
        return { col: c, fk };
      });

      const parentIdLists = fkCols.map(
        (fc) => insertedIds.get(fc.fk.refTable) || [],
      );

      const pairs: number[][] = [];
      if (
        parentIdLists.length === 2 &&
        parentIdLists[0].length > 0 &&
        parentIdLists[1].length > 0
      ) {
        const [listA, listB] = parentIdLists;
        const maxPairs = Math.min(thisRowCount, listA.length * listB.length);
        const usedPairs = new Set<string>();
        let attempts = 0;
        while (pairs.length < maxPairs && attempts < maxPairs * 3) {
          attempts++;
          const a = listA[Math.floor(Math.random() * listA.length)];
          const b = listB[Math.floor(Math.random() * listB.length)];
          const key = `${a}:${b}`;
          if (!usedPairs.has(key)) {
            usedPairs.add(key);
            pairs.push([a, b]);
          }
        }
      }

      for (let batch = 0; batch < pairs.length; batch += batchSize) {
        const end = Math.min(batch + batchSize, pairs.length);
        const valueSets: string[] = [];
        for (let i = batch; i < end; i++) {
          const vals = insertCols.map((col) => {
            const fkIdx = fkCols.findIndex(
              (fc) => fc.col.column_name === col.column_name,
            );
            if (fkIdx >= 0) return String(pairs[i][fkIdx]);
            const colHints = hintsByColumn.get(col.column_name.toLowerCase()) || [];
            return generateValue(col, i, faker, false, colHints, col.character_maximum_length);
          });
          valueSets.push(`(${vals.join(", ")})`);
        }
        try {
          await pg.exec(
            `INSERT INTO "${tableName}" (${colNames}) VALUES ${valueSets.join(", ")}`,
          );
        } catch (e) {
          console.warn(
            `[data-gen] Insert failed for junction "${tableName}":`,
            (e as Error).message ?? e,
          );
        }

        // Yield to browser so UI stays responsive
        if (batch % (batchSize * 4) === 0) {
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      insertedIds.set(tableName, []);
      continue;
    }

    // ── Normal table insertion ──────────────────────────────────────────
    for (let batch = 0; batch < thisRowCount; batch += batchSize) {
      const end = Math.min(batch + batchSize, thisRowCount);
      const valueSets: string[] = [];

      for (let i = batch; i < end; i++) {
        const vals = insertCols.map((col, colIdx) => {
          // Non-serial PK → sequential ID
          if (isNonSerialPk[colIdx]) {
            return String(i + 1);
          }
          // FK column → pick from parent IDs
          const fk = fks.find(
            (f) => f.column === col.column_name.toLowerCase(),
          );
          if (fk) {
            const parentIds = insertedIds.get(fk.refTable);
            if (parentIds && parentIds.length > 0) {
              return String(
                parentIds[Math.floor(Math.random() * parentIds.length)],
              );
            }
            return String((i % 1000) + 1);
          }
          const colHints = hintsByColumn.get(col.column_name.toLowerCase()) || [];
          return generateValue(col, i, faker, isUniqueCol[colIdx], colHints, col.character_maximum_length);
        });
        valueSets.push(`(${vals.join(", ")})`);
      }

      const returningClause = hasIdColumn(columns) ? "id" : "1 as id";
      const sql = `INSERT INTO "${tableName}" (${colNames}) VALUES ${valueSets.join(", ")} RETURNING ${returningClause}`;
      try {
        const res = await pg.query<{ id: number }>(sql);
        for (const row of res.rows) {
          if (row.id != null) ids.push(Number(row.id));
        }
      } catch {
        // If RETURNING fails, try without it
        try {
          const sqlNoReturn = `INSERT INTO "${tableName}" (${colNames}) VALUES ${valueSets.join(", ")}`;
          await pg.exec(sqlNoReturn);
        } catch (e2) {
          console.warn(
            `[data-gen] Insert failed for "${tableName}":`,
            (e2 as Error).message ?? e2,
          );
          break;
        }
      }

      // Yield to the browser every few batches so the UI stays responsive
      if (batch % (batchSize * 4) === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    // Query actual IDs from the table (handles RETURNING failures & sequence mismatches)
    if (ids.length === 0 && hasIdColumn(columns)) {
      try {
        const idRes = await pg.query<{ id: number }>(
          `SELECT id FROM "${tableName}" ORDER BY id`,
        );
        for (const row of idRes.rows) {
          if (row.id != null) ids.push(Number(row.id));
        }
      } catch {
        // Best effort — child tables will use fallback values
      }
    }

    insertedIds.set(tableName, ids);
  }

  // Run ANALYZE so pg_stats is populated
  await pg.exec("ANALYZE");

  // Check for tables that ended up empty (insert failures)
  const emptyTables: string[] = [];
  for (const tableName of sorted) {
    const countRes = await pg.query<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM "${tableName}"`,
    );
    if (countRes.rows[0]?.cnt === "0") {
      emptyTables.push(tableName);
    }
  }

  return { emptyTables };
}

function hasIdColumn(columns: { column_name: string }[]): boolean {
  return columns.some((c) => c.column_name.toLowerCase() === "id");
}

/**
 * Generate a type-appropriate filler value that is NOT a hinted value.
 * Used for the non-hint percentage of hinted columns to ensure n_distinct > 1.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateFiller(type: string, faker: any, maxLen?: number | null): string {
  if (
    type.includes("int") ||
    type.includes("serial") ||
    type === "bigint" ||
    type === "smallint"
  )
    return String(faker.number.int({ min: 1, max: 10000 }));
  if (
    type.includes("numeric") ||
    type.includes("decimal") ||
    type === "double precision" ||
    type === "real" ||
    type === "float"
  )
    return String(
      faker.number.float({ min: 0, max: 1000, fractionDigits: 2 }),
    );
  if (type.includes("timestamp") || type === "timestamptz")
    return `'${generateRecentBiasedDate().toISOString()}'`;
  if (type === "date")
    return `'${generateRecentBiasedDate().toISOString().split("T")[0]}'`;
  if (type === "boolean" || type === "bool")
    return faker.datatype.boolean() ? "true" : "false";
  // Default: random word for text/varchar/char
  const w = faker.lorem.word() as string;
  return esc(maxLen ? w.slice(0, maxLen) : w);
}

/**
 * Generate a synthetic value for a column.
 * @param isUnique – if true, append the index to guarantee uniqueness
 * @param colHints – query-extracted hints for THIS column only
 * @param maxLen – character_maximum_length from information_schema (if any)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateValue(
  col: ClientTableColumn,
  index: number,
  faker: any,
  isUnique = false,
  colHints: QueryHint[] = [],
  maxLen?: number | null,
): string {
  const name = col.column_name.toLowerCase();
  const type = col.data_type.toLowerCase();

  // ── Apply query hints (highest priority, fully overrides heuristics) ────
  // When a column has hints, NEVER fall through to name heuristics.
  if (colHints.length > 0) {
    // Pick one hint (for IN clauses there may be multiple exact hints)
    const hint = colHints[Math.floor(Math.random() * colHints.length)];
    const prob = HINT_PROBABILITY[hint.kind];
    const useHint = Math.random() < prob;

    if (!useHint) {
      // Return a type-appropriate filler — do NOT fall through to heuristics
      return generateFiller(type, faker, maxLen);
    }

    if (hint.kind === "exact") {
      if (
        type.includes("int") ||
        type.includes("numeric") ||
        type.includes("decimal") ||
        type === "float" ||
        type === "real" ||
        type === "double precision"
      ) {
        return hint.value;
      }
      return esc(hint.value);
    }
    if (hint.kind === "year") {
      const year = parseInt(hint.value, 10);
      if (!isNaN(year)) {
        const month = Math.floor(Math.random() * 12);
        const day = Math.floor(Math.random() * 28) + 1;
        const hr = Math.floor(Math.random() * 24);
        const min = Math.floor(Math.random() * 60);
        const d = new Date(year, month, day, hr, min);
        if (type === "date") {
          return `'${d.toISOString().split("T")[0]}'`;
        }
        return `'${d.toISOString()}'`;
      }
    }
    if (hint.kind === "gte_date") {
      const start = new Date(hint.value).getTime();
      if (!isNaN(start)) {
        const d = new Date(start + Math.random() * 365 * 86_400_000);
        if (type === "date") {
          return `'${d.toISOString().split("T")[0]}'`;
        }
        return `'${d.toISOString()}'`;
      }
    }
    if (hint.kind === "gte_interval") {
      const days = parseInt(hint.value, 10);
      if (!isNaN(days)) {
        const now = Date.now();
        const DAY = 86_400_000;
        const d = new Date(now - Math.random() * days * DAY);
        if (type === "date") {
          return `'${d.toISOString().split("T")[0]}'`;
        }
        return `'${d.toISOString()}'`;
      }
    }

    // Hint kind didn't produce a value (shouldn't happen), use filler
    return generateFiller(type, faker, maxLen);
  }

  // ── Universal column-name heuristics (no hint matched) ──────────────────
  // Skip name heuristics entirely for temporal/boolean types so that columns
  // like "last_restocked TIMESTAMP" don't get matched by the "stock" rule.
  const _skipNameHeuristics =
    type.includes("timestamp") || type === "timestamptz" ||
    type === "date" || type === "time" ||
    type === "boolean" || type === "bool";

  if (!_skipNameHeuristics) {
    if (name.includes("email"))
      return esc(`user${index}@${faker.internet.domainName()}`);
    if (name.includes("first_name")) return esc(faker.person.firstName());
    if (name.includes("last_name")) return esc(faker.person.lastName());
    if (name === "name" || name.includes("full_name")) {
      const v = faker.person.fullName() as string;
      const raw = isUnique ? `${v} ${index}` : v;
      return esc(trunc(raw, maxLen));
    }
    if (name.includes("username"))
      return esc(`user_${index}`);
    if (name.includes("phone")) return esc(faker.phone.number());
    if (name.includes("address") || name.includes("street"))
      return esc(faker.location.streetAddress());
    if (name.includes("city")) return esc(faker.location.city());
    if (name.includes("country")) return esc(faker.location.country());
    if (name.includes("zip") || name.includes("postal"))
      return esc(faker.location.zipCode());
    if (name.includes("url") || name.includes("website"))
      return esc(faker.internet.url());
    if (name.includes("title")) {
      const v = faker.lorem.sentence({ min: 2, max: 5 }) as string;
      const raw = isUnique ? `${v} #${index}` : v;
      return esc(trunc(raw, maxLen));
    }
    if (
      name.includes("description") ||
      name.includes("body") ||
      name.includes("bio") ||
      name.includes("content")
    )
      return esc(trunc(faker.lorem.paragraph() as string, maxLen));
    if (
      name.includes("price") ||
      name.includes("amount") ||
      name.includes("cost") ||
      name.includes("total")
    )
      return String(faker.commerce.price({ min: 1, max: 999 }));
    if (name.includes("rating") || name.includes("score") || name.includes("stars"))
      return String(faker.number.int({ min: 1, max: 5 }));
    if (
      name.includes("quantity") ||
      name.includes("qty") ||
      name.includes("count") ||
      name.includes("stock")
    )
      return String(faker.number.int({ min: 1, max: 100 }));
    if (name.includes("slug"))
      return esc(`${faker.helpers.slugify(faker.lorem.words(3))}-${index}`);
  }

  // ── Type-based fallback ─────────────────────────────────────────────────
  if (
    type.includes("int") ||
    type.includes("serial") ||
    type === "bigint" ||
    type === "smallint"
  )
    return String(faker.number.int({ min: 1, max: 10000 }));
  if (type === "boolean" || type === "bool")
    return faker.datatype.boolean() ? "true" : "false";
  if (type === "uuid") return `'${faker.string.uuid()}'`;

  // ── Timestamps biased toward recent dates ───────────────────────────────
  if (type.includes("timestamp") || type === "timestamptz") {
    if (name.includes("published") || name.includes("expires")) {
      return `'${faker.date.past({ years: 2 }).toISOString()}'`;
    }
    return `'${generateRecentBiasedDate().toISOString()}'`;
  }
  if (type === "date") {
    return `'${generateRecentBiasedDate().toISOString().split("T")[0]}'`;
  }
  if (type === "time")
    return `'${faker.date.past().toTimeString().split(" ")[0]}'`;
  if (
    type.includes("numeric") ||
    type.includes("decimal") ||
    type === "double precision" ||
    type === "real" ||
    type === "float"
  )
    return String(
      faker.number.float({ min: 0, max: 1000, fractionDigits: 2 }),
    );
  if (type === "json" || type === "jsonb")
    return `'${JSON.stringify({ key: faker.lorem.word(), value: index })}'`;
  if (type.includes("char") || type === "text" || type.includes("varchar")) {
    const v = faker.lorem.words({ min: 1, max: 4 }) as string;
    const raw = isUnique ? `${v} ${index}` : v;
    return esc(trunc(raw, maxLen));
  }
  if (type === "bytea")
    return `'\\x${faker.string.hexadecimal({ length: 8 }).slice(2)}'`;
  if (type === "inet") return `'${faker.internet.ipv4()}'`;

  // Default
  return esc(faker.lorem.word());
}

function esc(val: string): string {
  return `'${val.replace(/'/g, "''")}'`;
}

/** Truncate a string to maxLen if defined. */
function trunc(val: string, maxLen?: number | null): string {
  return maxLen && val.length > maxLen ? val.slice(0, maxLen) : val;
}

// ── Query Hint Parser ─────────────────────────────────────────────────────

/**
 * Extract column→value hints from a SQL query.
 * Patterns matched:
 *   col = 'value'  /  col = number
 *   EXTRACT(YEAR FROM col) = number
 *   col >= NOW() - INTERVAL 'N days/months'
 *   col >= 'YYYY-MM-DD'
 *   col IN ('a', 'b', 'c')
 */
function parseQueryHints(query: string): QueryHint[] {
  const hints: QueryHint[] = [];
  const seen = new Set<string>();

  // Strip optional table alias (e.g. "o.order_date" → "order_date")
  const bare = (col: string) => {
    const parts = col.split(".");
    return parts[parts.length - 1].toLowerCase();
  };

  let m;

  // Pattern 1: col = 'string_value' or col = number
  const eqRegex =
    /(?:\w+\.)?(\w+)\s*=\s*(?:'([^']*)'|(\d+(?:\.\d+)?))/gi;
  while ((m = eqRegex.exec(query)) !== null) {
    const col = bare(m[1]);
    const val = m[2] ?? m[3];
    const key = `exact:${col}:${val}`;
    if (!seen.has(key)) {
      seen.add(key);
      hints.push({ column: col, kind: "exact", value: val });
    }
  }

  // Pattern 2: EXTRACT(YEAR FROM col) = number
  const extractYearRegex =
    /EXTRACT\s*\(\s*YEAR\s+FROM\s+(?:\w+\.)?(\w+)\s*\)\s*=\s*'?(\d{4})'?/gi;
  while ((m = extractYearRegex.exec(query)) !== null) {
    const col = bare(m[1]);
    const key = `year:${col}:${m[2]}`;
    if (!seen.has(key)) {
      seen.add(key);
      hints.push({ column: col, kind: "year", value: m[2] });
    }
  }

  // Pattern 3: col >= NOW() - INTERVAL 'N days/months'
  const intervalRegex =
    /(?:\w+\.)?(\w+)\s*>=\s*NOW\s*\(\s*\)\s*-\s*INTERVAL\s+'(\d+)\s*(day|days|month|months)'/gi;
  while ((m = intervalRegex.exec(query)) !== null) {
    const col = bare(m[1]);
    let days = parseInt(m[2], 10);
    if (m[3].startsWith("month")) days *= 30;
    const key = `gte_interval:${col}:${days}`;
    if (!seen.has(key)) {
      seen.add(key);
      hints.push({ column: col, kind: "gte_interval", value: String(days) });
    }
  }

  // Pattern 4: col >= 'YYYY-MM-DD' (direct date range comparison)
  const gteeDateRegex =
    /(?:\w+\.)?(\w+)\s*>=\s*'(\d{4}-\d{2}-\d{2})'/gi;
  while ((m = gteeDateRegex.exec(query)) !== null) {
    const col = bare(m[1]);
    const key = `gte_date:${col}:${m[2]}`;
    if (!seen.has(key)) {
      seen.add(key);
      hints.push({ column: col, kind: "gte_date", value: m[2] });
    }
  }

  // Pattern 5: col IN ('a', 'b', 'c') → one exact hint per value
  const inRegex = /(?:\w+\.)?(\w+)\s+IN\s*\(([^)]+)\)/gi;
  while ((m = inRegex.exec(query)) !== null) {
    const col = bare(m[1]);
    const valRegex = /'([^']*)'/g;
    let vm;
    while ((vm = valRegex.exec(m[2])) !== null) {
      const key = `exact:${col}:${vm[1]}`;
      if (!seen.has(key)) {
        seen.add(key);
        hints.push({ column: col, kind: "exact", value: vm[1] });
      }
    }
  }

  return hints;
}

/**
 * Generate a date biased toward recent:
 * - 30% within last 30 days
 * - 30% within last 31–90 days
 * - 40% within last 91–730 days
 */
function generateRecentBiasedDate(): Date {
  const now = Date.now();
  const DAY = 86_400_000;
  const r = Math.random();
  if (r < 0.3) {
    return new Date(now - Math.random() * 30 * DAY);
  } else if (r < 0.6) {
    return new Date(now - (31 + Math.random() * 59) * DAY);
  } else {
    return new Date(now - (91 + Math.random() * 639) * DAY);
  }
}

function topoSort(
  tables: string[],
  fkMap: Map<
    string,
    { column: string; refTable: string; refColumn: string }[]
  >,
): string[] {
  const visited = new Set<string>();
  const result: string[] = [];
  const tableSet = new Set(tables.map((t) => t.toLowerCase()));

  function visit(table: string) {
    const lower = table.toLowerCase();
    if (visited.has(lower)) return;
    visited.add(lower);
    const fks = fkMap.get(lower) || [];
    for (const fk of fks) {
      if (
        tableSet.has(fk.refTable.toLowerCase()) &&
        fk.refTable.toLowerCase() !== lower
      ) {
        visit(fk.refTable);
      }
    }
    result.push(lower);
  }

  for (const t of tables) {
    visit(t);
  }
  return result;
}

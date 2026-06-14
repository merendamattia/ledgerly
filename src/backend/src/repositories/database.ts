import { prisma } from "../core/db.ts";

// Read-only introspection of the Postgres `public` schema, powering the
// Database Studio page. Table and column identifiers are always validated
// against information_schema and quoted; user-supplied search is a bound
// parameter. Nothing here mutates data.

export interface ColumnInfo {
  name: string;
  dataType: string;
}

export interface TableData {
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
  total: number;
}

// Double-quote a SQL identifier, escaping embedded quotes.
function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

// JSON.stringify cannot serialize bigint; normalize values defensively.
function jsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, jsonSafe(v)]));
  }
  return value;
}

export const databaseRepository = {
  /** Every base table in the public schema (Prisma's migration table included). */
  async listTables(): Promise<string[]> {
    const rows = await prisma.$queryRaw<{ name: string }[]>`
      SELECT table_name AS name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name`;
    return rows.map((r) => r.name);
  },

  /** Columns of a public-schema table, in declaration order. */
  async describe(table: string): Promise<ColumnInfo[]> {
    return prisma.$queryRaw<ColumnInfo[]>`
      SELECT column_name AS name, data_type AS "dataType"
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table}
      ORDER BY ordinal_position`;
  },

  /**
   * Rows of a table with optional full-text-ish search (ILIKE across every
   * column cast to text) and pagination. Returns null if the table is unknown,
   * which the route maps to 404.
   */
  async read(
    table: string,
    { search, limit, offset }: { search?: string; limit: number; offset: number },
  ): Promise<TableData | null> {
    const columns = await this.describe(table);
    if (columns.length === 0) return null; // unknown / non-public table

    const ident = quoteIdent(table);
    const params: unknown[] = [];
    let where = "";
    if (search) {
      params.push(`%${search}%`);
      const clauses = columns
        .map((col) => `CAST(${quoteIdent(col.name)} AS TEXT) ILIKE $1`)
        .join(" OR ");
      where = `WHERE ${clauses}`;
    }

    const totalRows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT count(*)::bigint AS count FROM ${ident} ${where}`,
      ...params,
    );
    const total = Number(totalRows[0]?.count ?? 0);

    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM ${ident} ${where} ORDER BY 1 LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      ...params,
      limit,
      offset,
    );

    return { columns, rows: rows.map((r) => jsonSafe(r) as Record<string, unknown>), total };
  },
};

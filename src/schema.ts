import type { SQLDialect, Statement } from "./types.ts";

export type SchemaColumnType =
  | "text"
  | "integer"
  | "real"
  | "blob"
  | "boolean"
  | "date"
  | "datetime"
  | "timestamp"
  | "json"
  | "uuid"
  | "unknown";

export interface SchemaColumn {
  name: string;
  type: SchemaColumnType;
  rawType: string;
  nullable: boolean;
  defaultValue: string | null;
  primaryKey: boolean;
}

export interface SchemaTable {
  name: string;
  columns: SchemaColumn[];
}

export interface DatabaseSchema {
  dialect: SQLDialect;
  tables: SchemaTable[];
}

// Normalize SQL types to common types
function normalizeType(rawType: string, dialect: SQLDialect): SchemaColumnType {
  const type = rawType.toLowerCase();

  // Text types
  if (/^(varchar|character|text|char|string|nvarchar|nchar|clob)/.test(type)) {
    return "text";
  }

  // Integer types
  if (
    /^(int|integer|smallint|bigint|tinyint|mediumint|serial|bigserial)/.test(
      type,
    )
  ) {
    return "integer";
  }

  // Real/float types
  if (/^(real|float|double|decimal|numeric|number)/.test(type)) {
    return "real";
  }

  // Boolean types
  if (/^(bool|boolean)/.test(type)) {
    return "boolean";
  }

  // Date/time types
  if (type === "date") return "date";
  if (type.startsWith("datetime")) return "datetime";
  if (type.startsWith("timestamp")) return "timestamp";
  if (type.startsWith("time")) return "datetime";

  // JSON types
  if (type.startsWith("json")) return "json";

  // UUID types
  if (type.startsWith("uuid")) return "uuid";

  // Blob types
  if (/^(blob|bytea|binary|varbinary|image)/.test(type)) return "blob";

  return "unknown";
}

// SQLite schema queries
async function getSQLiteSchema(
  prepare: (sql: string) => Statement,
): Promise<SchemaTable[]> {
  // Get all tables
  const tablesResult = await prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
  ).all();

  const tables: SchemaTable[] = [];

  for (const tableRow of tablesResult as { name: string }[]) {
    const tableName = tableRow.name;

    // Get column info using PRAGMA
    const columnsResult = await prepare(
      `PRAGMA table_info("${tableName}")`,
    ).all();

    const columns: SchemaColumn[] = (
      columnsResult as {
        name: string;
        type: string;
        notnull: number;
        dflt_value: string | null;
        pk: number;
      }[]
    ).map((col) => ({
      name: col.name,
      type: normalizeType(col.type, "sqlite"),
      rawType: col.type,
      nullable: col.notnull === 0,
      defaultValue: col.dflt_value,
      primaryKey: col.pk > 0,
    }));

    tables.push({ name: tableName, columns });
  }

  return tables;
}

// PostgreSQL schema queries
async function getPostgreSQLSchema(
  prepare: (sql: string) => Statement,
): Promise<SchemaTable[]> {
  // Get all tables
  const tablesResult = await prepare(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`,
  ).all();

  const tables: SchemaTable[] = [];

  for (const tableRow of tablesResult as { table_name: string }[]) {
    const tableName = tableRow.table_name;

    // Get column info
    const columnsResult = await prepare(`
      SELECT
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key
      FROM information_schema.columns c
      LEFT JOIN (
        SELECT ku.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
        WHERE tc.table_name = '${tableName}' AND tc.constraint_type = 'PRIMARY KEY'
      ) pk ON c.column_name = pk.column_name
      WHERE c.table_name = '${tableName}' AND c.table_schema = 'public'
      ORDER BY c.ordinal_position
    `).all();

    const columns: SchemaColumn[] = (
      columnsResult as {
        column_name: string;
        data_type: string;
        is_nullable: string;
        column_default: string | null;
        is_primary_key: boolean;
      }[]
    ).map((col) => ({
      name: col.column_name,
      type: normalizeType(col.data_type, "postgresql"),
      rawType: col.data_type,
      nullable: col.is_nullable === "YES",
      defaultValue: col.column_default,
      primaryKey: col.is_primary_key,
    }));

    tables.push({ name: tableName, columns });
  }

  return tables;
}

// MySQL schema queries
async function getMySQLSchema(
  prepare: (sql: string) => Statement,
): Promise<SchemaTable[]> {
  // Get all tables
  const tablesResult = await prepare(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' ORDER BY table_name`,
  ).all();

  const tables: SchemaTable[] = [];

  for (const tableRow of tablesResult as {
    table_name?: string;
    TABLE_NAME?: string;
  }[]) {
    const tableName = tableRow.table_name || tableRow.TABLE_NAME;
    if (!tableName) continue;

    // Get column info
    const columnsResult = await prepare(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default,
        column_key
      FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = '${tableName}'
      ORDER BY ordinal_position
    `).all();

    const columns: SchemaColumn[] = (
      columnsResult as {
        column_name?: string;
        COLUMN_NAME?: string;
        data_type?: string;
        DATA_TYPE?: string;
        is_nullable?: string;
        IS_NULLABLE?: string;
        column_default?: string | null;
        COLUMN_DEFAULT?: string | null;
        column_key?: string;
        COLUMN_KEY?: string;
      }[]
    ).map((col) => ({
      name: (col.column_name || col.COLUMN_NAME)!,
      type: normalizeType((col.data_type || col.DATA_TYPE)!, "mysql"),
      rawType: (col.data_type || col.DATA_TYPE)!,
      nullable: (col.is_nullable || col.IS_NULLABLE) === "YES",
      defaultValue: col.column_default ?? col.COLUMN_DEFAULT ?? null,
      primaryKey: (col.column_key || col.COLUMN_KEY) === "PRI",
    }));

    tables.push({ name: tableName, columns });
  }

  return tables;
}

/**
 * Get database schema for the given dialect
 */
export async function getSchema(
  dialect: SQLDialect,
  prepare: (sql: string) => Statement,
): Promise<DatabaseSchema> {
  let tables: SchemaTable[];

  switch (dialect) {
    case "sqlite":
    case "libsql": {
      tables = await getSQLiteSchema(prepare);
      break;
    }
    case "postgresql": {
      tables = await getPostgreSQLSchema(prepare);
      break;
    }
    case "mysql": {
      tables = await getMySQLSchema(prepare);
      break;
    }
    default: {
      throw new Error(
        `Schema introspection not supported for dialect: ${dialect}`,
      );
    }
  }

  return { dialect, tables };
}

/**
 * better-auth Adapter for db0
 *
 * Provides compatibility layer for using db0 with better-auth's database adapter interface.
 * @see https://www.better-auth.com/docs/concepts/database
 */

import type { Database, DatabaseCapabilities } from "../../types.ts";
import {
  resolveTransformers,
  transformInput,
  transformOutput,
} from "../../transformers.ts";

// ============================================================================
// better-auth Compatible Types
// ============================================================================

/** Where clause operator matching better-auth's interface */
export type WhereOperator =
  | "eq"
  | "ne"
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  | "in"
  | "not_in"
  | "contains"
  | "starts_with"
  | "ends_with";

/** Where clause connector for combining conditions */
export type WhereConnector = "AND" | "OR";

/** Where clause matching better-auth's interface */
export interface Where {
  field: string;
  operator?: WhereOperator;
  value: string | number | boolean | string[] | number[] | Date | null;
  connector?: WhereConnector;
}

/** Cleaned where clause with all fields required */
export interface CleanedWhere {
  field: string;
  operator: WhereOperator;
  value: string | number | boolean | string[] | number[] | Date | null;
  connector: WhereConnector;
}

/** Sort configuration */
export interface SortBy {
  field: string;
  direction: "asc" | "desc";
}

/** Join relationship type */
export type JoinRelation = "one-to-one" | "one-to-many";

/** Join configuration for a single model */
export interface JoinModelConfig {
  on: { from: string; to: string };
  limit?: number;
  relation: JoinRelation;
}

/** Join configuration object */
export type JoinConfig = Record<string, JoinModelConfig>;

/** Join option as passed by better-auth */
export type JoinOption = Record<string, boolean | { limit?: number }>;

// ============================================================================
// Adapter Configuration
// ============================================================================

/** Capability flags matching better-auth's DBAdapterFactoryConfig */
export interface BetterAuthAdapterConfig {
  /** Unique adapter identifier */
  adapterId?: string;
  /** Display name for the adapter */
  adapterName?: string;
  /** Use plural table names (default: false) */
  usePlural?: boolean;
  /** Enable debug logging */
  debugLogs?: boolean;
  /** Whether the database supports numeric IDs (default: true) */
  supportsNumericIds?: boolean;
  /** Whether the database supports UUID type (default: false) */
  supportsUUIDs?: boolean;
  /** Whether the database supports native JSON columns (default: based on capabilities) */
  supportsJSON?: boolean;
  /** Whether the database supports native date columns (default: based on capabilities) */
  supportsDates?: boolean;
  /** Whether the database supports native boolean type (default: based on capabilities) */
  supportsBooleans?: boolean;
  /** Whether the database supports array columns (default: based on capabilities) */
  supportsArrays?: boolean;
  /** Disable automatic ID generation (let the adapter handle it) */
  disableIdGeneration?: boolean;
  /** Custom ID generator function */
  customIdGenerator?: (props: { model: string }) => string;
  /** Map input field names */
  mapKeysTransformInput?: Record<string, string>;
  /** Map output field names */
  mapKeysTransformOutput?: Record<string, string>;
  /** Custom input transformation */
  customTransformInput?: (props: {
    data: unknown;
    field: string;
    model: string;
    action: string;
  }) => unknown;
  /** Custom output transformation */
  customTransformOutput?: (props: {
    data: unknown;
    field: string;
    model: string;
  }) => unknown;
  /** Disable input transformation */
  disableTransformInput?: boolean;
  /** Disable output transformation */
  disableTransformOutput?: boolean;
}

// ============================================================================
// Adapter Interface (compatible with better-auth's DBAdapter)
// ============================================================================

export interface BetterAuthAdapter {
  id: string;

  create<T extends Record<string, unknown>, R = T>(data: {
    model: string;
    data: Omit<T, "id"> & { id?: string | number };
    select?: string[];
    forceAllowId?: boolean;
  }): Promise<R>;

  findOne<T>(data: {
    model: string;
    where: Where[];
    select?: string[];
    join?: JoinOption;
  }): Promise<T | null>;

  findMany<T>(data: {
    model: string;
    where?: Where[];
    limit?: number;
    sortBy?: SortBy;
    offset?: number;
    join?: JoinOption;
  }): Promise<T[]>;

  count(data: { model: string; where?: Where[] }): Promise<number>;

  update<T>(data: {
    model: string;
    where: Where[];
    update: Record<string, unknown>;
  }): Promise<T | null>;

  updateMany(data: {
    model: string;
    where: Where[];
    update: Record<string, unknown>;
  }): Promise<number>;

  delete(data: { model: string; where: Where[] }): Promise<void>;

  deleteMany(data: { model: string; where: Where[] }): Promise<number>;

  transaction<R>(callback: (trx: BetterAuthAdapter) => Promise<R>): Promise<R>;

  /** Resolved capability flags */
  capabilities: ResolvedCapabilities;
}

/** Resolved capability flags exposed on the adapter */
export interface ResolvedCapabilities {
  supportsJSON: boolean;
  supportsBooleans: boolean;
  supportsArrays: boolean;
  supportsDates: boolean;
  supportsUUIDs: boolean;
  supportsTransactions: boolean;
  supportsBatch: boolean;
  supportsNumericIds: boolean;
}

// ============================================================================
// SQL Generation Utilities
// ============================================================================

type SQLDialect = "sqlite" | "libsql" | "postgresql" | "mysql" | "mssql";

function quote(dialect: SQLDialect, identifier: string): string {
  if (dialect === "mysql") return `\`${identifier}\``;
  if (dialect === "mssql") return `[${identifier}]`;
  return `"${identifier}"`;
}

function placeholder(dialect: SQLDialect, index: number): string {
  if (dialect === "postgresql") return `$${index}`;
  if (dialect === "mssql") return `@p${index}`;
  return "?";
}

function cleanWhere(where: Where[]): CleanedWhere[] {
  return where.map((w, i) => ({
    field: w.field,
    operator: w.operator ?? "eq",
    value: w.value,
    connector: i === 0 ? "AND" : (w.connector ?? "AND"),
  }));
}

function buildWhereSQL(
  dialect: SQLDialect,
  where: CleanedWhere[],
  startIndex: number = 1,
): { sql: string; params: unknown[]; nextIndex: number } {
  if (where.length === 0) return { sql: "", params: [], nextIndex: startIndex };

  const parts: string[] = [];
  const params: unknown[] = [];
  let idx = startIndex;

  for (const [i, { field, operator, value, connector }] of where.entries()) {
    const col = quote(dialect, field);
    let condition: string;

    switch (operator) {
      case "eq": {
        if (value === null) {
          condition = `${col} IS NULL`;
        } else {
          condition = `${col} = ${placeholder(dialect, idx++)}`;
          params.push(value);
        }
        break;
      }
      case "ne": {
        if (value === null) {
          condition = `${col} IS NOT NULL`;
        } else {
          condition = `${col} != ${placeholder(dialect, idx++)}`;
          params.push(value);
        }
        break;
      }
      case "lt": {
        condition = `${col} < ${placeholder(dialect, idx++)}`;
        params.push(value);
        break;
      }
      case "lte": {
        condition = `${col} <= ${placeholder(dialect, idx++)}`;
        params.push(value);
        break;
      }
      case "gt": {
        condition = `${col} > ${placeholder(dialect, idx++)}`;
        params.push(value);
        break;
      }
      case "gte": {
        condition = `${col} >= ${placeholder(dialect, idx++)}`;
        params.push(value);
        break;
      }
      case "in": {
        if (Array.isArray(value) && value.length > 0) {
          const placeholders = value
            .map(() => placeholder(dialect, idx++))
            .join(", ");
          condition = `${col} IN (${placeholders})`;
          params.push(...value);
        } else {
          condition = "1 = 0"; // Empty IN clause
        }
        break;
      }
      case "not_in": {
        if (Array.isArray(value) && value.length > 0) {
          const placeholders = value
            .map(() => placeholder(dialect, idx++))
            .join(", ");
          condition = `${col} NOT IN (${placeholders})`;
          params.push(...value);
        } else {
          condition = "1 = 1"; // Empty NOT IN clause
        }
        break;
      }
      case "contains": {
        condition = `${col} LIKE ${placeholder(dialect, idx++)}`;
        params.push(`%${value}%`);
        break;
      }
      case "starts_with": {
        condition = `${col} LIKE ${placeholder(dialect, idx++)}`;
        params.push(`${value}%`);
        break;
      }
      case "ends_with": {
        condition = `${col} LIKE ${placeholder(dialect, idx++)}`;
        params.push(`%${value}`);
        break;
      }
      default: {
        condition = `${col} = ${placeholder(dialect, idx++)}`;
        params.push(value);
      }
    }

    if (i === 0) {
      parts.push(condition);
    } else {
      parts.push(`${connector} ${condition}`);
    }
  }

  return { sql: parts.join(" "), params, nextIndex: idx };
}

function buildSelectSQL(
  dialect: SQLDialect,
  table: string,
  select?: string[],
): string {
  const cols = select?.length
    ? select.map((c) => quote(dialect, c)).join(", ")
    : "*";
  return `SELECT ${cols} FROM ${quote(dialect, table)}`;
}

function buildOrderBySQL(dialect: SQLDialect, sortBy?: SortBy): string {
  if (!sortBy) return "";
  return ` ORDER BY ${quote(dialect, sortBy.field)} ${sortBy.direction.toUpperCase()}`;
}

function buildLimitOffsetSQL(
  dialect: SQLDialect,
  limit?: number,
  offset?: number,
): string {
  let sql = "";
  if (limit !== undefined) sql += ` LIMIT ${limit}`;
  if (offset !== undefined) sql += ` OFFSET ${offset}`;
  return sql;
}

// ============================================================================
// Default ID Generation
// ============================================================================

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${timestamp}${randomPart}`;
}

// ============================================================================
// better-auth Adapter Implementation
// ============================================================================

export function betterAuthAdapter(
  db: Database,
  config?: BetterAuthAdapterConfig,
): BetterAuthAdapter {
  const dialect = db.dialect;
  const dbCapabilities = db.capabilities;

  // Resolve config with defaults based on db capabilities
  const resolvedConfig = {
    adapterId: config?.adapterId ?? "db0",
    adapterName: config?.adapterName ?? "db0",
    usePlural: config?.usePlural ?? false,
    debugLogs: config?.debugLogs ?? false,
    supportsNumericIds: config?.supportsNumericIds ?? true,
    supportsUUIDs: config?.supportsUUIDs ?? dbCapabilities.supportsUUIDs,
    supportsJSON: config?.supportsJSON ?? dbCapabilities.supportsJSON,
    supportsDates: config?.supportsDates ?? dbCapabilities.supportsDates,
    supportsBooleans:
      config?.supportsBooleans ?? dbCapabilities.supportsBooleans,
    supportsArrays: config?.supportsArrays ?? dbCapabilities.supportsArrays,
    disableIdGeneration: config?.disableIdGeneration ?? false,
    customIdGenerator: config?.customIdGenerator,
    mapKeysTransformInput: config?.mapKeysTransformInput ?? {},
    mapKeysTransformOutput: config?.mapKeysTransformOutput ?? {},
    customTransformInput: config?.customTransformInput,
    customTransformOutput: config?.customTransformOutput,
    disableTransformInput: config?.disableTransformInput ?? false,
    disableTransformOutput: config?.disableTransformOutput ?? false,
  };

  // Resolve transformers based on capabilities
  const transformers = resolveTransformers(dbCapabilities, {
    booleans: !resolvedConfig.supportsBooleans,
    dates: !resolvedConfig.supportsDates,
    json: !resolvedConfig.supportsJSON,
    disabled:
      resolvedConfig.disableTransformInput &&
      resolvedConfig.disableTransformOutput,
  });

  // Exposed capability flags
  const capabilities: ResolvedCapabilities = {
    supportsJSON: resolvedConfig.supportsJSON,
    supportsBooleans: resolvedConfig.supportsBooleans,
    supportsArrays: resolvedConfig.supportsArrays,
    supportsDates: resolvedConfig.supportsDates,
    supportsUUIDs: resolvedConfig.supportsUUIDs,
    supportsTransactions: dbCapabilities.supportsTransactions,
    supportsBatch: dbCapabilities.supportsBatch,
    supportsNumericIds: resolvedConfig.supportsNumericIds,
  };

  // Transform input value
  function transformInputValue(value: unknown): unknown {
    if (resolvedConfig.disableTransformInput) return value;
    return transformInput(value, transformers);
  }

  // Transform output value
  function transformOutputValue(value: unknown): unknown {
    if (resolvedConfig.disableTransformOutput) return value;
    return transformOutput(value, transformers);
  }

  // Transform a full record for input
  function transformInputRecord(
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const keyMap = resolvedConfig.mapKeysTransformInput;

    for (const [key, value] of Object.entries(data)) {
      const mappedKey = keyMap[key] ?? key;
      let transformedValue = transformInputValue(value);

      if (resolvedConfig.customTransformInput) {
        transformedValue = resolvedConfig.customTransformInput({
          data: transformedValue,
          field: mappedKey,
          model: "",
          action: "create",
        });
      }

      result[mappedKey] = transformedValue;
    }
    return result;
  }

  // Transform a full record for output
  function transformOutputRecord(
    data: Record<string, unknown> | null,
  ): Record<string, unknown> | null {
    if (!data) return null;
    const result: Record<string, unknown> = {};
    const keyMap = resolvedConfig.mapKeysTransformOutput;
    const reverseKeyMap: Record<string, string> = {};
    for (const [k, v] of Object.entries(keyMap)) {
      reverseKeyMap[v] = k;
    }

    for (const [key, value] of Object.entries(data)) {
      const mappedKey = reverseKeyMap[key] ?? key;
      let transformedValue = transformOutputValue(value);

      // Always convert ID to string for output
      if (
        mappedKey === "id" &&
        transformedValue !== null &&
        transformedValue !== undefined
      ) {
        transformedValue = String(transformedValue);
      }

      if (resolvedConfig.customTransformOutput) {
        transformedValue = resolvedConfig.customTransformOutput({
          data: transformedValue,
          field: mappedKey,
          model: "",
        });
      }

      result[mappedKey] = transformedValue;
    }
    return result;
  }

  // Transform where clause values
  function transformWhereClause(where: Where[]): CleanedWhere[] {
    const cleaned = cleanWhere(where);
    return cleaned.map((w) => ({
      ...w,
      field: resolvedConfig.mapKeysTransformInput[w.field] ?? w.field,
      value: transformInputValue(w.value) as CleanedWhere["value"],
    }));
  }

  // Generate ID for new records
  function generateRecordId(model: string): string | undefined {
    if (resolvedConfig.disableIdGeneration) return undefined;
    if (resolvedConfig.customIdGenerator) {
      return resolvedConfig.customIdGenerator({ model });
    }
    return generateId();
  }

  // Create the adapter
  const adapter: BetterAuthAdapter = {
    id: resolvedConfig.adapterId,
    capabilities,

    async create<T extends Record<string, unknown>, R = T>({
      model,
      data,
      select,
      forceAllowId,
    }: {
      model: string;
      data: Omit<T, "id"> & { id?: string | number };
      select?: string[];
      forceAllowId?: boolean;
    }): Promise<R> {
      const tableName = resolvedConfig.usePlural ? `${model}s` : model;
      const inputData = { ...data } as Record<string, unknown>;

      // Handle ID generation
      if (!forceAllowId || !("id" in inputData) || inputData.id === undefined) {
        const generatedId = generateRecordId(model);
        if (generatedId !== undefined) {
          inputData.id = generatedId;
        }
      }

      const transformedData = transformInputRecord(inputData);
      const columns = Object.keys(transformedData);
      const values = Object.values(transformedData);

      // Build INSERT SQL
      const columnsList = columns.map((c) => quote(dialect, c)).join(", ");
      const placeholders = columns
        .map((_, i) => placeholder(dialect, i + 1))
        .join(", ");
      const returningClause =
        dialect === "mysql"
          ? ""
          : ` RETURNING ${select?.length ? select.map((c) => quote(dialect, c)).join(", ") : "*"}`;

      const insertSQL = `INSERT INTO ${quote(dialect, tableName)} (${columnsList}) VALUES (${placeholders})${returningClause}`;

      if (dialect === "mysql") {
        // MySQL doesn't support RETURNING, need to fetch after insert
        await db.prepare(insertSQL).run(...(values as any[]));

        // For MySQL, we need to fetch the record we just inserted
        // Use the ID we generated or LAST_INSERT_ID()
        const idValue =
          transformedData.id ??
          transformedData[resolvedConfig.mapKeysTransformInput.id ?? "id"];
        if (idValue !== undefined) {
          const selectSQL = buildSelectSQL(dialect, tableName, select);
          const whereSQL = ` WHERE ${quote(dialect, resolvedConfig.mapKeysTransformInput.id ?? "id")} = ?`;
          const rows = (await db
            .prepare(selectSQL + whereSQL)
            .all(idValue as string | number)) as Record<string, unknown>[];
          return transformOutputRecord(rows[0] ?? null) as R;
        }

        // Fallback: return transformed input data
        return transformOutputRecord(transformedData) as R;
      }

      const rows = (await db
        .prepare(insertSQL)
        .all(...(values as any[]))) as Record<string, unknown>[];
      return transformOutputRecord(rows[0] ?? null) as R;
    },

    async findOne<T>({
      model,
      where,
      select,
    }: {
      model: string;
      where: Where[];
      select?: string[];
      join?: JoinOption;
    }): Promise<T | null> {
      const tableName = resolvedConfig.usePlural ? `${model}s` : model;
      const cleanedWhere = transformWhereClause(where);

      let sql = buildSelectSQL(dialect, tableName, select);
      const { sql: whereSQL, params } = buildWhereSQL(dialect, cleanedWhere);

      if (whereSQL) sql += ` WHERE ${whereSQL}`;
      sql += " LIMIT 1";

      const rows = (await db.prepare(sql).all(...(params as any[]))) as Record<
        string,
        unknown
      >[];
      return transformOutputRecord(rows[0] ?? null) as T | null;
    },

    async findMany<T>({
      model,
      where,
      limit = 100,
      sortBy,
      offset,
    }: {
      model: string;
      where?: Where[];
      limit?: number;
      sortBy?: SortBy;
      offset?: number;
      join?: JoinOption;
    }): Promise<T[]> {
      const tableName = resolvedConfig.usePlural ? `${model}s` : model;
      const cleanedWhere = where ? transformWhereClause(where) : [];

      let sql = buildSelectSQL(dialect, tableName);
      const { sql: whereSQL, params } = buildWhereSQL(dialect, cleanedWhere);

      if (whereSQL) sql += ` WHERE ${whereSQL}`;
      sql += buildOrderBySQL(dialect, sortBy);
      sql += buildLimitOffsetSQL(dialect, limit, offset);

      const rows = (await db.prepare(sql).all(...(params as any[]))) as Record<
        string,
        unknown
      >[];
      return rows.map((row) => transformOutputRecord(row) as T);
    },

    async count({
      model,
      where,
    }: {
      model: string;
      where?: Where[];
    }): Promise<number> {
      const tableName = resolvedConfig.usePlural ? `${model}s` : model;
      const cleanedWhere = where ? transformWhereClause(where) : [];

      let sql = `SELECT COUNT(*) as count FROM ${quote(dialect, tableName)}`;
      const { sql: whereSQL, params } = buildWhereSQL(dialect, cleanedWhere);

      if (whereSQL) sql += ` WHERE ${whereSQL}`;

      const rows = (await db.prepare(sql).all(...(params as any[]))) as Record<
        string,
        unknown
      >[];
      const row = rows[0] as Record<string, unknown> | undefined;
      return Number(row?.count ?? row?.["COUNT(*)"] ?? 0);
    },

    async update<T>({
      model,
      where,
      update: updateData,
    }: {
      model: string;
      where: Where[];
      update: Record<string, unknown>;
    }): Promise<T | null> {
      const tableName = resolvedConfig.usePlural ? `${model}s` : model;
      const cleanedWhere = transformWhereClause(where);
      const transformedData = transformInputRecord(updateData);

      const setClauses: string[] = [];
      const setParams: unknown[] = [];
      let idx = 1;

      for (const [key, value] of Object.entries(transformedData)) {
        setClauses.push(
          `${quote(dialect, key)} = ${placeholder(dialect, idx++)}`,
        );
        setParams.push(value);
      }

      const { sql: whereSQL, params: whereParams } = buildWhereSQL(
        dialect,
        cleanedWhere,
        idx,
      );

      const returningClause = dialect === "mysql" ? "" : " RETURNING *";

      const sql = `UPDATE ${quote(dialect, tableName)} SET ${setClauses.join(", ")} WHERE ${whereSQL}${returningClause}`;
      const allParams = [...setParams, ...whereParams];

      if (dialect === "mysql") {
        await db.prepare(sql).run(...(allParams as any[]));
        // Fetch the updated record
        return this.findOne<T>({ model, where, select: undefined });
      }

      const rows = (await db
        .prepare(sql)
        .all(...(allParams as any[]))) as Record<string, unknown>[];
      return transformOutputRecord(rows[0] ?? null) as T | null;
    },

    async updateMany({
      model,
      where,
      update: updateData,
    }: {
      model: string;
      where: Where[];
      update: Record<string, unknown>;
    }): Promise<number> {
      const tableName = resolvedConfig.usePlural ? `${model}s` : model;
      const cleanedWhere = transformWhereClause(where);
      const transformedData = transformInputRecord(updateData);

      const setClauses: string[] = [];
      const setParams: unknown[] = [];
      let idx = 1;

      for (const [key, value] of Object.entries(transformedData)) {
        setClauses.push(
          `${quote(dialect, key)} = ${placeholder(dialect, idx++)}`,
        );
        setParams.push(value);
      }

      const { sql: whereSQL, params: whereParams } = buildWhereSQL(
        dialect,
        cleanedWhere,
        idx,
      );

      const sql = `UPDATE ${quote(dialect, tableName)} SET ${setClauses.join(", ")} WHERE ${whereSQL}`;
      const allParams = [...setParams, ...whereParams];

      const result = await db.prepare(sql).run(...(allParams as any[]));
      return (result as any)?.changes ?? (result as any)?.rowsAffected ?? 0;
    },

    async delete({
      model,
      where,
    }: {
      model: string;
      where: Where[];
    }): Promise<void> {
      const tableName = resolvedConfig.usePlural ? `${model}s` : model;
      const cleanedWhere = transformWhereClause(where);
      const { sql: whereSQL, params } = buildWhereSQL(dialect, cleanedWhere);

      const sql = `DELETE FROM ${quote(dialect, tableName)} WHERE ${whereSQL}`;
      await db.prepare(sql).run(...(params as any[]));
    },

    async deleteMany({
      model,
      where,
    }: {
      model: string;
      where: Where[];
    }): Promise<number> {
      const tableName = resolvedConfig.usePlural ? `${model}s` : model;
      const cleanedWhere = transformWhereClause(where);
      const { sql: whereSQL, params } = buildWhereSQL(dialect, cleanedWhere);

      const sql = `DELETE FROM ${quote(dialect, tableName)} WHERE ${whereSQL}`;
      const result = await db.prepare(sql).run(...(params as any[]));
      return (result as any)?.changes ?? (result as any)?.rowsAffected ?? 0;
    },

    async transaction<R>(
      callback: (trx: BetterAuthAdapter) => Promise<R>,
    ): Promise<R> {
      if (!dbCapabilities.supportsTransactions) {
        // Run without transaction support (as-is)
        return callback(adapter);
      }

      return db.transaction(async (tx) => {
        // Create a transaction-scoped adapter
        const txAdapter: BetterAuthAdapter = {
          ...adapter,
          async create(args) {
            const tableName = resolvedConfig.usePlural
              ? `${args.model}s`
              : args.model;
            const inputData = { ...args.data } as Record<string, unknown>;

            if (
              !args.forceAllowId ||
              !("id" in inputData) ||
              inputData.id === undefined
            ) {
              const generatedId = generateRecordId(args.model);
              if (generatedId !== undefined) inputData.id = generatedId;
            }

            const transformedData = transformInputRecord(inputData);
            const columns = Object.keys(transformedData);
            const values = Object.values(transformedData);

            const columnsList = columns
              .map((c) => quote(dialect, c))
              .join(", ");
            const placeholders = columns
              .map((_, i) => placeholder(dialect, i + 1))
              .join(", ");
            const returningClause =
              dialect === "mysql"
                ? ""
                : ` RETURNING ${args.select?.length ? args.select.map((c) => quote(dialect, c)).join(", ") : "*"}`;

            const insertSQL = `INSERT INTO ${quote(dialect, tableName)} (${columnsList}) VALUES (${placeholders})${returningClause}`;

            if (dialect === "mysql") {
              await tx.prepare(insertSQL).run(...(values as any[]));
              const idValue =
                transformedData.id ??
                transformedData[
                  resolvedConfig.mapKeysTransformInput.id ?? "id"
                ];
              if (idValue !== undefined) {
                const selectSQL = buildSelectSQL(
                  dialect,
                  tableName,
                  args.select,
                );
                const whereSQL = ` WHERE ${quote(dialect, resolvedConfig.mapKeysTransformInput.id ?? "id")} = ?`;
                const rows = (await tx
                  .prepare(selectSQL + whereSQL)
                  .all(idValue as string | number)) as Record<
                  string,
                  unknown
                >[];
                return transformOutputRecord(rows[0] ?? null) as any;
              }
              return transformOutputRecord(transformedData) as any;
            }

            const rows = (await tx
              .prepare(insertSQL)
              .all(...(values as any[]))) as Record<string, unknown>[];
            return transformOutputRecord(rows[0] ?? null) as any;
          },

          async findOne(args) {
            const tableName = resolvedConfig.usePlural
              ? `${args.model}s`
              : args.model;
            const cleanedWhere = transformWhereClause(args.where);

            let sql = buildSelectSQL(dialect, tableName, args.select);
            const { sql: whereSQL, params } = buildWhereSQL(
              dialect,
              cleanedWhere,
            );

            if (whereSQL) sql += ` WHERE ${whereSQL}`;
            sql += " LIMIT 1";

            const rows = (await tx
              .prepare(sql)
              .all(...(params as any[]))) as Record<string, unknown>[];
            return transformOutputRecord(rows[0] ?? null) as any;
          },

          async findMany(args) {
            const tableName = resolvedConfig.usePlural
              ? `${args.model}s`
              : args.model;
            const cleanedWhere = args.where
              ? transformWhereClause(args.where)
              : [];

            let sql = buildSelectSQL(dialect, tableName);
            const { sql: whereSQL, params } = buildWhereSQL(
              dialect,
              cleanedWhere,
            );

            if (whereSQL) sql += ` WHERE ${whereSQL}`;
            sql += buildOrderBySQL(dialect, args.sortBy);
            sql += buildLimitOffsetSQL(dialect, args.limit ?? 100, args.offset);

            const rows = (await tx
              .prepare(sql)
              .all(...(params as any[]))) as Record<string, unknown>[];
            return rows.map((row) => transformOutputRecord(row) as any);
          },

          async count(args) {
            const tableName = resolvedConfig.usePlural
              ? `${args.model}s`
              : args.model;
            const cleanedWhere = args.where
              ? transformWhereClause(args.where)
              : [];

            let sql = `SELECT COUNT(*) as count FROM ${quote(dialect, tableName)}`;
            const { sql: whereSQL, params } = buildWhereSQL(
              dialect,
              cleanedWhere,
            );

            if (whereSQL) sql += ` WHERE ${whereSQL}`;

            const rows = (await tx
              .prepare(sql)
              .all(...(params as any[]))) as Record<string, unknown>[];
            const row = rows[0] as Record<string, unknown> | undefined;
            return Number(row?.count ?? row?.["COUNT(*)"] ?? 0);
          },

          async update(args) {
            const tableName = resolvedConfig.usePlural
              ? `${args.model}s`
              : args.model;
            const cleanedWhere = transformWhereClause(args.where);
            const transformedData = transformInputRecord(args.update);

            const setClauses: string[] = [];
            const setParams: unknown[] = [];
            let idx = 1;

            for (const [key, value] of Object.entries(transformedData)) {
              setClauses.push(
                `${quote(dialect, key)} = ${placeholder(dialect, idx++)}`,
              );
              setParams.push(value);
            }

            const { sql: whereSQL, params: whereParams } = buildWhereSQL(
              dialect,
              cleanedWhere,
              idx,
            );
            const returningClause = dialect === "mysql" ? "" : " RETURNING *";
            const sql = `UPDATE ${quote(dialect, tableName)} SET ${setClauses.join(", ")} WHERE ${whereSQL}${returningClause}`;
            const allParams = [...setParams, ...whereParams];

            if (dialect === "mysql") {
              await tx.prepare(sql).run(...(allParams as any[]));
              return txAdapter.findOne({
                model: args.model,
                where: args.where,
                select: undefined,
              });
            }

            const rows = (await tx
              .prepare(sql)
              .all(...(allParams as any[]))) as Record<string, unknown>[];
            return transformOutputRecord(rows[0] ?? null) as any;
          },

          async updateMany(args) {
            const tableName = resolvedConfig.usePlural
              ? `${args.model}s`
              : args.model;
            const cleanedWhere = transformWhereClause(args.where);
            const transformedData = transformInputRecord(args.update);

            const setClauses: string[] = [];
            const setParams: unknown[] = [];
            let idx = 1;

            for (const [key, value] of Object.entries(transformedData)) {
              setClauses.push(
                `${quote(dialect, key)} = ${placeholder(dialect, idx++)}`,
              );
              setParams.push(value);
            }

            const { sql: whereSQL, params: whereParams } = buildWhereSQL(
              dialect,
              cleanedWhere,
              idx,
            );
            const sql = `UPDATE ${quote(dialect, tableName)} SET ${setClauses.join(", ")} WHERE ${whereSQL}`;
            const allParams = [...setParams, ...whereParams];

            const result = await tx.prepare(sql).run(...(allParams as any[]));
            return (
              (result as any)?.changes ?? (result as any)?.rowsAffected ?? 0
            );
          },

          async delete(args) {
            const tableName = resolvedConfig.usePlural
              ? `${args.model}s`
              : args.model;
            const cleanedWhere = transformWhereClause(args.where);
            const { sql: whereSQL, params } = buildWhereSQL(
              dialect,
              cleanedWhere,
            );

            const sql = `DELETE FROM ${quote(dialect, tableName)} WHERE ${whereSQL}`;
            await tx.prepare(sql).run(...(params as any[]));
          },

          async deleteMany(args) {
            const tableName = resolvedConfig.usePlural
              ? `${args.model}s`
              : args.model;
            const cleanedWhere = transformWhereClause(args.where);
            const { sql: whereSQL, params } = buildWhereSQL(
              dialect,
              cleanedWhere,
            );

            const sql = `DELETE FROM ${quote(dialect, tableName)} WHERE ${whereSQL}`;
            const result = await tx.prepare(sql).run(...(params as any[]));
            return (
              (result as any)?.changes ?? (result as any)?.rowsAffected ?? 0
            );
          },

          transaction: () => {
            throw new Error("Nested transactions are not supported");
          },
        };

        return callback(txAdapter);
      });
    },
  };

  return adapter;
}

// Re-export types for convenience

export { type TypeTransformerOptions } from "../../transformers.ts";

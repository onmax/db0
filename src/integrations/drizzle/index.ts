import type { Database, Connector, SQLDialect, Primitive } from "db0";
import { DefaultLogger } from "drizzle-orm/logger";
import {
  type DrizzleConfig as DrizzleBaseConfig,
  type RelationalSchemaConfig,
  type TablesRelationalConfig,
  type Table,
  createTableRelationsHelpers,
  extractTablesRelationalConfig,
  getTableName,
  getTableColumns,
  sql,
  eq,
  ne,
  gt,
  gte,
  lt,
  lte,
  like,
  inArray,
  and,
  asc,
  desc,
  count as countFn,
  type SQL,
} from "drizzle-orm";

import {
  BaseSQLiteDatabase,
  SQLiteAsyncDialect,
  type SQLiteTableWithColumns,
} from "drizzle-orm/sqlite-core";
import {
  PgDatabase,
  PgDialect,
  type PgTableWithColumns,
} from "drizzle-orm/pg-core";
import {
  MySqlDatabase,
  MySqlDialect,
  type MySqlTableWithColumns,
} from "drizzle-orm/mysql-core";

import {
  DB0SQLiteSession,
  type DB0SQLiteSessionOptions,
} from "./_sqlite-session.ts";
import {
  DB0PgSession,
  type DB0PgQueryResultHKT,
  type DB0PgSessionOptions,
} from "./_pg-session.ts";
import {
  DB0MySqlSession,
  type DB0MySqlQueryResultHKT,
  type DB0MySqlPreparedQueryHKT,
  type DB0MySqlSessionOptions,
} from "./_mysql-session.ts";

export type DrizzleSQLiteDatabase<
  TSchema extends Record<string, unknown> = Record<string, never>,
> = BaseSQLiteDatabase<"async", any, TSchema>;
export type DrizzlePgDatabase<
  TSchema extends Record<string, unknown> = Record<string, never>,
> = PgDatabase<DB0PgQueryResultHKT, TSchema>;
export type DrizzleMySqlDatabase<
  TSchema extends Record<string, unknown> = Record<string, never>,
> = MySqlDatabase<DB0MySqlQueryResultHKT, DB0MySqlPreparedQueryHKT, TSchema>;

export type DrizzleDatabase<
  TSchema extends Record<string, unknown> = Record<string, never>,
> =
  | DrizzleSQLiteDatabase<TSchema>
  | DrizzlePgDatabase<TSchema>
  | DrizzleMySqlDatabase<TSchema>;

export type DrizzleConfig<
  TSchema extends Record<string, unknown> = Record<string, never>,
> = DrizzleBaseConfig<TSchema>;

type DialectConnector<D extends SQLDialect> = Connector & { dialect: D };
type DatabaseWithDialect<D extends SQLDialect> = Database<DialectConnector<D>>;

export function drizzle<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(
  db: DatabaseWithDialect<"sqlite"> | DatabaseWithDialect<"libsql">,
  config?: DrizzleConfig<TSchema>,
): DrizzleSQLiteDatabase<TSchema>;
export function drizzle<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(
  db: DatabaseWithDialect<"postgresql">,
  config?: DrizzleConfig<TSchema>,
): DrizzlePgDatabase<TSchema>;
export function drizzle<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(
  db: DatabaseWithDialect<"mysql">,
  config?: DrizzleConfig<TSchema>,
): DrizzleMySqlDatabase<TSchema>;
export function drizzle<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(db: Database, config?: DrizzleConfig<TSchema>): DrizzleDatabase<TSchema>;
export function drizzle<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(db: Database, config?: DrizzleConfig<TSchema>): DrizzleDatabase<TSchema> {
  let logger;
  if (config?.logger === true) {
    logger = new DefaultLogger();
  } else if (config?.logger !== false && config?.logger !== undefined) {
    logger = config.logger;
  }
  const schema = buildSchema(config?.schema);

  switch (db.dialect) {
    case "sqlite":
    case "libsql": {
      return createSQLiteInstance(
        db,
        config,
        schema,
        logger,
      ) as DrizzleDatabase<TSchema>;
    }
    case "postgresql": {
      return createPgInstance(
        db,
        config,
        schema,
        logger,
      ) as DrizzleDatabase<TSchema>;
    }
    case "mysql": {
      return createMySqlInstance(
        db,
        config,
        schema,
        logger,
      ) as DrizzleDatabase<TSchema>;
    }
    default: {
      throw new Error(`Unsupported dialect: ${db.dialect}`);
    }
  }
}

function buildSchema<TSchema extends Record<string, unknown>>(
  schema?: TSchema,
): RelationalSchemaConfig<TablesRelationalConfig> | undefined {
  if (!schema) return undefined;
  const tablesConfig = extractTablesRelationalConfig(
    schema,
    createTableRelationsHelpers,
  );
  return {
    fullSchema: schema,
    schema: tablesConfig.tables,
    tableNamesMap: tablesConfig.tableNamesMap,
  };
}

function createSQLiteInstance<TSchema extends Record<string, unknown>>(
  db: Database,
  config: DrizzleConfig<TSchema> | undefined,
  schema: RelationalSchemaConfig<TablesRelationalConfig> | undefined,
  logger: DB0SQLiteSessionOptions["logger"],
): DrizzleSQLiteDatabase<TSchema> {
  const dialect = new SQLiteAsyncDialect({ casing: config?.casing });
  const session = new DB0SQLiteSession(db, dialect, schema, { logger });
  // @ts-expect-error session type mismatch
  return new BaseSQLiteDatabase("async", dialect, session, schema);
}

function createPgInstance<TSchema extends Record<string, unknown>>(
  db: Database,
  config: DrizzleConfig<TSchema> | undefined,
  schema: RelationalSchemaConfig<TablesRelationalConfig> | undefined,
  logger: DB0PgSessionOptions["logger"],
): DrizzlePgDatabase<TSchema> {
  const dialect = new PgDialect({ casing: config?.casing });
  const session = new DB0PgSession(db, dialect, schema, { logger });
  // @ts-expect-error session type mismatch
  return new PgDatabase(dialect, session, schema);
}

function createMySqlInstance<TSchema extends Record<string, unknown>>(
  db: Database,
  config: DrizzleConfig<TSchema> | undefined,
  schema: RelationalSchemaConfig<TablesRelationalConfig> | undefined,
  logger: DB0MySqlSessionOptions["logger"],
): DrizzleMySqlDatabase<TSchema> {
  const dialect = new MySqlDialect({ casing: config?.casing });
  const session = new DB0MySqlSession(db, dialect, schema, { logger });
  // @ts-expect-error session type mismatch
  return new MySqlDatabase(dialect, session, schema, "default");
}

// ============================================================================
// Drizzle Adapter
// ============================================================================

type AnyDrizzleTable =
  | SQLiteTableWithColumns<any>
  | PgTableWithColumns<any>
  | MySqlTableWithColumns<any>;

type TableColumnInfo = {
  name: string;
  dataType: string;
  notNull: boolean;
  hasDefault: boolean;
};

export interface TableDefinition<T extends Table = Table> {
  name: string;
  columns: Record<string, TableColumnInfo>;
  table: T;
}

type ExtractTables<TSchema> = {
  [K in keyof TSchema as TSchema[K] extends Table
    ? K
    : never]: TSchema[K] extends Table ? TSchema[K] : never;
};

type InferSelectModel<T> =
  T extends SQLiteTableWithColumns<infer C>
    ? C["columns"] extends Record<string, any>
      ? { [K in keyof C["columns"]]: C["columns"][K]["_"]["data"] }
      : never
    : T extends PgTableWithColumns<infer C>
      ? C["columns"] extends Record<string, any>
        ? { [K in keyof C["columns"]]: C["columns"][K]["_"]["data"] }
        : never
      : T extends MySqlTableWithColumns<infer C>
        ? C["columns"] extends Record<string, any>
          ? { [K in keyof C["columns"]]: C["columns"][K]["_"]["data"] }
          : never
        : never;

type InferInsertModel<T> =
  T extends SQLiteTableWithColumns<infer C>
    ? C["columns"] extends Record<string, any>
      ? {
          [K in keyof C["columns"] as C["columns"][K]["_"]["notNull"] extends true
            ? C["columns"][K]["_"]["hasDefault"] extends true
              ? never
              : K
            : never]: C["columns"][K]["_"]["data"];
        } & {
          [K in keyof C["columns"] as C["columns"][K]["_"]["notNull"] extends true
            ? C["columns"][K]["_"]["hasDefault"] extends true
              ? K
              : never
            : K]?: C["columns"][K]["_"]["data"] | null;
        }
      : never
    : T extends PgTableWithColumns<infer C>
      ? C["columns"] extends Record<string, any>
        ? {
            [K in keyof C["columns"] as C["columns"][K]["_"]["notNull"] extends true
              ? C["columns"][K]["_"]["hasDefault"] extends true
                ? never
                : K
              : never]: C["columns"][K]["_"]["data"];
          } & {
            [K in keyof C["columns"] as C["columns"][K]["_"]["notNull"] extends true
              ? C["columns"][K]["_"]["hasDefault"] extends true
                ? K
                : never
              : K]?: C["columns"][K]["_"]["data"] | null;
          }
        : never
      : T extends MySqlTableWithColumns<infer C>
        ? C["columns"] extends Record<string, any>
          ? {
              [K in keyof C["columns"] as C["columns"][K]["_"]["notNull"] extends true
                ? C["columns"][K]["_"]["hasDefault"] extends true
                  ? never
                  : K
                : never]: C["columns"][K]["_"]["data"];
            } & {
              [K in keyof C["columns"] as C["columns"][K]["_"]["notNull"] extends true
                ? C["columns"][K]["_"]["hasDefault"] extends true
                  ? K
                  : never
                : K]?: C["columns"][K]["_"]["data"] | null;
            }
          : never
        : never;

export interface DrizzleAdapterResult<TSchema extends Record<string, unknown>> {
  native: DrizzleDatabase<TSchema>;
  tables: {
    [K in keyof ExtractTables<TSchema>]: TableDefinition<
      ExtractTables<TSchema>[K]
    >;
  };
  getTableDefinition: <K extends keyof ExtractTables<TSchema>>(
    key: K,
  ) => TableDefinition<ExtractTables<TSchema>[K]>;
}

export type DrizzleAdapterConfig<TSchema extends Record<string, unknown>> =
  DrizzleConfig<TSchema>;

function isTable(value: unknown): value is Table {
  return (
    value !== null &&
    typeof value === "object" &&
    Symbol.for("drizzle:IsDrizzleTable") in (value as object)
  );
}

function extractTableDefinition<T extends Table>(table: T): TableDefinition<T> {
  const name = getTableName(table);
  const drizzleColumns = getTableColumns(table);
  const columns: Record<string, TableColumnInfo> = {};

  for (const [key, col] of Object.entries(drizzleColumns)) {
    columns[key] = {
      name: col.name,
      dataType: col.dataType,
      notNull: col.notNull,
      hasDefault: col.hasDefault,
    };
  }

  return { name, columns, table };
}

// ============================================================================
// Model API Types
// ============================================================================

type WhereOperator<T> =
  | T
  | { eq: T }
  | { ne: T }
  | { gt: T }
  | { gte: T }
  | { lt: T }
  | { lte: T }
  | { like: T extends string ? string : never }
  | { in: T[] };

type WhereClause<T> = { [K in keyof T]?: WhereOperator<T[K]> };

type SelectFields<T> = (keyof T)[];

export interface FindOneOptions<T> {
  where?: WhereClause<T>;
  select?: SelectFields<T>;
}

type OrderByDirection = "asc" | "desc";
type OrderByClause<T> = { [K in keyof T]?: OrderByDirection };

export interface FindManyOptions<T> {
  where?: WhereClause<T>;
  select?: SelectFields<T>;
  limit?: number;
  offset?: number;
  orderBy?: OrderByClause<T>;
}

export interface UpdateOptions<T> {
  where?: WhereClause<T>;
  data: Partial<T>;
}

export interface DeleteOptions<T> {
  where: WhereClause<T>;
  returning?: boolean;
}

export interface CreateOptions<T> {
  data: T;
}

export interface CreateManyOptions<T> {
  data: T[];
}

export interface CountOptions<T> {
  where?: WhereClause<T>;
}

type PickFields<T, K extends (keyof T)[] | undefined> = K extends (keyof T)[]
  ? Pick<T, K[number]>
  : T;

type DeleteResult<T, Opts extends DeleteOptions<T>> = Opts extends {
  returning: false;
}
  ? number
  : T | null;
type DeleteManyResult<T, Opts extends DeleteOptions<T>> = Opts extends {
  returning: false;
}
  ? number
  : T[];

export interface Model<
  T extends Table,
  TSelect = InferSelectModel<T>,
  TInsert = InferInsertModel<T>,
> {
  findOne<K extends (keyof TSelect)[] | undefined = undefined>(
    options?: FindOneOptions<TSelect> & { select?: K },
  ): Promise<PickFields<TSelect, K> | null>;
  findMany<K extends (keyof TSelect)[] | undefined = undefined>(
    options?: FindManyOptions<TSelect> & { select?: K },
  ): Promise<PickFields<TSelect, K>[]>;
  create(options: CreateOptions<TInsert>): Promise<TSelect>;
  createMany(options: CreateManyOptions<TInsert>): Promise<TSelect[]>;
  update(options: UpdateOptions<TSelect>): Promise<TSelect | null>;
  updateMany(options: UpdateOptions<TSelect>): Promise<TSelect[]>;
  delete<Opts extends DeleteOptions<TSelect>>(
    options: Opts,
  ): Promise<DeleteResult<TSelect, Opts>>;
  deleteMany<Opts extends DeleteOptions<TSelect>>(
    options: Opts,
  ): Promise<DeleteManyResult<TSelect, Opts>>;
  count(options?: CountOptions<TSelect>): Promise<number>;
}

// ============================================================================
// Where Clause Builder
// ============================================================================

function buildWhereClause<T extends AnyDrizzleTable>(
  table: T,
  where?: WhereClause<InferSelectModel<T>>,
): SQL | undefined {
  if (!where) return undefined;
  const columns = getTableColumns(table);
  const conditions: SQL[] = [];

  for (const [key, value] of Object.entries(where)) {
    const column = columns[key];
    if (!column) continue;

    if (value === null || value === undefined) {
      continue;
    }

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const op = value as Record<string, unknown>;
      if ("eq" in op) conditions.push(eq(column, op.eq as Primitive));
      else if ("ne" in op) conditions.push(ne(column, op.ne as Primitive));
      else if ("gt" in op) conditions.push(gt(column, op.gt as Primitive));
      else if ("gte" in op) conditions.push(gte(column, op.gte as Primitive));
      else if ("lt" in op) conditions.push(lt(column, op.lt as Primitive));
      else if ("lte" in op) conditions.push(lte(column, op.lte as Primitive));
      else if ("like" in op) conditions.push(like(column, op.like as string));
      else if ("in" in op)
        conditions.push(inArray(column, op.in as Primitive[]));
    } else {
      conditions.push(eq(column, value as Primitive));
    }
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

function buildSelectColumns<T extends AnyDrizzleTable>(
  table: T,
  select?: (keyof InferSelectModel<T>)[],
): Record<string, any> | undefined {
  if (!select || select.length === 0) return undefined;
  const columns = getTableColumns(table);
  const result: Record<string, any> = {};
  for (const field of select) {
    const col = columns[field as string];
    if (col) result[field as string] = col;
  }
  return result;
}

function buildOrderByClause<T extends AnyDrizzleTable>(
  table: T,
  orderBy?: OrderByClause<InferSelectModel<T>>,
): SQL[] | undefined {
  if (!orderBy) return undefined;
  const columns = getTableColumns(table);
  const clauses: SQL[] = [];

  for (const [key, direction] of Object.entries(orderBy)) {
    const column = columns[key];
    if (!column) continue;
    clauses.push(direction === "desc" ? desc(column) : asc(column));
  }

  return clauses.length > 0 ? clauses : undefined;
}

// ============================================================================
// Model Implementation
// ============================================================================

function createModel<
  TSchema extends Record<string, unknown>,
  TKey extends keyof ExtractTables<TSchema>,
>(
  native: DrizzleDatabase<TSchema>,
  table: ExtractTables<TSchema>[TKey],
  isMySQL: boolean = false,
): Model<ExtractTables<TSchema>[TKey]> {
  type TSelect = InferSelectModel<ExtractTables<TSchema>[TKey]>;
  const drizzleTable = table as AnyDrizzleTable;

  return {
    async findOne<K extends (keyof TSelect)[] | undefined = undefined>(
      options?: FindOneOptions<TSelect> & { select?: K },
    ): Promise<PickFields<TSelect, K> | null> {
      const whereClause = buildWhereClause(drizzleTable, options?.where);
      const selectColumns = buildSelectColumns(
        drizzleTable,
        options?.select as (keyof InferSelectModel<AnyDrizzleTable>)[],
      );

      let query = selectColumns
        ? (native as any).select(selectColumns).from(drizzleTable)
        : (native as any).select().from(drizzleTable);

      if (whereClause) {
        query = query.where(whereClause);
      }

      query = query.limit(1);
      const results = await query;
      return (results[0] ?? null) as PickFields<TSelect, K> | null;
    },

    async findMany<K extends (keyof TSelect)[] | undefined = undefined>(
      options?: FindManyOptions<TSelect> & { select?: K },
    ): Promise<PickFields<TSelect, K>[]> {
      const whereClause = buildWhereClause(drizzleTable, options?.where);
      const selectColumns = buildSelectColumns(
        drizzleTable,
        options?.select as (keyof InferSelectModel<AnyDrizzleTable>)[],
      );
      const orderByClauses = buildOrderByClause(
        drizzleTable,
        options?.orderBy as OrderByClause<InferSelectModel<AnyDrizzleTable>>,
      );

      let query = selectColumns
        ? (native as any).select(selectColumns).from(drizzleTable)
        : (native as any).select().from(drizzleTable);

      if (whereClause) {
        query = query.where(whereClause);
      }

      if (orderByClauses) {
        query = query.orderBy(...orderByClauses);
      }

      if (options?.limit !== undefined) {
        query = query.limit(options.limit);
      }

      if (options?.offset !== undefined) {
        query = query.offset(options.offset);
      }

      const results = await query;
      return results as PickFields<TSelect, K>[];
    },

    async create(options: CreateOptions<any>): Promise<TSelect> {
      const columns = getTableColumns(drizzleTable);
      const insertData: Record<string, any> = {};

      for (const [key, value] of Object.entries(
        options.data as Record<string, unknown>,
      )) {
        if (columns[key]) {
          insertData[key] = value;
        }
      }

      if (isMySQL) {
        // MySQL doesn't support RETURNING - insert then fetch
        const result = await (native as any)
          .insert(drizzleTable)
          .values(insertData);
        const insertId = result.insertId;

        // Find the primary key column (first column with hasDefault, typically auto-increment)
        const pkColumn = Object.entries(columns).find(
          ([, col]) =>
            (col as { hasDefault?: boolean; notNull?: boolean }).hasDefault &&
            (col as { hasDefault?: boolean; notNull?: boolean }).notNull,
        );
        if (pkColumn && insertId) {
          const [pkName] = pkColumn;
          const [found] = await (native as any)
            .select()
            .from(drizzleTable)
            .where(eq((drizzleTable as any)[pkName], insertId))
            .limit(1);
          return found as TSelect;
        }
        // Fallback: return input data merged with any defaults
        return { ...insertData, id: insertId } as unknown as TSelect;
      }

      const results = await (native as any)
        .insert(drizzleTable)
        .values(insertData)
        .returning();
      return results[0] as TSelect;
    },

    async createMany(options: CreateManyOptions<any>): Promise<TSelect[]> {
      if (options.data.length === 0) {
        return [] as TSelect[];
      }

      const columns = getTableColumns(drizzleTable);
      const insertDataArray: Record<string, any>[] = [];

      for (const item of options.data) {
        const insertData: Record<string, any> = {};
        for (const [key, value] of Object.entries(
          item as Record<string, unknown>,
        )) {
          if (columns[key]) {
            insertData[key] = value;
          }
        }
        insertDataArray.push(insertData);
      }

      if (isMySQL) {
        // MySQL doesn't support RETURNING - insert individually to get IDs
        const results: TSelect[] = [];
        const pkColumn = Object.entries(columns).find(
          ([, col]) =>
            (col as { hasDefault?: boolean; notNull?: boolean }).hasDefault &&
            (col as { hasDefault?: boolean; notNull?: boolean }).notNull,
        );

        for (const insertData of insertDataArray) {
          const result = await (native as any)
            .insert(drizzleTable)
            .values(insertData);
          const insertId = result.insertId;

          if (pkColumn && insertId) {
            const [pkName] = pkColumn;
            const [found] = await (native as any)
              .select()
              .from(drizzleTable)
              .where(eq((drizzleTable as any)[pkName], insertId))
              .limit(1);
            if (found) results.push(found as TSelect);
          } else {
            results.push({ ...insertData, id: insertId } as unknown as TSelect);
          }
        }
        return results;
      }

      const results = await (native as any)
        .insert(drizzleTable)
        .values(insertDataArray)
        .returning();
      return results as TSelect[];
    },

    async update(options: UpdateOptions<TSelect>): Promise<TSelect | null> {
      const whereClause = buildWhereClause(drizzleTable, options.where);
      const columns = getTableColumns(drizzleTable);
      const setData: Record<string, any> = {};

      for (const [key, value] of Object.entries(options.data)) {
        if (columns[key]) {
          setData[key] = value;
        }
      }

      if (isMySQL) {
        // MySQL doesn't support RETURNING - find first, then update
        let selectQuery = (native as any).select().from(drizzleTable);
        if (whereClause) {
          selectQuery = selectQuery.where(whereClause);
        }
        const [existing] = await selectQuery.limit(1);
        if (!existing) return null;

        let updateQuery = (native as any).update(drizzleTable).set(setData);
        if (whereClause) {
          updateQuery = updateQuery.where(whereClause);
        }
        await updateQuery;

        // Return the updated record
        return { ...existing, ...setData } as TSelect;
      }

      let query = (native as any).update(drizzleTable).set(setData);

      if (whereClause) {
        query = query.where(whereClause);
      }

      const results = await query.returning();
      return (results[0] ?? null) as TSelect | null;
    },

    async updateMany(options: UpdateOptions<TSelect>): Promise<TSelect[]> {
      const whereClause = buildWhereClause(drizzleTable, options.where);
      const columns = getTableColumns(drizzleTable);
      const setData: Record<string, any> = {};

      for (const [key, value] of Object.entries(options.data)) {
        if (columns[key]) {
          setData[key] = value;
        }
      }

      if (isMySQL) {
        // MySQL doesn't support RETURNING - find all first, then update
        let selectQuery = (native as any).select().from(drizzleTable);
        if (whereClause) {
          selectQuery = selectQuery.where(whereClause);
        }
        const existing = await selectQuery;
        if (existing.length === 0) return [];

        let updateQuery = (native as any).update(drizzleTable).set(setData);
        if (whereClause) {
          updateQuery = updateQuery.where(whereClause);
        }
        await updateQuery;

        // Return the updated records
        return existing.map((row: any) => ({
          ...row,
          ...setData,
        })) as TSelect[];
      }

      let query = (native as any).update(drizzleTable).set(setData);

      if (whereClause) {
        query = query.where(whereClause);
      }

      const results = await query.returning();
      return results as TSelect[];
    },

    async delete(options: DeleteOptions<TSelect>): Promise<any> {
      if (!options.where || Object.keys(options.where).length === 0) {
        throw new Error(
          "delete() requires a where clause to prevent accidental deletion of all records",
        );
      }

      const whereClause = buildWhereClause(drizzleTable, options.where);

      if (isMySQL) {
        // MySQL doesn't support RETURNING
        if (options.returning === false) {
          let query = (native as any).delete(drizzleTable);
          if (whereClause) {
            query = query.where(whereClause);
          }
          const result = await query;
          return result.affectedRows ?? 0;
        }

        // Find first, then delete
        let selectQuery = (native as any).select().from(drizzleTable);
        if (whereClause) {
          selectQuery = selectQuery.where(whereClause);
        }
        const [existing] = await selectQuery.limit(1);
        if (!existing) return null;

        let deleteQuery = (native as any).delete(drizzleTable);
        if (whereClause) {
          deleteQuery = deleteQuery.where(whereClause);
        }
        await deleteQuery;
        return existing;
      }

      let query = (native as any).delete(drizzleTable);

      if (whereClause) {
        query = query.where(whereClause);
      }

      if (options.returning === false) {
        // Count first since some drivers don't return rowCount
        let countQuery = (native as any)
          .select({ count: sql`count(*)` })
          .from(drizzleTable);
        if (whereClause) {
          countQuery = countQuery.where(whereClause);
        }
        const [countResult] = await countQuery;
        const count =
          countResult?.count ??
          countResult?.["count(*)"] ??
          countResult?.value ??
          0;

        await query;
        return Number(count);
      }

      const results = await query.returning();
      return results[0] ?? null;
    },

    async deleteMany(options: DeleteOptions<TSelect>): Promise<any> {
      if (!options.where || Object.keys(options.where).length === 0) {
        throw new Error(
          "deleteMany() requires a where clause to prevent accidental deletion of all records",
        );
      }

      const whereClause = buildWhereClause(drizzleTable, options.where);

      if (isMySQL) {
        // MySQL doesn't support RETURNING
        if (options.returning === false) {
          let query = (native as any).delete(drizzleTable);
          if (whereClause) {
            query = query.where(whereClause);
          }
          const result = await query;
          return result.affectedRows ?? 0;
        }

        // Find all first, then delete
        let selectQuery = (native as any).select().from(drizzleTable);
        if (whereClause) {
          selectQuery = selectQuery.where(whereClause);
        }
        const existing = await selectQuery;

        let deleteQuery = (native as any).delete(drizzleTable);
        if (whereClause) {
          deleteQuery = deleteQuery.where(whereClause);
        }
        await deleteQuery;
        return existing;
      }

      let query = (native as any).delete(drizzleTable);

      if (whereClause) {
        query = query.where(whereClause);
      }

      if (options.returning === false) {
        // Count first since some drivers don't return rowCount
        let countQuery = (native as any)
          .select({ count: sql`count(*)` })
          .from(drizzleTable);
        if (whereClause) {
          countQuery = countQuery.where(whereClause);
        }
        const [countResult] = await countQuery;
        const count =
          countResult?.count ??
          countResult?.["count(*)"] ??
          countResult?.value ??
          0;

        await query;
        return Number(count);
      }

      return query.returning();
    },

    async count(options?: CountOptions<TSelect>): Promise<number> {
      const whereClause = buildWhereClause(drizzleTable, options?.where);
      let query = (native as any)
        .select({ value: countFn() })
        .from(drizzleTable);

      if (whereClause) {
        query = query.where(whereClause);
      }

      const results = await query;
      // drizzle returns count as "count(*)" key regardless of alias
      const row = results[0] as Record<string, unknown>;
      const countValue = row?.value ?? row?.["count(*)"] ?? row?.count ?? 0;
      return Number(countValue);
    },
  };
}

// ============================================================================
// Drizzle Adapter
// ============================================================================

export interface DrizzleAdapterResult<TSchema extends Record<string, unknown>> {
  native: DrizzleDatabase<TSchema>;
  tables: {
    [K in keyof ExtractTables<TSchema>]: TableDefinition<
      ExtractTables<TSchema>[K]
    >;
  };
  getTableDefinition: <K extends keyof ExtractTables<TSchema>>(
    key: K,
  ) => TableDefinition<ExtractTables<TSchema>[K]>;
  model: <K extends keyof ExtractTables<TSchema>>(
    key: K,
  ) => Model<ExtractTables<TSchema>[K]>;
}

export function drizzleAdapter<TSchema extends Record<string, unknown>>(
  db: DatabaseWithDialect<"sqlite"> | DatabaseWithDialect<"libsql">,
  schema: TSchema,
  config?: Omit<DrizzleAdapterConfig<TSchema>, "schema">,
): DrizzleAdapterResult<TSchema>;
export function drizzleAdapter<TSchema extends Record<string, unknown>>(
  db: DatabaseWithDialect<"postgresql">,
  schema: TSchema,
  config?: Omit<DrizzleAdapterConfig<TSchema>, "schema">,
): DrizzleAdapterResult<TSchema>;
export function drizzleAdapter<TSchema extends Record<string, unknown>>(
  db: DatabaseWithDialect<"mysql">,
  schema: TSchema,
  config?: Omit<DrizzleAdapterConfig<TSchema>, "schema">,
): DrizzleAdapterResult<TSchema>;
export function drizzleAdapter<TSchema extends Record<string, unknown>>(
  db: Database,
  schema: TSchema,
  config?: Omit<DrizzleAdapterConfig<TSchema>, "schema">,
): DrizzleAdapterResult<TSchema>;
export function drizzleAdapter<TSchema extends Record<string, unknown>>(
  db: Database,
  schema: TSchema,
  config?: Omit<DrizzleAdapterConfig<TSchema>, "schema">,
): DrizzleAdapterResult<TSchema> {
  const native = drizzle(db, { ...config, schema });
  const isMySQL = db.dialect === "mysql";

  const tables = {} as {
    [K in keyof ExtractTables<TSchema>]: TableDefinition<
      ExtractTables<TSchema>[K]
    >;
  };
  for (const [key, value] of Object.entries(schema)) {
    if (isTable(value)) {
      (tables as Record<string, TableDefinition>)[key] =
        extractTableDefinition(value);
    }
  }

  return {
    native,
    tables,
    getTableDefinition: <K extends keyof ExtractTables<TSchema>>(key: K) =>
      tables[key],
    model: <K extends keyof ExtractTables<TSchema>>(key: K) =>
      createModel(
        native,
        tables[key].table as ExtractTables<TSchema>[K],
        isMySQL,
      ),
  };
}

export type {
  InferSelectModel,
  InferInsertModel,
  WhereClause,
  WhereOperator,
  OrderByClause,
  OrderByDirection,
};

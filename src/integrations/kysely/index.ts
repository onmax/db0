import type { SQLDialect, DatabaseCapabilities } from "db0";

// ============================================================================
// Kysely Type Definitions
// ============================================================================

type ColumnType<Select, Insert = Select, Update = Insert> = {
  readonly __select__: Select;
  readonly __insert__: Insert;
  readonly __update__: Update;
};

type Generated<T> = ColumnType<T, T | undefined, T>;

type AnyColumn = ColumnType<any, any, any> | unknown;

type SelectType<T> = T extends ColumnType<infer S, any, any> ? S : T;
type InsertType<T> = T extends ColumnType<any, infer I, any> ? I : T;
type UpdateType<T> = T extends ColumnType<any, any, infer U> ? U : T;

// Kysely instance interface (minimal for type extraction)
interface KyselyInstance<DB> {
  selectFrom: (table: keyof DB & string) => any;
  insertInto: (table: keyof DB & string) => any;
  updateTable: (table: keyof DB & string) => any;
  deleteFrom: (table: keyof DB & string) => any;
  destroy: () => Promise<void>;
  transaction: () => {
    execute: <T>(fn: (trx: KyselyInstance<DB>) => Promise<T>) => Promise<T>;
  };
}

// ============================================================================
// Type Inference Utilities
// ============================================================================

type ExtractTables<DB> = {
  [K in keyof DB as DB[K] extends Record<string, AnyColumn> ? K : never]: DB[K];
};

type Selectable<T> = { [K in keyof T]: SelectType<T[K]> };
type Insertable<T> = {
  [K in keyof T as T[K] extends ColumnType<any, infer I, any>
    ? undefined extends I
      ? never
      : K
    : K]: InsertType<T[K]>;
} & {
  [K in keyof T as T[K] extends ColumnType<any, infer I, any>
    ? undefined extends I
      ? K
      : never
    : never]?: InsertType<T[K]>;
};
type Updateable<T> = { [K in keyof T]?: UpdateType<T[K]> };

// ============================================================================
// Table Definition Types
// ============================================================================

interface ColumnDefinition {
  name: string;
  isGenerated: boolean;
  isNullable: boolean;
}

export interface TableDefinition<TTable = unknown> {
  name: string;
  columns: Record<string, ColumnDefinition>;
  _types: { table: TTable };
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
  | { in: T[] }
  | { isNull: true }
  | { isNotNull: true };

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

export interface CreateOptions<T> {
  returning?: boolean;
}

export interface UpdateOptions<T, TUpdate> {
  where: WhereClause<T>;
  data: TUpdate;
}

export interface DeleteOptions<T> {
  where: WhereClause<T>;
}

type PickFields<T, K extends (keyof T)[] | undefined> = K extends (keyof T)[]
  ? Pick<T, K[number]>
  : T;

// ============================================================================
// Model Interface
// ============================================================================

export interface Model<TSelect, TInsert, TUpdate> {
  findOne<K extends (keyof TSelect)[] | undefined = undefined>(
    options?: FindOneOptions<TSelect> & { select?: K },
  ): Promise<PickFields<TSelect, K> | null>;
  findMany<K extends (keyof TSelect)[] | undefined = undefined>(
    options?: FindManyOptions<TSelect> & { select?: K },
  ): Promise<PickFields<TSelect, K>[]>;
  create(data: TInsert): Promise<TSelect>;
  createMany(data: TInsert[]): Promise<{ count: number }>;
  update(options: UpdateOptions<TSelect, TUpdate>): Promise<TSelect | null>;
  updateMany(options: UpdateOptions<TSelect, TUpdate>): Promise<TSelect[]>;
  delete(options: DeleteOptions<TSelect>): Promise<TSelect | null>;
  deleteMany(options: DeleteOptions<TSelect>): Promise<{ count: number }>;
  count(options?: { where?: WhereClause<TSelect> }): Promise<number>;
}

// ============================================================================
// Transaction Types
// ============================================================================

export interface KyselyTransaction<DB> {
  native: KyselyInstance<DB>;
  model: <K extends keyof ExtractTables<DB>>(
    name: K,
  ) => Model<
    Selectable<ExtractTables<DB>[K]>,
    Insertable<ExtractTables<DB>[K]>,
    Updateable<ExtractTables<DB>[K]>
  >;
}

export interface TransactionOptions {
  isolationLevel?:
    | "read uncommitted"
    | "read committed"
    | "repeatable read"
    | "serializable";
}

// ============================================================================
// Adapter Result Types
// ============================================================================

export interface KyselyAdapterResult<DB> {
  native: KyselyInstance<DB>;
  dialect: SQLDialect;
  capabilities: DatabaseCapabilities;
  tables: {
    [K in keyof ExtractTables<DB>]: TableDefinition<ExtractTables<DB>[K]>;
  };
  getTableDefinition: <K extends keyof ExtractTables<DB>>(
    name: K,
  ) => TableDefinition<ExtractTables<DB>[K]>;
  model: <K extends keyof ExtractTables<DB>>(
    name: K,
  ) => Model<
    Selectable<ExtractTables<DB>[K]>,
    Insertable<ExtractTables<DB>[K]>,
    Updateable<ExtractTables<DB>[K]>
  >;
  transaction: <T>(
    fn: (tx: KyselyTransaction<DB>) => Promise<T>,
    options?: TransactionOptions,
  ) => Promise<T>;
  dispose: () => Promise<void>;
}

export interface KyselyAdapterConfig {
  dialect?: SQLDialect;
  tableNames?: string[];
}

// ============================================================================
// Dialect Detection
// ============================================================================

function detectDialect(kysely: KyselyInstance<any>): SQLDialect {
  // Try to detect from Kysely's internal dialect
  const internals =
    (kysely as any).getExecutor?.()?.adapter?.constructor?.name ||
    (kysely as any)._dialect?.constructor?.name ||
    (kysely as any).dialect?.constructor?.name;

  if (internals) {
    const dialectName = internals.toLowerCase();
    if (dialectName.includes("postgres") || dialectName.includes("pg"))
      return "postgresql";
    if (dialectName.includes("mysql")) return "mysql";
    if (dialectName.includes("sqlite")) return "sqlite";
  }

  return "postgresql";
}

function getCapabilities(dialect: SQLDialect): DatabaseCapabilities {
  switch (dialect) {
    case "postgresql": {
      return {
        supportsJSON: true,
        supportsBooleans: true,
        supportsArrays: true,
        supportsDates: true,
        supportsUUIDs: true,
        supportsTransactions: true,
        supportsBatch: true,
      };
    }
    case "mysql": {
      return {
        supportsJSON: true,
        supportsBooleans: true,
        supportsArrays: false,
        supportsDates: true,
        supportsUUIDs: false,
        supportsTransactions: true,
        supportsBatch: true,
      };
    }
    case "sqlite":
    case "libsql": {
      return {
        supportsJSON: true,
        supportsBooleans: false,
        supportsArrays: false,
        supportsDates: false,
        supportsUUIDs: false,
        supportsTransactions: true,
        supportsBatch: true,
      };
    }
    case "mssql": {
      return {
        supportsJSON: true,
        supportsBooleans: true,
        supportsArrays: false,
        supportsDates: true,
        supportsUUIDs: true,
        supportsTransactions: true,
        supportsBatch: true,
      };
    }
  }
}

// ============================================================================
// Where Clause Builder
// ============================================================================

function buildWhereClause<T>(query: any, where?: WhereClause<T>): any {
  if (!where) return query;

  let result = query;
  for (const [key, value] of Object.entries(where)) {
    if (value === null || value === undefined) continue;

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const op = value as Record<string, unknown>;
      if ("eq" in op) result = result.where(key, "=", op.eq);
      else if ("ne" in op) result = result.where(key, "!=", op.ne);
      else if ("gt" in op) result = result.where(key, ">", op.gt);
      else if ("gte" in op) result = result.where(key, ">=", op.gte);
      else if ("lt" in op) result = result.where(key, "<", op.lt);
      else if ("lte" in op) result = result.where(key, "<=", op.lte);
      else if ("like" in op) result = result.where(key, "like", op.like);
      else if ("in" in op) result = result.where(key, "in", op.in);
      else if ("isNull" in op) result = result.where(key, "is", null);
      else if ("isNotNull" in op) result = result.where(key, "is not", null);
    } else {
      result = result.where(key, "=", value);
    }
  }

  return result;
}

function buildOrderByClause<T>(query: any, orderBy?: OrderByClause<T>): any {
  if (!orderBy) return query;

  let result = query;
  for (const [key, direction] of Object.entries(orderBy)) {
    result = result.orderBy(key, direction);
  }

  return result;
}

// ============================================================================
// Model Implementation
// ============================================================================

function createModel<DB, K extends keyof ExtractTables<DB>>(
  kysely: KyselyInstance<DB>,
  tableName: K,
): Model<
  Selectable<ExtractTables<DB>[K]>,
  Insertable<ExtractTables<DB>[K]>,
  Updateable<ExtractTables<DB>[K]>
> {
  type TSelect = Selectable<ExtractTables<DB>[K]>;
  type TInsert = Insertable<ExtractTables<DB>[K]>;
  type TUpdate = Updateable<ExtractTables<DB>[K]>;

  const table = tableName as keyof DB & string;

  return {
    async findOne<F extends (keyof TSelect)[] | undefined = undefined>(
      options?: FindOneOptions<TSelect> & { select?: F },
    ): Promise<PickFields<TSelect, F> | null> {
      let query = kysely.selectFrom(table);

      query =
        options?.select && options.select.length > 0
          ? query.select(options.select as string[])
          : query.selectAll();

      query = buildWhereClause(query, options?.where);
      query = query.limit(1);

      const results = await query.execute();
      return (results[0] ?? null) as PickFields<TSelect, F> | null;
    },

    async findMany<F extends (keyof TSelect)[] | undefined = undefined>(
      options?: FindManyOptions<TSelect> & { select?: F },
    ): Promise<PickFields<TSelect, F>[]> {
      let query = kysely.selectFrom(table);

      query =
        options?.select && options.select.length > 0
          ? query.select(options.select as string[])
          : query.selectAll();

      query = buildWhereClause(query, options?.where);
      query = buildOrderByClause(query, options?.orderBy);

      if (options?.limit !== undefined) {
        query = query.limit(options.limit);
      }

      if (options?.offset !== undefined) {
        query = query.offset(options.offset);
      }

      const results = await query.execute();
      return results as PickFields<TSelect, F>[];
    },

    async create(data: TInsert): Promise<TSelect> {
      const result = await kysely
        .insertInto(table)
        .values(data as any)
        .returningAll()
        .executeTakeFirstOrThrow();
      return result as TSelect;
    },

    async createMany(data: TInsert[]): Promise<{ count: number }> {
      const result = await kysely
        .insertInto(table)
        .values(data as any[])
        .execute();
      const insertedRows =
        result.length > 0
          ? ((result[0] as any).numInsertedOrUpdatedRows ?? data.length)
          : data.length;
      return { count: Number(insertedRows) };
    },

    async update(
      options: UpdateOptions<TSelect, TUpdate>,
    ): Promise<TSelect | null> {
      let query = kysely.updateTable(table).set(options.data as any);
      query = buildWhereClause(query, options.where);

      const results = await query.returningAll().execute();
      return (results[0] ?? null) as TSelect | null;
    },

    async updateMany(
      options: UpdateOptions<TSelect, TUpdate>,
    ): Promise<TSelect[]> {
      let query = kysely.updateTable(table).set(options.data as any);
      query = buildWhereClause(query, options.where);

      const results = await query.returningAll().execute();
      return results as TSelect[];
    },

    async delete(options: DeleteOptions<TSelect>): Promise<TSelect | null> {
      if (!options.where || Object.keys(options.where).length === 0) {
        throw new Error(
          "delete() requires a where clause to prevent accidental deletion of all records",
        );
      }

      let query = kysely.deleteFrom(table);
      query = buildWhereClause(query, options.where);

      const results = await query.returningAll().execute();
      return (results[0] ?? null) as TSelect | null;
    },

    async deleteMany(
      options: DeleteOptions<TSelect>,
    ): Promise<{ count: number }> {
      if (!options.where || Object.keys(options.where).length === 0) {
        throw new Error(
          "deleteMany() requires a where clause to prevent accidental deletion of all records",
        );
      }

      let query = kysely.deleteFrom(table);
      query = buildWhereClause(query, options.where);

      const results = await query.returningAll().execute();
      return { count: results.length };
    },

    async count(options?: { where?: WhereClause<TSelect> }): Promise<number> {
      let query = kysely
        .selectFrom(table)
        .select((eb: any) => eb.fn.countAll().as("count"));

      query = buildWhereClause(query, options?.where);

      const result = await query.executeTakeFirst();
      return Number((result as any)?.count ?? 0);
    },
  };
}

// ============================================================================
// Kysely Adapter
// ============================================================================

export function kyselyAdapter<DB>(
  kysely: KyselyInstance<DB>,
  config?: KyselyAdapterConfig,
): KyselyAdapterResult<DB> {
  const dialect = config?.dialect ?? detectDialect(kysely);
  const capabilities = getCapabilities(dialect);

  // Build tables metadata from config or introspection
  const tableNames = config?.tableNames ?? [];
  const tables = {} as KyselyAdapterResult<DB>["tables"];

  for (const name of tableNames) {
    (tables as any)[name] = {
      name,
      columns: {},
      _types: {},
    };
  }

  return {
    native: kysely,
    dialect,
    capabilities,
    tables,

    getTableDefinition<K extends keyof ExtractTables<DB>>(name: K) {
      const def = (tables as any)[name];
      if (!def) {
        // Create on-demand if not in config
        return { name: String(name), columns: {}, _types: {} } as any;
      }
      return def;
    },

    model<K extends keyof ExtractTables<DB>>(name: K) {
      return createModel(kysely, name);
    },

    async transaction<T>(
      fn: (tx: KyselyTransaction<DB>) => Promise<T>,
      _options?: TransactionOptions,
    ): Promise<T> {
      return kysely.transaction().execute(async (trx) => {
        const tx: KyselyTransaction<DB> = {
          native: trx as unknown as KyselyInstance<DB>,
          model<K extends keyof ExtractTables<DB>>(modelName: K) {
            return createModel(trx as unknown as KyselyInstance<DB>, modelName);
          },
        };
        return fn(tx);
      });
    },

    async dispose() {
      await kysely.destroy();
    },
  };
}

export type {
  KyselyInstance,
  ExtractTables,
  Selectable,
  Insertable,
  Updateable,
  Generated,
  ColumnType,
  WhereClause,
  WhereOperator,
  OrderByClause,
  OrderByDirection,
};

import {
  type Logger,
  type RelationalSchemaConfig,
  type Query,
  type TablesRelationalConfig,
  NoopLogger,
} from "drizzle-orm";
import * as drizzleUtils from "drizzle-orm/utils";
import {
  MySqlDialect,
  MySqlSession,
  MySqlPreparedQuery,
  MySqlTransaction,
} from "drizzle-orm/mysql-core";
import type {
  MySqlTransactionConfig,
  MySqlQueryResultHKT,
  MySqlPreparedQueryConfig,
  PreparedQueryHKTBase,
  SelectedFieldsOrdered,
} from "drizzle-orm/mysql-core";
import type { Database, Statement } from "db0";

// Type for mapResultRow which is exported at runtime but not in d.ts
const mapResultRow = (
  drizzleUtils as unknown as {
    mapResultRow: (
      columns: SelectedFieldsOrdered,
      row: unknown[],
      joinsNotNullableMap?: Record<string, boolean>,
    ) => Record<string, unknown>;
  }
).mapResultRow;

export interface DB0MySqlSessionOptions {
  logger?: Logger;
}

export interface DB0MySqlQueryResultHKT extends MySqlQueryResultHKT {
  type: unknown[];
}

export interface DB0MySqlPreparedQueryHKT extends PreparedQueryHKTBase {
  type: DB0MySqlPreparedQuery<MySqlPreparedQueryConfig>;
}

export class DB0MySqlSession<
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
> extends MySqlSession<
  DB0MySqlQueryResultHKT,
  DB0MySqlPreparedQueryHKT,
  TFullSchema,
  TSchema
> {
  private logger: Logger;

  constructor(
    private db: Database,
    dialect: MySqlDialect,
    private schema: RelationalSchemaConfig<TSchema> | undefined,
    private options: DB0MySqlSessionOptions = {},
  ) {
    super(dialect);
    this.logger = options.logger ?? new NoopLogger();
  }

  prepareQuery<T extends MySqlPreparedQueryConfig>(
    query: Query,
    fields: SelectedFieldsOrdered | undefined,
    customResultMapper?: (rows: unknown[][]) => T["execute"],
    generatedIds?: Record<string, unknown>[],
    returningIds?: SelectedFieldsOrdered,
  ): DB0MySqlPreparedQuery<T> {
    const stmt = this.db.prepare(query.sql);
    return new DB0MySqlPreparedQuery(
      stmt,
      query,
      this.logger,
      fields,
      customResultMapper,
    );
  }

  override all<T = unknown>(query: any): Promise<T[]> {
    const querySql = this.dialect.sqlToQuery(query);
    this.logger.logQuery(querySql.sql, querySql.params as unknown[]);
    const stmt = this.db.prepare(querySql.sql);
    return stmt.all(...(querySql.params as any[])) as Promise<T[]>;
  }

  override async transaction<T>(
    transaction: (
      tx: MySqlTransaction<
        DB0MySqlQueryResultHKT,
        DB0MySqlPreparedQueryHKT,
        TFullSchema,
        TSchema
      >,
    ) => Promise<T>,
    config?: MySqlTransactionConfig,
  ): Promise<T> {
    throw new Error("transaction is not implemented!");
  }
}

export class DB0MySqlPreparedQuery<
  T extends MySqlPreparedQueryConfig = MySqlPreparedQueryConfig,
> extends MySqlPreparedQuery<T> {
  // joinsNotNullableMap is inherited from MySqlPreparedQuery (defined at runtime)
  declare joinsNotNullableMap: Record<string, boolean> | undefined;

  constructor(
    private stmt: Statement,
    private query: Query,
    private logger: Logger,
    private fields: SelectedFieldsOrdered | undefined,
    private customResultMapper?: (rows: unknown[][]) => T["execute"],
  ) {
    super(undefined, undefined, undefined);
  }

  async execute(
    placeholderValues?: Record<string, unknown>,
  ): Promise<T["execute"]> {
    const params = this.query.params as any[];
    this.logger.logQuery(this.query.sql, params);
    const result = await this.stmt.all(...params);
    if (!this.fields && !this.customResultMapper) {
      return result as T["execute"];
    }
    const rows = this.toArrayRows(result as Record<string, unknown>[]);
    if (this.customResultMapper) {
      return this.customResultMapper(rows);
    }
    return rows.map((row) =>
      mapResultRow(this.fields!, row, this.joinsNotNullableMap),
    ) as T["execute"];
  }

  // eslint-disable-next-line require-yield
  async *iterator(
    _placeholderValues?: Record<string, unknown>,
  ): AsyncGenerator<T["iterator"]> {
    throw new Error("iterator is not implemented!");
  }

  private toArrayRows(rows: Record<string, unknown>[]): unknown[][] {
    return rows.map((row) => this.toArrayRow(row));
  }

  private toArrayRow(row: Record<string, unknown>): unknown[] {
    // Drizzle uses positional mapping (array indices), not key-based mapping.
    // Object.values() preserves insertion order which matches SELECT column order.
    return Object.values(row);
  }
}

import {
  type Logger,
  type RelationalSchemaConfig,
  type Query,
  type TablesRelationalConfig,
  NoopLogger,
} from "drizzle-orm";
import * as drizzleUtils from "drizzle-orm/utils";
import {
  SQLiteAsyncDialect,
  SQLiteSession,
  SQLitePreparedQuery,
} from "drizzle-orm/sqlite-core";
import type {
  PreparedQueryConfig,
  SelectedFieldsOrdered,
  SQLiteExecuteMethod,
  SQLiteTransactionConfig,
} from "drizzle-orm/sqlite-core";
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

export interface DB0SQLiteSessionOptions {
  logger?: Logger;
}

export class DB0SQLiteSession<
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
> extends SQLiteSession<"async", unknown, TFullSchema, TSchema> {
  dialect!: SQLiteAsyncDialect;
  private logger: Logger;

  constructor(
    private db: Database,
    dialect: SQLiteAsyncDialect,
    private schema: RelationalSchemaConfig<TSchema> | undefined,
    private options: DB0SQLiteSessionOptions = {},
  ) {
    super(dialect);
    this.logger = options.logger ?? new NoopLogger();
  }

  prepareQuery(
    query: Query,
    fields: SelectedFieldsOrdered | undefined,
    executeMethod: SQLiteExecuteMethod,
    isResponseInArrayMode: boolean,
    customResultMapper?: (rows: unknown[][]) => unknown,
  ): DB0SQLitePreparedQuery {
    const stmt = this.db.prepare(query.sql);
    return new DB0SQLitePreparedQuery(
      stmt,
      query,
      this.logger,
      fields,
      executeMethod,
      customResultMapper,
    );
  }

  override transaction<T>(
    transaction: (tx: any) => T | Promise<T>,
    config?: SQLiteTransactionConfig,
  ): Promise<T> {
    throw new Error("transaction is not implemented!");
  }
}

export class DB0SQLitePreparedQuery<
  T extends PreparedQueryConfig = PreparedQueryConfig,
> extends SQLitePreparedQuery<{
  type: "async";
  run: Awaited<ReturnType<Statement["run"]>>;
  all: T["all"];
  get: T["get"];
  values: T["values"];
  execute: T["execute"];
}> {
  private fields: SelectedFieldsOrdered | undefined;
  private customResultMapper?: (rows: unknown[][]) => unknown;
  // joinsNotNullableMap is inherited from SQLitePreparedQuery (defined at runtime)
  declare joinsNotNullableMap: Record<string, boolean> | undefined;

  constructor(
    private stmt: Statement,
    query: Query,
    private logger: Logger,
    fields: SelectedFieldsOrdered | undefined,
    executeMethod: SQLiteExecuteMethod,
    customResultMapper?: (rows: unknown[][]) => unknown,
  ) {
    super("async", executeMethod, query);
    this.fields = fields;
    this.customResultMapper = customResultMapper;
  }

  run(): Promise<{ success: boolean }> {
    return this.stmt.run(...(this.query.params as any[]));
  }

  async all(): Promise<unknown[]> {
    const result = await this.stmt.all(...(this.query.params as any[]));
    if (!this.fields && !this.customResultMapper) {
      return result;
    }
    const rows = this.toArrayRows(result as Record<string, unknown>[]);
    if (this.customResultMapper) {
      return this.customResultMapper(rows) as unknown[];
    }
    return rows.map((row) =>
      mapResultRow(this.fields!, row, this.joinsNotNullableMap),
    );
  }

  async get(): Promise<unknown> {
    const result = await this.stmt.get(...(this.query.params as any[]));
    if (!result) return undefined;
    if (!this.fields && !this.customResultMapper) return result;
    const row = this.toArrayRow(result as Record<string, unknown>);
    if (this.customResultMapper) {
      return this.customResultMapper([row]);
    }
    return mapResultRow(this.fields!, row, this.joinsNotNullableMap);
  }

  values(): Promise<unknown[]> {
    return Promise.reject(new Error("values is not implemented!"));
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

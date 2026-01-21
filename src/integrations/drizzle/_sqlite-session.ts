import {
  type Logger,
  type RelationalSchemaConfig,
  type Query,
  type TablesRelationalConfig,
  NoopLogger,
} from "drizzle-orm";
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

  // @ts-expect-error TODO
  prepareQuery(
    query: Query,
    fields: SelectedFieldsOrdered | undefined,
    executeMethod: SQLiteExecuteMethod,
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
  constructor(
    private stmt: Statement,
    query: Query,
    private logger: Logger,
    fields: SelectedFieldsOrdered | undefined,
    executeMethod: SQLiteExecuteMethod,
    customResultMapper?: (rows: unknown[][]) => unknown,
  ) {
    super("async", executeMethod, query);
  }

  run(): Promise<{ success: boolean }> {
    return this.stmt.run(...(this.query.params as any[]));
  }

  all(): Promise<unknown[]> {
    return this.stmt.all(...(this.query.params as any[]));
  }

  get(): Promise<unknown> {
    return this.stmt.get(...(this.query.params as any[]));
  }

  values(): Promise<unknown[]> {
    return Promise.reject(new Error("values is not implemented!"));
  }
}

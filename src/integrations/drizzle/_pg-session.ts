import {
  type Logger,
  type RelationalSchemaConfig,
  type Query,
  type TablesRelationalConfig,
  NoopLogger,
} from "drizzle-orm";
import {
  PgDialect,
  PgSession,
  PgPreparedQuery,
  PgTransaction,
} from "drizzle-orm/pg-core";
import type {
  PgTransactionConfig,
  PgQueryResultHKT,
  SelectedFieldsOrdered,
} from "drizzle-orm/pg-core";
import type { Database, Statement } from "db0";

export interface DB0PgSessionOptions {
  logger?: Logger;
}

export interface DB0PgQueryResultHKT extends PgQueryResultHKT {
  type: { rows: unknown[] };
}

export class DB0PgSession<
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
> extends PgSession<DB0PgQueryResultHKT, TFullSchema, TSchema> {
  private logger: Logger;

  constructor(
    private db: Database,
    dialect: PgDialect,
    private schema: RelationalSchemaConfig<TSchema> | undefined,
    private options: DB0PgSessionOptions = {},
  ) {
    super(dialect);
    this.logger = options.logger ?? new NoopLogger();
  }

  prepareQuery<
    T extends { execute: unknown; all: unknown; values: unknown } = {
      execute: unknown;
      all: unknown;
      values: unknown;
    },
  >(
    query: Query,
    fields: SelectedFieldsOrdered | undefined,
    name: string | undefined,
    isResponseInArrayMode: boolean,
    customResultMapper?: (
      rows: unknown[][],
      mapColumnValue?: (value: unknown) => unknown,
    ) => T["execute"],
  ): DB0PgPreparedQuery<T> {
    const stmt = this.db.prepare(query.sql);
    return new DB0PgPreparedQuery(
      stmt,
      query,
      this.logger,
      fields,
      isResponseInArrayMode,
      customResultMapper,
    );
  }

  override async transaction<T>(
    transaction: (
      tx: PgTransaction<DB0PgQueryResultHKT, TFullSchema, TSchema>,
    ) => Promise<T>,
    config?: PgTransactionConfig,
  ): Promise<T> {
    throw new Error("transaction is not implemented!");
  }
}

export class DB0PgPreparedQuery<
  T extends { execute: unknown; all: unknown; values: unknown } = {
    execute: unknown;
    all: unknown;
    values: unknown;
  },
> extends PgPreparedQuery<T> {
  constructor(
    private stmt: Statement,
    query: Query,
    private logger: Logger,
    private fields: SelectedFieldsOrdered | undefined,
    private _isResponseInArrayMode: boolean,
    private customResultMapper?: (
      rows: unknown[][],
      mapColumnValue?: (value: unknown) => unknown,
    ) => T["execute"],
  ) {
    super(query, undefined, undefined, undefined);
  }

  async execute(
    placeholderValues?: Record<string, unknown>,
  ): Promise<T["execute"]> {
    const params = this.query.params as any[];
    this.logger.logQuery(this.query.sql, params);
    const result = await this.stmt.all(...params);
    if (this.customResultMapper) {
      return this.customResultMapper(result as unknown[][]);
    }
    return result as T["execute"];
  }

  override mapResult(response: unknown, _isFromBatch?: boolean): unknown {
    return response;
  }
}

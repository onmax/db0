import {
  type Logger,
  type RelationalSchemaConfig,
  type Query,
  type TablesRelationalConfig,
  NoopLogger,
} from "drizzle-orm";
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
    if (this.customResultMapper) {
      return this.customResultMapper(result as unknown[][]);
    }
    return result as T["execute"];
  }

  // eslint-disable-next-line require-yield
  async *iterator(
    _placeholderValues?: Record<string, unknown>,
  ): AsyncGenerator<T["iterator"]> {
    throw new Error("iterator is not implemented!");
  }
}

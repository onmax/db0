import type { Database, Connector, SQLDialect } from "db0";
import { DefaultLogger } from "drizzle-orm/logger";
import {
  type DrizzleConfig as DrizzleBaseConfig,
  type RelationalSchemaConfig,
  type TablesRelationalConfig,
  createTableRelationsHelpers,
  extractTablesRelationalConfig,
} from "drizzle-orm";

import {
  BaseSQLiteDatabase,
  SQLiteAsyncDialect,
} from "drizzle-orm/sqlite-core";
import { PgDatabase, PgDialect } from "drizzle-orm/pg-core";
import { MySqlDatabase, MySqlDialect } from "drizzle-orm/mysql-core";

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

import type { Database, Connector } from "db0";
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

import {
  DB0SQLiteSession,
  type DB0SQLiteSessionOptions,
} from "./_sqlite-session.ts";

export type DrizzleSQLiteDatabase<
  TSchema extends Record<string, unknown> = Record<string, never>,
> = BaseSQLiteDatabase<"async", any, TSchema>;

export type DrizzleConfig<
  TSchema extends Record<string, unknown> = Record<string, never>,
> = DrizzleBaseConfig<TSchema>;

type SQLiteDialectConnector = Connector & { dialect: "sqlite" | "libsql" };
type SQLiteDatabaseWithDialect = Database<SQLiteDialectConnector>;

export function drizzle<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(
  db: SQLiteDatabaseWithDialect | Database,
  config?: DrizzleConfig<TSchema>,
): DrizzleSQLiteDatabase<TSchema> {
  let logger: DB0SQLiteSessionOptions["logger"];
  if (config?.logger === true) {
    logger = new DefaultLogger();
  } else if (config?.logger !== false && config?.logger !== undefined) {
    logger = config.logger;
  }

  let schema: RelationalSchemaConfig<TablesRelationalConfig> | undefined;
  if (config?.schema) {
    const tablesConfig = extractTablesRelationalConfig(
      config.schema,
      createTableRelationsHelpers,
    );
    schema = {
      fullSchema: config.schema,
      schema: tablesConfig.tables,
      tableNamesMap: tablesConfig.tableNamesMap,
    };
  }

  const dialect = new SQLiteAsyncDialect({ casing: config?.casing });
  const session = new DB0SQLiteSession(db, dialect, schema, { logger });
  // @ts-expect-error session type mismatch
  return new BaseSQLiteDatabase("async", dialect, session, schema);
}

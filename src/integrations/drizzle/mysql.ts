import type { Database, Connector } from "db0";
import { DefaultLogger } from "drizzle-orm/logger";
import {
  type DrizzleConfig as DrizzleBaseConfig,
  type RelationalSchemaConfig,
  type TablesRelationalConfig,
  createTableRelationsHelpers,
  extractTablesRelationalConfig,
} from "drizzle-orm";
import { MySqlDatabase, MySqlDialect } from "drizzle-orm/mysql-core";

import {
  DB0MySqlSession,
  type DB0MySqlQueryResultHKT,
  type DB0MySqlPreparedQueryHKT,
  type DB0MySqlSessionOptions,
} from "./_mysql-session.ts";

export type DrizzleMySqlDatabase<
  TSchema extends Record<string, unknown> = Record<string, never>,
> = MySqlDatabase<DB0MySqlQueryResultHKT, DB0MySqlPreparedQueryHKT, TSchema>;

export type DrizzleConfig<
  TSchema extends Record<string, unknown> = Record<string, never>,
> = DrizzleBaseConfig<TSchema>;

type MySqlDialectConnector = Connector & { dialect: "mysql" };
type MySqlDatabaseWithDialect = Database<MySqlDialectConnector>;

export function drizzle<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(
  db: MySqlDatabaseWithDialect | Database,
  config?: DrizzleConfig<TSchema>,
): DrizzleMySqlDatabase<TSchema> {
  let logger: DB0MySqlSessionOptions["logger"];
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

  const dialect = new MySqlDialect({ casing: config?.casing });
  const session = new DB0MySqlSession(db, dialect, schema, { logger });
  // @ts-expect-error session type mismatch
  return new MySqlDatabase(dialect, session, schema, "default");
}

export {
  type DB0MySqlQueryResultHKT,
  type DB0MySqlPreparedQueryHKT,
} from "./_mysql-session.ts";

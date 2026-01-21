import type { Database, Connector } from "db0";
import { DefaultLogger } from "drizzle-orm/logger";
import {
  type DrizzleConfig as DrizzleBaseConfig,
  type RelationalSchemaConfig,
  type TablesRelationalConfig,
  createTableRelationsHelpers,
  extractTablesRelationalConfig,
} from "drizzle-orm";
import { PgDatabase, PgDialect } from "drizzle-orm/pg-core";

import {
  DB0PgSession,
  type DB0PgQueryResultHKT,
  type DB0PgSessionOptions,
} from "./_pg-session.ts";

export type DrizzlePgDatabase<
  TSchema extends Record<string, unknown> = Record<string, never>,
> = PgDatabase<DB0PgQueryResultHKT, TSchema>;

export type DrizzleConfig<
  TSchema extends Record<string, unknown> = Record<string, never>,
> = DrizzleBaseConfig<TSchema>;

type PgDialectConnector = Connector & { dialect: "postgresql" };
type PgDatabaseWithDialect = Database<PgDialectConnector>;

export function drizzle<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(
  db: PgDatabaseWithDialect | Database,
  config?: DrizzleConfig<TSchema>,
): DrizzlePgDatabase<TSchema> {
  let logger: DB0PgSessionOptions["logger"];
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

  const dialect = new PgDialect({ casing: config?.casing });
  const session = new DB0PgSession(db, dialect, schema, { logger });
  // @ts-expect-error session type mismatch
  return new PgDatabase(dialect, session, schema);
}

export { type DB0PgQueryResultHKT } from "./_pg-session.ts";

// Auto-generated using scripts/gen-connectors.
// Do not manually edit!
import type { ConnectorOptions as BetterSQLite3Options } from "./connectors/better-sqlite3.ts";
import type { ConnectorOptions as BunSQLiteOptions } from "./connectors/bun-sqlite.ts";
import type { ConnectorOptions as CapacitorSQLiteOptions } from "./connectors/capacitor-sqlite.ts";
import type { ConnectorOptions as CloudflareD1Options } from "./connectors/cloudflare-d1.ts";
import type { ConnectorOptions as CloudflareD1HttpOptions } from "./connectors/cloudflare-d1-http.ts";
import type { ConnectorOptions as CloudflareHyperdriveMySQLOptions } from "./connectors/cloudflare-hyperdrive-mysql.ts";
import type { ConnectorOptions as CloudflareHyperdrivePostgreSQLOptions } from "./connectors/cloudflare-hyperdrive-postgresql.ts";
import type { ConnectorOptions as CordovaSQLiteOptions } from "./connectors/cordova-sqlite.ts";
import type { ConnectorOptions as HttpOptions } from "./connectors/http.ts";
import type { ConnectorOptions as LibSQLCoreOptions } from "./connectors/libsql/core.ts";
import type { ConnectorOptions as LibSQLHttpOptions } from "./connectors/libsql/http.ts";
import type { ConnectorOptions as LibSQLNodeOptions } from "./connectors/libsql/node.ts";
import type { ConnectorOptions as LibSQLWebOptions } from "./connectors/libsql/web.ts";
import type { ConnectorOptions as MsSQLOptions } from "./connectors/mssql.ts";
import type { ConnectorOptions as MySQLMariaDBOptions } from "./connectors/mysql/mariadb.ts";
import type { ConnectorOptions as MySQLMysql2Options } from "./connectors/mysql/mysql2.ts";
import type { ConnectorOptions as MySQLPlanetscaleOptions } from "./connectors/mysql/planetscale.ts";
import type { ConnectorOptions as MySQLPoolOptions } from "./connectors/mysql/pool.ts";
import type { ConnectorOptions as NodeSQLiteOptions } from "./connectors/node-sqlite.ts";
import type { ConnectorOptions as PostgreSQLNeonHttpOptions } from "./connectors/postgresql/neon-http.ts";
import type { ConnectorOptions as PostgreSQLNeonWsOptions } from "./connectors/postgresql/neon-ws.ts";
import type { ConnectorOptions as PostgreSQLPgOptions } from "./connectors/postgresql/pg.ts";
import type { ConnectorOptions as PostgreSQLPgliteOptions } from "./connectors/postgresql/pglite.ts";
import type { ConnectorOptions as PostgreSQLPoolOptions } from "./connectors/postgresql/pool.ts";
import type { ConnectorOptions as PostgreSQLPostgresOptions } from "./connectors/postgresql/postgres.ts";
import type { ConnectorOptions as SequelizeOptions } from "./connectors/sequelize.ts";
import type { ConnectorOptions as SQLite3Options } from "./connectors/sqlite3.ts";

export type ConnectorName = "better-sqlite3" | "bun-sqlite" | "bun" | "capacitor-sqlite" | "cloudflare-d1" | "cloudflare-d1-http" | "cloudflare-hyperdrive-mysql" | "cloudflare-hyperdrive-postgresql" | "cordova-sqlite" | "http" | "libsql-core" | "libsql-http" | "libsql-node" | "libsql" | "libsql-web" | "mssql" | "mysql-mariadb" | "mariadb" | "mysql-mysql2" | "mysql2" | "mysql-planetscale" | "planetscale" | "mysql-pool" | "node-sqlite" | "sqlite" | "postgresql-neon-http" | "neon-http" | "postgresql-neon-ws" | "neon" | "postgresql-pg" | "pg" | "postgresql-pglite" | "pglite" | "postgresql-pool" | "postgresql-postgres" | "postgresql" | "sequelize" | "sqlite3";

export type ConnectorOptions = {
  "better-sqlite3": BetterSQLite3Options;
  "bun-sqlite": BunSQLiteOptions;
  /** alias of bun-sqlite */
  "bun": BunSQLiteOptions;
  "capacitor-sqlite": CapacitorSQLiteOptions;
  "cloudflare-d1": CloudflareD1Options;
  "cloudflare-d1-http": CloudflareD1HttpOptions;
  "cloudflare-hyperdrive-mysql": CloudflareHyperdriveMySQLOptions;
  "cloudflare-hyperdrive-postgresql": CloudflareHyperdrivePostgreSQLOptions;
  "cordova-sqlite": CordovaSQLiteOptions;
  "http": HttpOptions;
  "libsql-core": LibSQLCoreOptions;
  "libsql-http": LibSQLHttpOptions;
  "libsql-node": LibSQLNodeOptions;
  /** alias of libsql-node */
  "libsql": LibSQLNodeOptions;
  "libsql-web": LibSQLWebOptions;
  "mssql": MsSQLOptions;
  "mysql-mariadb": MySQLMariaDBOptions;
  /** alias of mysql-mariadb */
  "mariadb": MySQLMariaDBOptions;
  "mysql-mysql2": MySQLMysql2Options;
  /** alias of mysql-mysql2 */
  "mysql2": MySQLMysql2Options;
  "mysql-planetscale": MySQLPlanetscaleOptions;
  /** alias of mysql-planetscale */
  "planetscale": MySQLPlanetscaleOptions;
  "mysql-pool": MySQLPoolOptions;
  "node-sqlite": NodeSQLiteOptions;
  /** alias of node-sqlite */
  "sqlite": NodeSQLiteOptions;
  "postgresql-neon-http": PostgreSQLNeonHttpOptions;
  /** alias of postgresql-neon-http */
  "neon-http": PostgreSQLNeonHttpOptions;
  "postgresql-neon-ws": PostgreSQLNeonWsOptions;
  /** alias of postgresql-neon-ws */
  "neon": PostgreSQLNeonWsOptions;
  "postgresql-pg": PostgreSQLPgOptions;
  /** alias of postgresql-pg */
  "pg": PostgreSQLPgOptions;
  "postgresql-pglite": PostgreSQLPgliteOptions;
  /** alias of postgresql-pglite */
  "pglite": PostgreSQLPgliteOptions;
  "postgresql-pool": PostgreSQLPoolOptions;
  "postgresql-postgres": PostgreSQLPostgresOptions;
  /** alias of postgresql-postgres */
  "postgresql": PostgreSQLPostgresOptions;
  "sequelize": SequelizeOptions;
  "sqlite3": SQLite3Options;
};

export const connectors: Record<ConnectorName, string> = Object.freeze({
  "better-sqlite3": "db0/connectors/better-sqlite3",
  "bun-sqlite": "db0/connectors/bun-sqlite",
  /** alias of bun-sqlite */
  "bun": "db0/connectors/bun-sqlite",
  "capacitor-sqlite": "db0/connectors/capacitor-sqlite",
  "cloudflare-d1": "db0/connectors/cloudflare-d1",
  "cloudflare-d1-http": "db0/connectors/cloudflare-d1-http",
  "cloudflare-hyperdrive-mysql": "db0/connectors/cloudflare-hyperdrive-mysql",
  "cloudflare-hyperdrive-postgresql": "db0/connectors/cloudflare-hyperdrive-postgresql",
  "cordova-sqlite": "db0/connectors/cordova-sqlite",
  "http": "db0/connectors/http",
  "libsql-core": "db0/connectors/libsql/core",
  "libsql-http": "db0/connectors/libsql/http",
  "libsql-node": "db0/connectors/libsql/node",
  /** alias of libsql-node */
  "libsql": "db0/connectors/libsql/node",
  "libsql-web": "db0/connectors/libsql/web",
  "mssql": "db0/connectors/mssql",
  "mysql-mariadb": "db0/connectors/mysql/mariadb",
  /** alias of mysql-mariadb */
  "mariadb": "db0/connectors/mysql/mariadb",
  "mysql-mysql2": "db0/connectors/mysql/mysql2",
  /** alias of mysql-mysql2 */
  "mysql2": "db0/connectors/mysql/mysql2",
  "mysql-planetscale": "db0/connectors/mysql/planetscale",
  /** alias of mysql-planetscale */
  "planetscale": "db0/connectors/mysql/planetscale",
  "mysql-pool": "db0/connectors/mysql/pool",
  "node-sqlite": "db0/connectors/node-sqlite",
  /** alias of node-sqlite */
  "sqlite": "db0/connectors/node-sqlite",
  "postgresql-neon-http": "db0/connectors/postgresql/neon-http",
  /** alias of postgresql-neon-http */
  "neon-http": "db0/connectors/postgresql/neon-http",
  "postgresql-neon-ws": "db0/connectors/postgresql/neon-ws",
  /** alias of postgresql-neon-ws */
  "neon": "db0/connectors/postgresql/neon-ws",
  "postgresql-pg": "db0/connectors/postgresql/pg",
  /** alias of postgresql-pg */
  "pg": "db0/connectors/postgresql/pg",
  "postgresql-pglite": "db0/connectors/postgresql/pglite",
  /** alias of postgresql-pglite */
  "pglite": "db0/connectors/postgresql/pglite",
  "postgresql-pool": "db0/connectors/postgresql/pool",
  "postgresql-postgres": "db0/connectors/postgresql/postgres",
  /** alias of postgresql-postgres */
  "postgresql": "db0/connectors/postgresql/postgres",
  "sequelize": "db0/connectors/sequelize",
  "sqlite3": "db0/connectors/sqlite3",
} as const);

import { describe } from "vitest";
import connector from "../../src/connectors/mysql/mariadb";
import { testConnector } from "./_tests";

describe.runIf(process.env.MARIADB_URL)("connectors: mysql-mariadb", () => {
  const mariadbConnector = connector({
    host: process.env.MARIADB_HOST || "localhost",
    port: Number(process.env.MARIADB_PORT) || 13_307,
    user: process.env.MARIADB_USER || "root",
    password: process.env.MARIADB_PASSWORD || "root",
    database: process.env.MARIADB_DATABASE || "test",
  });

  testConnector({
    dialect: "mysql",
    connector: mariadbConnector,
  });
});

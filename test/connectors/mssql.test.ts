import { describe } from "vitest";
import connector from "../../src/connectors/mssql";
import { testConnector } from "./_tests";

describe.runIf(process.env.MSSQL_URL)("connectors: mssql", () => {
  const mssqlConnector = connector({
    server: process.env.MSSQL_HOST || "localhost",
    port: Number(process.env.MSSQL_PORT) || 11_433,
    user: process.env.MSSQL_USER || "sa",
    password: process.env.MSSQL_PASSWORD || "Test@12345",
    database: process.env.MSSQL_DATABASE || "master",
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
  });

  testConnector({
    dialect: "mssql",
    connector: mssqlConnector,
  });
});

import { describe } from "vitest";
import connector from "../../src/connectors/postgresql/pg";
import { testConnector } from "./_tests";

describe.runIf(process.env.POSTGRESQL_URL)("connectors: postgresql-pg", () => {
  const pgConnector = connector({
    connectionString: process.env.POSTGRESQL_URL!,
    max: 1,
  });

  testConnector({
    dialect: "postgresql",
    connector: pgConnector,
  });
});

import { describe } from "vitest";
import connector from "../../src/connectors/postgresql/pool";
import { testConnector } from "./_tests";

describe.runIf(process.env.POSTGRESQL_URL)(
  "connectors: postgresql-pool",
  () => {
    const poolConnector = connector({
      url: process.env.POSTGRESQL_URL!,
      max: 5,
      idle_timeout: 20,
    });

    testConnector({
      dialect: "postgresql",
      connector: poolConnector,
      skipTransactions: true, // Pool mode doesn't support transactions
    });
  },
);

import { describe } from "vitest";
import connector from "../../src/connectors/mysql/pool";
import { testConnector } from "./_tests";

describe.runIf(process.env.MYSQL_URL)("connectors: mysql-pool", () => {
  const poolConnector = connector({
    uri: process.env.MYSQL_URL!,
    connectionLimit: 5,
  });

  testConnector({
    dialect: "mysql",
    connector: poolConnector,
  });
});

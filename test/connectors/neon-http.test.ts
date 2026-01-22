import { describe } from "vitest";
import connector from "../../src/connectors/postgresql/neon-http";
import { testConnector } from "./_tests";

// Use NEON_DATABASE_URL for cloud Neon, or NEON_HTTP_URL for local proxy
const neonUrl = process.env.NEON_DATABASE_URL || process.env.NEON_HTTP_URL;

describe.runIf(neonUrl)("connectors: neon-http", () => {
  const neonConnector = connector({ url: neonUrl! });

  testConnector({
    dialect: "postgresql",
    connector: neonConnector,
    skipTransactions: true,
  });
});

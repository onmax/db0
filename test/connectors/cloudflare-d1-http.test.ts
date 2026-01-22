import { describe } from "vitest";
import connector from "../../src/connectors/cloudflare-d1-http";
import { testConnector } from "./_tests";

const hasCredentials =
  process.env.CLOUDFLARE_ACCOUNT_ID &&
  process.env.CLOUDFLARE_D1_DATABASE_ID &&
  process.env.CLOUDFLARE_API_TOKEN;

// D1 HTTP API has higher latency than local databases
describe.runIf(hasCredentials)(
  "connectors: cloudflare-d1-http",
  { timeout: 30_000 },
  () => {
    const d1Connector = connector({
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
      databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID!,
      apiToken: process.env.CLOUDFLARE_API_TOKEN!,
    });

    testConnector({
      dialect: "sqlite",
      connector: d1Connector,
      skipTransactions: true,
    });
  },
);

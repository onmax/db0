import { describe, it, expect, beforeAll } from "vitest";
import connector from "../../src/connectors/postgresql/neon-ws";
import { createDatabase, type Database, type Connector } from "../../src";
import { testConnector } from "./_tests";

// Neon WebSocket tests require NEON_URL or NEON_WS_URL environment variable
// Can use cloud Neon or local proxy with WebSocket support
const neonUrl = process.env.NEON_URL || process.env.NEON_WS_URL;

describe.runIf(neonUrl)("connectors: neon-ws", () => {
  const neonConnector = connector({
    url: neonUrl!,
  });

  testConnector({
    dialect: "postgresql",
    connector: neonConnector,
  });
});

describe.runIf(neonUrl)("connectors: neon-ws - specific", () => {
  let db: Database<Connector>;

  beforeAll(() => {
    db = createDatabase(
      connector({
        url: neonUrl!,
      }),
    );
  });

  it("supports transactions (unlike neon-http)", async () => {
    await db.sql`DROP TABLE IF EXISTS neon_ws_tx_test`;
    await db.sql`CREATE TABLE neon_ws_tx_test ("id" INTEGER PRIMARY KEY, "value" TEXT)`;

    await db.transaction(async (tx) => {
      await tx.sql`INSERT INTO neon_ws_tx_test VALUES (1, 'committed')`;
    });

    const { rows } = await db.sql`SELECT * FROM neon_ws_tx_test WHERE id = 1`;
    expect(rows).toHaveLength(1);
    expect((rows as { value: string }[])[0].value).toBe("committed");
  });

  it("rollback works", async () => {
    await db.sql`DROP TABLE IF EXISTS neon_ws_rollback`;
    await db.sql`CREATE TABLE neon_ws_rollback ("id" INTEGER PRIMARY KEY, "value" TEXT)`;

    await expect(
      db.transaction(async (tx) => {
        await tx.sql`INSERT INTO neon_ws_rollback VALUES (1, 'will_rollback')`;
        throw new Error("Intentional error");
      }),
    ).rejects.toThrow("Intentional error");

    const { rows } = await db.sql`SELECT * FROM neon_ws_rollback`;
    expect(rows).toHaveLength(0);
  });

  it("cleanup", async () => {
    await db.dispose();
    expect(db.disposed).toBe(true);
  });
});

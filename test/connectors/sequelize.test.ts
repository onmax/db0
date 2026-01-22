import { describe, it, expect, beforeAll } from "vitest";
import { Sequelize } from "sequelize";
import connector from "../../src/connectors/sequelize";
import { createDatabase, type Database, type Connector } from "../../src";

// Note: Sequelize raw queries don't support RETURNING clause on SQLite
// Using custom tests instead of shared testConnector to handle this limitation

function testSequelizeConnector(opts: { connector: ReturnType<typeof connector>; name: string }) {
  let db: Database<Connector>;
  beforeAll(() => {
    db = createDatabase(opts.connector);
  });

  it("instance matches", async () => {
    const instance = await db.getInstance();
    expect(instance).toBeDefined();
    expect(instance).toBe(await opts.connector.getInstance());
  });

  it("dialect matches", () => {
    expect(db.dialect).toBe("sqlite");
  });

  it("drop and create table", async () => {
    await db.sql`DROP TABLE IF EXISTS users`;
    await db.sql`CREATE TABLE users ("id" TEXT PRIMARY KEY, "firstName" TEXT, "lastName" TEXT, "email" TEXT)`;
  });

  it("insert and select", async () => {
    // Note: RETURNING clause doesn't work with Sequelize raw queries on SQLite
    await db.sql`INSERT INTO users VALUES (${"1001"}, 'John', 'Doe', '')`;
    const { rows } = await db.sql`SELECT * FROM users WHERE id = ${"1001"}`;
    expect(rows).toMatchInlineSnapshot(`
      [
        {
          "email": "",
          "firstName": "John",
          "id": "1001",
          "lastName": "Doe",
        },
      ]
    `);
  });

  it("deferred prepare errors", async () => {
    await expect(db.prepare("SELECT * FROM non_existing_table").all()).rejects.toThrowError("non_existing_table");
  });

  it("prepared statements", async () => {
    await db.sql`DROP TABLE IF EXISTS prep_test`;
    await db.sql`CREATE TABLE prep_test ("id" INTEGER PRIMARY KEY, "name" TEXT)`;
    const stmt = db.prepare("INSERT INTO prep_test (id, name) VALUES (?, ?)");
    await stmt.run(1, "Alice");
    await stmt.run(2, "Bob");
    const selectStmt = db.prepare("SELECT * FROM prep_test WHERE id = ?");
    const row = await selectStmt.get(1);
    expect(row).toMatchObject({ id: 1, name: "Alice" });
    const allRows = await db.prepare("SELECT * FROM prep_test ORDER BY id").all();
    expect(allRows).toHaveLength(2);
  });

  it("transactions", async () => {
    await db.sql`DROP TABLE IF EXISTS tx_test`;
    await db.sql`CREATE TABLE tx_test ("id" INTEGER PRIMARY KEY, "value" TEXT)`;
    await db.transaction(async (tx) => {
      await tx.sql`INSERT INTO tx_test VALUES (1, 'committed')`;
    });
    const { rows } = await db.sql`SELECT * FROM tx_test WHERE id = 1`;
    expect(rows).toHaveLength(1);
    expect((rows as { value: string }[])[0].value).toBe("committed");
  });

  it("dispose", async () => {
    await db.dispose();
    expect(db.disposed).toBe(true);
    let err;
    try {
      await db.getInstance();
    } catch (error) {
      err = error;
    }
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe("This database instance has been disposed and cannot be used.");
  });
}

describe("connectors: sequelize (sqlite)", () => {
  testSequelizeConnector({
    name: "sequelize",
    connector: connector({
      dialect: "sqlite",
      storage: ":memory:",
      logging: false,
    }),
  });
});

describe("connectors: sequelize (existing instance)", () => {
  const instance = new Sequelize({
    dialect: "sqlite",
    storage: ":memory:",
    logging: false,
  });

  testSequelizeConnector({
    name: "sequelize-instance",
    connector: connector({ instance }),
  });
});

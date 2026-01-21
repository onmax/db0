import { describe, expect, test } from "bun:test";

import connector from "../../src/connectors/bun-sqlite";
import { createDatabase } from "../../src";

test("connectors: bun", async () => {
  const db = createDatabase(connector({ name: ":memory:" }));

  const userId = "1001";

  await db.sql`DROP TABLE IF EXISTS users`;
  await db.sql`CREATE TABLE users ("id" TEXT PRIMARY KEY, "firstName" TEXT, "lastName" TEXT, "email" TEXT)`;

  await db.sql`INSERT INTO users VALUES (${userId}, 'John', 'Doe', '')`;

  const { rows } = await db.sql`SELECT * FROM users WHERE id = ${userId}`;
  expect(rows).toMatchObject([
    { id: userId, firstName: "John", lastName: "Doe", email: "" },
  ]);
});

describe("eager initialization", () => {
  test("getInstance returns sync after ready() with eager: true", async () => {
    const db = createDatabase(connector({ name: ":memory:" }), { eager: true });
    await db.ready();
    const instance = db.getInstance();
    expect(instance).not.toBeInstanceOf(Promise);
    expect(instance).toBeDefined();
    await db.dispose();
  });

  test("ready() resolves immediately for sync connector", async () => {
    const db = createDatabase(connector({ name: ":memory:" }), { eager: true });
    const start = Date.now();
    await db.ready();
    expect(Date.now() - start).toBeLessThan(50);
    await db.dispose();
  });

  test("backward compatible - works without eager option", async () => {
    const db = createDatabase(connector({ name: ":memory:" }));
    const instance = db.getInstance();
    expect(instance).toBeInstanceOf(Promise);
    expect(await instance).toBeDefined();
    await db.dispose();
  });
});

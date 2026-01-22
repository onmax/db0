import { describe, it, expect, beforeAll } from "vitest";
import connector from "../../src/connectors/better-sqlite3";
import { createDatabase, type Database, type Connector } from "../../src";
import { testConnector } from "./_tests";

describe("connectors: better-sqlite3", () => {
  testConnector({
    dialect: "sqlite",
    connector: connector({
      name: ":memory:",
    }),
  });

  describe("eager initialization", () => {
    it("getInstance returns sync after ready() with eager: true", async () => {
      const db = createDatabase(connector({ name: ":memory:" }), {
        eager: true,
      });
      await db.ready();
      const instance = db.getInstance();
      expect(instance).not.toBeInstanceOf(Promise);
      expect(instance).toBeDefined();
      await db.dispose();
    });

    it("ready() resolves immediately for sync connector", async () => {
      const db = createDatabase(connector({ name: ":memory:" }), {
        eager: true,
      });
      const start = Date.now();
      await db.ready();
      expect(Date.now() - start).toBeLessThan(50);
      await db.dispose();
    });

    it("backward compatible - works without eager option", async () => {
      const db = createDatabase(connector({ name: ":memory:" }));
      const instance = db.getInstance();
      expect(instance).toBeInstanceOf(Promise);
      expect(await instance).toBeDefined();
      await db.dispose();
    });
  });

  describe("type transformers", () => {
    let db: Database<Connector>;
    let dbWithJson: Database<Connector>;
    beforeAll(async () => {
      // Default SQLite: booleans and dates transformed, JSON not (SQLite has native JSON)
      db = createDatabase(connector({ name: ":memory:" }));
      await db.sql`CREATE TABLE transform_test (id INTEGER PRIMARY KEY, is_active INTEGER, created_at TEXT, metadata TEXT)`;

      // Explicit JSON transformation enabled for testing
      dbWithJson = createDatabase(connector({ name: ":memory:" }), {
        transformers: { json: true },
      });
      await dbWithJson.sql`CREATE TABLE json_test (id INTEGER PRIMARY KEY, metadata TEXT)`;
    });

    it("transforms booleans to integers on input", async () => {
      await db.sql`INSERT INTO transform_test (id, is_active) VALUES (1, ${true})`;
      await db.sql`INSERT INTO transform_test (id, is_active) VALUES (2, ${false})`;

      const { rows } =
        await db.sql`SELECT id, is_active FROM transform_test WHERE id IN (1, 2) ORDER BY id`;
      expect((rows as { is_active: number }[])[0].is_active).toBe(1);
      expect((rows as { is_active: number }[])[1].is_active).toBe(0);
    });

    it("transforms dates to ISO strings on input", async () => {
      const date = new Date("2024-06-15T10:30:00.000Z");
      await db.sql`INSERT INTO transform_test (id, created_at) VALUES (3, ${date})`;

      const { rows } =
        await db.sql`SELECT created_at FROM transform_test WHERE id = 3`;
      // Output should be transformed back to Date
      expect((rows as { created_at: Date }[])[0].created_at).toBeInstanceOf(
        Date,
      );
      expect((rows as { created_at: Date }[])[0].created_at.toISOString()).toBe(
        "2024-06-15T10:30:00.000Z",
      );
    });

    it("transforms JSON objects to text on input and back on output", async () => {
      const metadata = { tags: ["a", "b"], count: 42 };
      await dbWithJson.sql`INSERT INTO json_test (id, metadata) VALUES (1, ${metadata})`;

      const { rows } =
        await dbWithJson.sql`SELECT metadata FROM json_test WHERE id = 1`;
      expect((rows as { metadata: object }[])[0].metadata).toEqual(metadata);
    });

    it("transforms JSON arrays to text on input and back on output", async () => {
      const metadata = [1, 2, "three"];
      await dbWithJson.sql`INSERT INTO json_test (id, metadata) VALUES (2, ${metadata})`;

      const { rows } =
        await dbWithJson.sql`SELECT metadata FROM json_test WHERE id = 2`;
      expect((rows as { metadata: unknown[] }[])[0].metadata).toEqual(metadata);
    });

    it("can disable transformers via options", async () => {
      const dbNoTransform = createDatabase(connector({ name: ":memory:" }), {
        transformers: { disabled: true },
      });
      await dbNoTransform.sql`CREATE TABLE no_transform (id INTEGER PRIMARY KEY, data TEXT)`;

      const obj = { foo: "bar" };
      await dbNoTransform.sql`INSERT INTO no_transform (id, data) VALUES (1, ${JSON.stringify(obj)})`;

      const { rows } =
        await dbNoTransform.sql`SELECT data FROM no_transform WHERE id = 1`;
      // Without output transform, it should remain a string
      expect((rows as { data: string }[])[0].data).toBe('{"foo":"bar"}');
      await dbNoTransform.dispose();
    });

    it("can selectively disable boolean transform", async () => {
      const dbNoBool = createDatabase(connector({ name: ":memory:" }), {
        transformers: { booleans: false },
      });
      await dbNoBool.sql`CREATE TABLE no_bool (id INTEGER PRIMARY KEY, flag INTEGER)`;

      await dbNoBool.sql`INSERT INTO no_bool (id, flag) VALUES (1, ${1})`;

      const { rows } =
        await dbNoBool.sql`SELECT flag FROM no_bool WHERE id = 1`;
      expect((rows as { flag: number }[])[0].flag).toBe(1);
      await dbNoBool.dispose();
    });

    it("works within transactions", async () => {
      const date = new Date("2024-07-20T15:00:00.000Z");

      await db.transaction(async (tx) => {
        await tx.sql`INSERT INTO transform_test (id, is_active, created_at) VALUES (6, ${true}, ${date})`;
      });

      const { rows } =
        await db.sql`SELECT is_active, created_at FROM transform_test WHERE id = 6`;
      const row = rows[0] as {
        is_active: number;
        created_at: Date;
      };
      expect(row.is_active).toBe(1);
      expect(row.created_at).toBeInstanceOf(Date);
    });

    it("works within transactions with JSON transform enabled", async () => {
      const metadata = { key: "value" };

      await dbWithJson.transaction(async (tx) => {
        await tx.sql`INSERT INTO json_test (id, metadata) VALUES (3, ${metadata})`;
      });

      const { rows } =
        await dbWithJson.sql`SELECT metadata FROM json_test WHERE id = 3`;
      expect((rows as { metadata: object }[])[0].metadata).toEqual(metadata);
    });
  });
});

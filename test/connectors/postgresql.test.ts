import { beforeAll, describe, expect, it } from "vitest";
import connector from "../../src/connectors/postgresql/postgres";
import { createDatabase, type Database, type Connector } from "../../src";
import { testConnector } from "./_tests";

describe.runIf(process.env.POSTGRESQL_URL)(
  "connectors: postgresql.test",
  () => {
    // max: 1 ensures single connection for transaction support
    const pgConnector = connector({ url: process.env.POSTGRESQL_URL!, max: 1 });

    testConnector({
      dialect: "postgresql",
      connector: pgConnector,
    });
  },
);

describe.runIf(process.env.POSTGRESQL_URL)(
  "connectors: postgresql - specific features",
  () => {
    let db: Database<Connector>;

    beforeAll(() => {
      db = createDatabase(connector({ url: process.env.POSTGRESQL_URL! }));
    });

    describe("JSONB support", () => {
      it("insert and query JSONB", async () => {
        await db.sql`DROP TABLE IF EXISTS jsonb_test`;
        await db.sql`CREATE TABLE jsonb_test ("id" SERIAL PRIMARY KEY, "data" JSONB)`;

        const jsonData = { name: "John", age: 30, tags: ["admin", "user"] };
        await db.sql`INSERT INTO jsonb_test (data) VALUES (${JSON.stringify(jsonData)}::jsonb)`;

        const { rows } = await db.sql`SELECT * FROM jsonb_test WHERE id = 1`;
        // postgres.js may return JSONB as string or object depending on version/config
        const data = (rows as { data: typeof jsonData | string }[])[0].data;
        const parsed = typeof data === "string" ? JSON.parse(data) : data;
        expect(parsed).toEqual(jsonData);
      });

      it("JSONB operators", async () => {
        await db.sql`DROP TABLE IF EXISTS jsonb_ops`;
        await db.sql`CREATE TABLE jsonb_ops ("id" SERIAL PRIMARY KEY, "data" JSONB)`;

        await db.sql`INSERT INTO jsonb_ops (data) VALUES ('{"name": "Alice", "score": 100}'::jsonb)`;
        await db.sql`INSERT INTO jsonb_ops (data) VALUES ('{"name": "Bob", "score": 85}'::jsonb)`;

        const { rows } =
          await db.sql`SELECT * FROM jsonb_ops WHERE (data->>'score')::int > 90`;
        expect(rows).toHaveLength(1);
        expect((rows as { data: { name: string } }[])[0].data.name).toBe(
          "Alice",
        );
      });
    });

    describe("Array support", () => {
      it("integer arrays", async () => {
        await db.sql`DROP TABLE IF EXISTS array_int_test`;
        await db.sql`CREATE TABLE array_int_test ("id" SERIAL PRIMARY KEY, "numbers" INTEGER[])`;

        await db.sql`INSERT INTO array_int_test (numbers) VALUES (ARRAY[1, 2, 3, 4, 5])`;

        const { rows } =
          await db.sql`SELECT * FROM array_int_test WHERE id = 1`;
        expect((rows as { numbers: number[] }[])[0].numbers).toEqual([
          1, 2, 3, 4, 5,
        ]);
      });

      it("text arrays", async () => {
        await db.sql`DROP TABLE IF EXISTS array_text_test`;
        await db.sql`CREATE TABLE array_text_test ("id" SERIAL PRIMARY KEY, "tags" TEXT[])`;

        await db.sql`INSERT INTO array_text_test (tags) VALUES (ARRAY['red', 'green', 'blue'])`;

        const { rows } =
          await db.sql`SELECT * FROM array_text_test WHERE id = 1`;
        expect((rows as { tags: string[] }[])[0].tags).toEqual([
          "red",
          "green",
          "blue",
        ]);
      });

      it("array contains operator", async () => {
        await db.sql`DROP TABLE IF EXISTS array_contains`;
        await db.sql`CREATE TABLE array_contains ("id" SERIAL PRIMARY KEY, "tags" TEXT[])`;

        await db.sql`INSERT INTO array_contains (tags) VALUES (ARRAY['admin', 'user'])`;
        await db.sql`INSERT INTO array_contains (tags) VALUES (ARRAY['guest'])`;

        const { rows } =
          await db.sql`SELECT * FROM array_contains WHERE 'admin' = ANY(tags)`;
        expect(rows).toHaveLength(1);
      });
    });

    describe("UUID support", () => {
      it("generate and store UUID", async () => {
        await db.sql`DROP TABLE IF EXISTS uuid_test`;
        await db.sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
        await db.sql`CREATE TABLE uuid_test ("id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY, "name" TEXT)`;

        await db.sql`INSERT INTO uuid_test (name) VALUES ('test')`;

        const { rows } = await db.sql`SELECT * FROM uuid_test`;
        expect(rows).toHaveLength(1);
        const uuid = (rows as { id: string }[])[0].id;
        expect(uuid).toMatch(
          /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i,
        );
      });
    });

    describe("Date/Time types", () => {
      it("TIMESTAMP", async () => {
        await db.sql`DROP TABLE IF EXISTS timestamp_test`;
        await db.sql`CREATE TABLE timestamp_test ("id" SERIAL PRIMARY KEY, "created_at" TIMESTAMP)`;

        await db.sql`INSERT INTO timestamp_test (created_at) VALUES ('2024-01-15 10:30:00')`;

        const { rows } =
          await db.sql`SELECT * FROM timestamp_test WHERE id = 1`;
        const createdAt = (rows as { created_at: Date }[])[0].created_at;
        expect(createdAt).toBeInstanceOf(Date);
        expect(createdAt.getFullYear()).toBe(2024);
      });

      it("TIMESTAMPTZ", async () => {
        await db.sql`DROP TABLE IF EXISTS timestamptz_test`;
        await db.sql`CREATE TABLE timestamptz_test ("id" SERIAL PRIMARY KEY, "created_at" TIMESTAMPTZ)`;

        await db.sql`INSERT INTO timestamptz_test (created_at) VALUES ('2024-01-15 10:30:00+00')`;

        const { rows } =
          await db.sql`SELECT * FROM timestamptz_test WHERE id = 1`;
        expect((rows as { created_at: Date }[])[0].created_at).toBeInstanceOf(
          Date,
        );
      });

      it("INTERVAL", async () => {
        await db.sql`DROP TABLE IF EXISTS interval_test`;
        await db.sql`CREATE TABLE interval_test ("id" SERIAL PRIMARY KEY, "duration" INTERVAL)`;

        await db.sql`INSERT INTO interval_test (duration) VALUES ('2 hours 30 minutes')`;

        const { rows } = await db.sql`SELECT * FROM interval_test WHERE id = 1`;
        expect((rows as { duration: unknown }[])[0].duration).toBeDefined();
      });
    });

    describe("Numeric precision", () => {
      it("NUMERIC/DECIMAL", async () => {
        await db.sql`DROP TABLE IF EXISTS numeric_test`;
        await db.sql`CREATE TABLE numeric_test ("id" SERIAL PRIMARY KEY, "amount" NUMERIC(10, 2))`;

        await db.sql`INSERT INTO numeric_test (amount) VALUES (12345.67)`;

        const { rows } = await db.sql`SELECT * FROM numeric_test WHERE id = 1`;
        expect((rows as { amount: string }[])[0].amount).toBe("12345.67");
      });

      it("BIGINT", async () => {
        await db.sql`DROP TABLE IF EXISTS bigint_test`;
        await db.sql`CREATE TABLE bigint_test ("id" SERIAL PRIMARY KEY, "big_num" BIGINT)`;

        await db.sql`INSERT INTO bigint_test (big_num) VALUES (9223372036854775807)`;

        const { rows } = await db.sql`SELECT * FROM bigint_test WHERE id = 1`;
        expect((rows as { big_num: string }[])[0].big_num).toBe(
          "9223372036854775807",
        );
      });
    });

    describe("SERIAL and sequences", () => {
      it("auto-increment with SERIAL", async () => {
        await db.sql`DROP TABLE IF EXISTS serial_test`;
        await db.sql`CREATE TABLE serial_test ("id" SERIAL PRIMARY KEY, "name" TEXT)`;

        await db.sql`INSERT INTO serial_test (name) VALUES ('first')`;
        await db.sql`INSERT INTO serial_test (name) VALUES ('second')`;
        await db.sql`INSERT INTO serial_test (name) VALUES ('third')`;

        const { rows } = await db.sql`SELECT * FROM serial_test ORDER BY id`;
        expect(rows).toHaveLength(3);
        expect((rows as { id: number }[])[0].id).toBe(1);
        expect((rows as { id: number }[])[1].id).toBe(2);
        expect((rows as { id: number }[])[2].id).toBe(3);
      });
    });

    describe("RETURNING clause", () => {
      it("INSERT RETURNING", async () => {
        await db.sql`DROP TABLE IF EXISTS returning_test`;
        await db.sql`CREATE TABLE returning_test ("id" SERIAL PRIMARY KEY, "name" TEXT)`;

        const { rows } =
          await db.sql`INSERT INTO returning_test (name) VALUES ('test') RETURNING *`;
        expect(rows).toHaveLength(1);
        expect((rows as { id: number; name: string }[])[0].id).toBe(1);
        expect((rows as { id: number; name: string }[])[0].name).toBe("test");
      });

      it("UPDATE RETURNING", async () => {
        await db.sql`DROP TABLE IF EXISTS update_returning`;
        await db.sql`CREATE TABLE update_returning ("id" SERIAL PRIMARY KEY, "value" TEXT)`;
        await db.sql`INSERT INTO update_returning (value) VALUES ('old')`;

        const { rows } =
          await db.sql`UPDATE update_returning SET value = 'new' WHERE id = 1 RETURNING *`;
        expect(rows).toHaveLength(1);
        expect((rows as { value: string }[])[0].value).toBe("new");
      });

      it("DELETE RETURNING", async () => {
        await db.sql`DROP TABLE IF EXISTS delete_returning`;
        await db.sql`CREATE TABLE delete_returning ("id" SERIAL PRIMARY KEY, "value" TEXT)`;
        await db.sql`INSERT INTO delete_returning (value) VALUES ('to_delete')`;

        const { rows } =
          await db.sql`DELETE FROM delete_returning WHERE id = 1 RETURNING *`;
        expect(rows).toHaveLength(1);
        expect((rows as { value: string }[])[0].value).toBe("to_delete");
      });
    });

    describe("UPSERT (ON CONFLICT)", () => {
      it("INSERT ON CONFLICT DO UPDATE", async () => {
        await db.sql`DROP TABLE IF EXISTS upsert_test`;
        await db.sql`CREATE TABLE upsert_test ("id" INTEGER PRIMARY KEY, "value" TEXT, "count" INTEGER DEFAULT 1)`;

        await db.sql`INSERT INTO upsert_test (id, value) VALUES (1, 'initial')`;
        await db.sql`INSERT INTO upsert_test (id, value, count) VALUES (1, 'updated', 2) ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value, count = EXCLUDED.count`;

        const { rows } = await db.sql`SELECT * FROM upsert_test WHERE id = 1`;
        expect((rows as { value: string; count: number }[])[0].value).toBe(
          "updated",
        );
        expect((rows as { value: string; count: number }[])[0].count).toBe(2);
      });

      it("INSERT ON CONFLICT DO NOTHING", async () => {
        await db.sql`DROP TABLE IF EXISTS upsert_nothing`;
        await db.sql`CREATE TABLE upsert_nothing ("id" INTEGER PRIMARY KEY, "value" TEXT)`;

        await db.sql`INSERT INTO upsert_nothing (id, value) VALUES (1, 'first')`;
        await db.sql`INSERT INTO upsert_nothing (id, value) VALUES (1, 'second') ON CONFLICT DO NOTHING`;

        const { rows } =
          await db.sql`SELECT * FROM upsert_nothing WHERE id = 1`;
        expect((rows as { value: string }[])[0].value).toBe("first");
      });
    });

    describe("CTEs (Common Table Expressions)", () => {
      it("WITH clause", async () => {
        await db.sql`DROP TABLE IF EXISTS cte_test`;
        await db.sql`CREATE TABLE cte_test ("id" SERIAL PRIMARY KEY, "parent_id" INTEGER, "name" TEXT)`;

        await db.sql`INSERT INTO cte_test (parent_id, name) VALUES (NULL, 'Root')`;
        await db.sql`INSERT INTO cte_test (parent_id, name) VALUES (1, 'Child 1')`;
        await db.sql`INSERT INTO cte_test (parent_id, name) VALUES (1, 'Child 2')`;

        const { rows } = await db.sql`
          WITH children AS (
            SELECT * FROM cte_test WHERE parent_id = 1
          )
          SELECT * FROM children ORDER BY id
        `;
        expect(rows).toHaveLength(2);
      });
    });

    describe("cleanup", () => {
      it("dispose", async () => {
        await db.dispose();
        expect(db.disposed).toBe(true);
      });
    });
  },
);

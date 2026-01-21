import { beforeAll, describe, expect, it } from "vitest";
import {
  Connector,
  Database,
  createDatabase,
  type SQLDialect,
} from "../../src";

export function testConnector<TConnector extends Connector = Connector>(opts: {
  connector: TConnector;
  dialect: SQLDialect;
  skipTransactions?: boolean;
}) {
  let db: Database<TConnector>;
  beforeAll(() => {
    db = createDatabase(opts.connector);
  });

  const userId = "1001";
  const userSnapshot = `
    [
      {
        "email": "",
        "firstName": "John",
        "id": "1001",
        "lastName": "Doe",
      },
    ]
  `;

  it("instance matches", async () => {
    const instance = await db.getInstance();
    expect(instance).toBeDefined();
    expect(instance).toBe(await opts.connector.getInstance());
  });

  it("dialect matches", () => {
    expect(db.dialect).toBe(opts.dialect);
  });

  it("drop and create table", async () => {
    await db.sql`DROP TABLE IF EXISTS users`;
    switch (opts.dialect) {
      case "mysql": {
        await db.sql`CREATE TABLE users (\`id\` VARCHAR(4) PRIMARY KEY, \`firstName\` TEXT, \`lastName\` TEXT, \`email\` TEXT)`;
        break;
      }
      default: {
        await db.sql`CREATE TABLE users ("id" TEXT PRIMARY KEY, "firstName" TEXT, "lastName" TEXT, "email" TEXT)`;
        break;
      }
    }
  });

  it("insert", async () => {
    switch (opts.dialect) {
      case "mysql": {
        await db.sql`INSERT INTO users VALUES (${userId}, 'John', 'Doe', '')`;
        break;
      }
      default: {
        const { rows } =
          await db.sql`INSERT INTO users VALUES (${userId}, 'John', 'Doe', '') RETURNING *`;
        expect(rows).toMatchInlineSnapshot(userSnapshot);
        break;
      }
    }
  });

  it("select", async () => {
    const { rows } = await db.sql`SELECT * FROM users WHERE id = ${userId}`;
    expect(rows).toMatchInlineSnapshot(userSnapshot);
  });

  it("deferred prepare errors", async () => {
    await expect(
      db.prepare("SELECT * FROM non_existing_table").all(),
    ).rejects.toThrowError("non_existing_table");
  });

  describe.skipIf(opts.skipTransactions)("transactions", () => {
    it("commit persists changes", async () => {
      await db.sql`DROP TABLE IF EXISTS tx_test`;
      switch (opts.dialect) {
        case "mysql": {
          await db.sql`CREATE TABLE tx_test (\`id\` INT PRIMARY KEY, \`value\` TEXT)`;
          break;
        }
        default: {
          await db.sql`CREATE TABLE tx_test ("id" INTEGER PRIMARY KEY, "value" TEXT)`;
          break;
        }
      }

      await db.exec("BEGIN");
      await db.sql`INSERT INTO tx_test VALUES (1, 'committed')`;
      await db.exec("COMMIT");

      const { rows } = await db.sql`SELECT * FROM tx_test WHERE id = 1`;
      expect(rows).toHaveLength(1);
      expect((rows as { value: string }[])[0].value).toBe("committed");
    });

    it("rollback discards changes", async () => {
      await db.sql`DROP TABLE IF EXISTS tx_rollback`;
      switch (opts.dialect) {
        case "mysql": {
          await db.sql`CREATE TABLE tx_rollback (\`id\` INT PRIMARY KEY, \`value\` TEXT)`;
          break;
        }
        default: {
          await db.sql`CREATE TABLE tx_rollback ("id" INTEGER PRIMARY KEY, "value" TEXT)`;
          break;
        }
      }

      await db.exec("BEGIN");
      await db.sql`INSERT INTO tx_rollback VALUES (1, 'will_rollback')`;
      await db.exec("ROLLBACK");

      const { rows } = await db.sql`SELECT * FROM tx_rollback WHERE id = 1`;
      expect(rows).toHaveLength(0);
    });
  });

  describe("prepared statements", () => {
    it("bind and execute", async () => {
      await db.sql`DROP TABLE IF EXISTS prep_test`;
      switch (opts.dialect) {
        case "mysql": {
          await db.sql`CREATE TABLE prep_test (\`id\` INT PRIMARY KEY, \`name\` TEXT)`;
          break;
        }
        default: {
          await db.sql`CREATE TABLE prep_test ("id" INTEGER PRIMARY KEY, "name" TEXT)`;
          break;
        }
      }

      const stmt = db.prepare("INSERT INTO prep_test (id, name) VALUES (?, ?)");
      await stmt.run(1, "Alice");
      await stmt.run(2, "Bob");

      const selectStmt = db.prepare("SELECT * FROM prep_test WHERE id = ?");
      const row = await selectStmt.get(1);
      expect(row).toMatchObject({ id: 1, name: "Alice" });

      const allRows = await db
        .prepare("SELECT * FROM prep_test ORDER BY id")
        .all();
      expect(allRows).toHaveLength(2);
    });

    it("bound statement reuse", async () => {
      await db.sql`DROP TABLE IF EXISTS bound_test`;
      switch (opts.dialect) {
        case "mysql": {
          await db.sql`CREATE TABLE bound_test (\`id\` INT PRIMARY KEY)`;
          break;
        }
        default: {
          await db.sql`CREATE TABLE bound_test ("id" INTEGER PRIMARY KEY)`;
          break;
        }
      }

      const bound = db.prepare("INSERT INTO bound_test VALUES (?)").bind(42);
      await bound.run();

      const { rows } = await db.sql`SELECT * FROM bound_test`;
      expect(rows).toHaveLength(1);
      expect((rows as { id: number }[])[0].id).toBe(42);
    });
  });

  describe("edge cases", () => {
    it("NULL values", async () => {
      await db.sql`DROP TABLE IF EXISTS null_test`;
      switch (opts.dialect) {
        case "mysql": {
          await db.sql`CREATE TABLE null_test (\`id\` INT PRIMARY KEY, \`nullable\` TEXT)`;
          break;
        }
        default: {
          await db.sql`CREATE TABLE null_test ("id" INTEGER PRIMARY KEY, "nullable" TEXT)`;
          break;
        }
      }

      await db.sql`INSERT INTO null_test VALUES (1, ${null})`;
      const { rows } = await db.sql`SELECT * FROM null_test WHERE id = 1`;
      expect((rows as { nullable: string | null }[])[0].nullable).toBeNull();
    });

    it("empty string vs NULL", async () => {
      await db.sql`DROP TABLE IF EXISTS empty_test`;
      switch (opts.dialect) {
        case "mysql": {
          await db.sql`CREATE TABLE empty_test (\`id\` INT PRIMARY KEY, \`value\` TEXT)`;
          break;
        }
        default: {
          await db.sql`CREATE TABLE empty_test ("id" INTEGER PRIMARY KEY, "value" TEXT)`;
          break;
        }
      }

      await db.sql`INSERT INTO empty_test VALUES (1, '')`;
      await db.sql`INSERT INTO empty_test VALUES (2, ${null})`;

      const { rows: emptyRows } =
        await db.sql`SELECT * FROM empty_test WHERE id = 1`;
      expect((emptyRows as { value: string }[])[0].value).toBe("");

      const { rows: nullRows } =
        await db.sql`SELECT * FROM empty_test WHERE id = 2`;
      expect((nullRows as { value: string | null }[])[0].value).toBeNull();
    });

    it("numeric types", async () => {
      await db.sql`DROP TABLE IF EXISTS num_test`;
      switch (opts.dialect) {
        case "mysql": {
          await db.sql`CREATE TABLE num_test (\`id\` INT PRIMARY KEY, \`int_val\` INT, \`float_val\` DOUBLE)`;
          break;
        }
        case "postgresql": {
          await db.sql`CREATE TABLE num_test ("id" INTEGER PRIMARY KEY, "int_val" INTEGER, "float_val" DOUBLE PRECISION)`;
          break;
        }
        default: {
          await db.sql`CREATE TABLE num_test ("id" INTEGER PRIMARY KEY, "int_val" INTEGER, "float_val" REAL)`;
          break;
        }
      }

      await db.sql`INSERT INTO num_test VALUES (1, ${42}, ${3.14})`;
      const { rows } = await db.sql`SELECT * FROM num_test WHERE id = 1`;
      const row = (rows as { int_val: number; float_val: number }[])[0];
      expect(row.int_val).toBe(42);
      expect(row.float_val).toBeCloseTo(3.14, 2);
    });

    it("boolean values", async () => {
      await db.sql`DROP TABLE IF EXISTS bool_test`;
      switch (opts.dialect) {
        case "mysql": {
          await db.sql`CREATE TABLE bool_test (\`id\` INT PRIMARY KEY, \`flag\` BOOLEAN)`;
          break;
        }
        case "postgresql": {
          await db.sql`CREATE TABLE bool_test ("id" INTEGER PRIMARY KEY, "flag" BOOLEAN)`;
          break;
        }
        default: {
          await db.sql`CREATE TABLE bool_test ("id" INTEGER PRIMARY KEY, "flag" INTEGER)`;
          break;
        }
      }

      const trueVal =
        opts.dialect === "sqlite" || opts.dialect === "libsql" ? 1 : true;
      const falseVal =
        opts.dialect === "sqlite" || opts.dialect === "libsql" ? 0 : false;

      await db.sql`INSERT INTO bool_test VALUES (1, ${trueVal})`;
      await db.sql`INSERT INTO bool_test VALUES (2, ${falseVal})`;

      const { rows } = await db.sql`SELECT * FROM bool_test ORDER BY id`;
      const results = rows as { id: number; flag: boolean | number }[];
      expect(results[0].flag).toBeTruthy();
      expect(results[1].flag).toBeFalsy();
    });

    it("special characters in strings", async () => {
      await db.sql`DROP TABLE IF EXISTS special_test`;
      switch (opts.dialect) {
        case "mysql": {
          await db.sql`CREATE TABLE special_test (\`id\` INT PRIMARY KEY, \`value\` TEXT)`;
          break;
        }
        default: {
          await db.sql`CREATE TABLE special_test ("id" INTEGER PRIMARY KEY, "value" TEXT)`;
          break;
        }
      }

      const specialStr = "Hello 'World' \"Test\" \\ `backtick`";
      await db.sql`INSERT INTO special_test VALUES (1, ${specialStr})`;

      const { rows } = await db.sql`SELECT * FROM special_test WHERE id = 1`;
      expect((rows as { value: string }[])[0].value).toBe(specialStr);
    });

    it("unicode strings", async () => {
      await db.sql`DROP TABLE IF EXISTS unicode_test`;
      switch (opts.dialect) {
        case "mysql": {
          await db.sql`CREATE TABLE unicode_test (\`id\` INT PRIMARY KEY, \`value\` TEXT)`;
          break;
        }
        default: {
          await db.sql`CREATE TABLE unicode_test ("id" INTEGER PRIMARY KEY, "value" TEXT)`;
          break;
        }
      }

      const unicodeStr = "こんにちは 🌍 émojis 中文";
      await db.sql`INSERT INTO unicode_test VALUES (1, ${unicodeStr})`;

      const { rows } = await db.sql`SELECT * FROM unicode_test WHERE id = 1`;
      expect((rows as { value: string }[])[0].value).toBe(unicodeStr);
    });

    it("update operation", async () => {
      await db.sql`DROP TABLE IF EXISTS update_test`;
      switch (opts.dialect) {
        case "mysql": {
          await db.sql`CREATE TABLE update_test (\`id\` INT PRIMARY KEY, \`value\` TEXT)`;
          break;
        }
        default: {
          await db.sql`CREATE TABLE update_test ("id" INTEGER PRIMARY KEY, "value" TEXT)`;
          break;
        }
      }

      await db.sql`INSERT INTO update_test VALUES (1, 'original')`;
      await db.sql`UPDATE update_test SET value = 'updated' WHERE id = 1`;

      const { rows } = await db.sql`SELECT * FROM update_test WHERE id = 1`;
      expect((rows as { value: string }[])[0].value).toBe("updated");
    });

    it("delete operation", async () => {
      await db.sql`DROP TABLE IF EXISTS delete_test`;
      switch (opts.dialect) {
        case "mysql": {
          await db.sql`CREATE TABLE delete_test (\`id\` INT PRIMARY KEY, \`value\` TEXT)`;
          break;
        }
        default: {
          await db.sql`CREATE TABLE delete_test ("id" INTEGER PRIMARY KEY, "value" TEXT)`;
          break;
        }
      }

      await db.sql`INSERT INTO delete_test VALUES (1, 'to_delete')`;
      await db.sql`INSERT INTO delete_test VALUES (2, 'to_keep')`;
      await db.sql`DELETE FROM delete_test WHERE id = 1`;

      const { rows } = await db.sql`SELECT * FROM delete_test`;
      expect(rows).toHaveLength(1);
      expect((rows as { id: number }[])[0].id).toBe(2);
    });

    it("multiple rows insert and select", async () => {
      await db.sql`DROP TABLE IF EXISTS multi_test`;
      switch (opts.dialect) {
        case "mysql": {
          await db.sql`CREATE TABLE multi_test (\`id\` INT PRIMARY KEY, \`name\` TEXT)`;
          await db.sql`INSERT INTO multi_test VALUES (1, 'One'), (2, 'Two'), (3, 'Three')`;
          break;
        }
        default: {
          await db.sql`CREATE TABLE multi_test ("id" INTEGER PRIMARY KEY, "name" TEXT)`;
          await db.sql`INSERT INTO multi_test VALUES (1, 'One'), (2, 'Two'), (3, 'Three')`;
          break;
        }
      }

      const { rows } = await db.sql`SELECT * FROM multi_test ORDER BY id`;
      expect(rows).toHaveLength(3);
      expect((rows as { name: string }[]).map((r) => r.name)).toEqual([
        "One",
        "Two",
        "Three",
      ]);
    });
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
    expect((err as Error).message).toBe(
      "This database instance has been disposed and cannot be used.",
    );
  });
}

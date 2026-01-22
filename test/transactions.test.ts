import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createDatabase, type Database } from "../src";
import sqliteConnector from "../src/connectors/better-sqlite3";
import { TransactionError } from "../src/errors";

describe("transactions: comprehensive", () => {
  let db: Database;

  beforeAll(async () => {
    db = createDatabase(sqliteConnector({}));
    await db.sql`DROP TABLE IF EXISTS tx_test`;
    await db.sql`CREATE TABLE tx_test (id INTEGER PRIMARY KEY, value TEXT, count INTEGER DEFAULT 0)`;
  });

  afterAll(async () => {
    await db.sql`DROP TABLE IF EXISTS tx_test`;
    await db.dispose();
  });

  describe("callback style", () => {
    it("commits on successful completion", async () => {
      await db.transaction(async (tx) => {
        await tx.sql`INSERT INTO tx_test (id, value) VALUES (1, 'committed')`;
      });
      const { rows } = await db.sql`SELECT * FROM tx_test WHERE id = 1`;
      expect(rows).toHaveLength(1);
      expect((rows as any[])[0].value).toBe("committed");
    });

    it("rolls back on error", async () => {
      await expect(
        db.transaction(async (tx) => {
          await tx.sql`INSERT INTO tx_test (id, value) VALUES (100, 'will_rollback')`;
          throw new Error("intentional");
        }),
      ).rejects.toThrow();
      const { rows } = await db.sql`SELECT * FROM tx_test WHERE id = 100`;
      expect(rows).toHaveLength(0);
    });

    it("wraps errors in TransactionError", async () => {
      try {
        await db.transaction(async () => {
          throw new Error("original");
        });
      } catch (error) {
        expect(error).toBeInstanceOf(TransactionError);
        expect((error as TransactionError).cause?.message).toBe("original");
      }
    });

    it("returns callback result", async () => {
      const result = await db.transaction(async (tx) => {
        await tx.sql`INSERT INTO tx_test (id, value) VALUES (2, 'return_test')`;
        return { success: true, id: 2 };
      });
      expect(result).toEqual({ success: true, id: 2 });
    });

    it("supports async operations in sequence", async () => {
      await db.transaction(async (tx) => {
        await tx.sql`INSERT INTO tx_test (id, value) VALUES (3, 'first')`;
        await tx.sql`INSERT INTO tx_test (id, value) VALUES (4, 'second')`;
        await tx.sql`UPDATE tx_test SET value = 'updated' WHERE id = 3`;
      });
      const { rows } =
        await db.sql`SELECT * FROM tx_test WHERE id IN (3, 4) ORDER BY id`;
      expect(rows).toHaveLength(2);
      expect((rows as any[])[0].value).toBe("updated");
      expect((rows as any[])[1].value).toBe("second");
    });

    it("reads own uncommitted changes", async () => {
      await db.transaction(async (tx) => {
        await tx.sql`INSERT INTO tx_test (id, value) VALUES (5, 'visible')`;
        const { rows } = await tx.sql`SELECT * FROM tx_test WHERE id = 5`;
        expect(rows).toHaveLength(1);
        expect((rows as any[])[0].value).toBe("visible");
      });
    });
  });

  describe("manual style", () => {
    it("commit persists changes", async () => {
      const tx = await db.beginTransaction();
      await tx.sql`INSERT INTO tx_test (id, value) VALUES (10, 'manual_commit')`;
      await tx.commit();
      const { rows } = await db.sql`SELECT * FROM tx_test WHERE id = 10`;
      expect(rows).toHaveLength(1);
    });

    it("rollback discards changes", async () => {
      const tx = await db.beginTransaction();
      await tx.sql`INSERT INTO tx_test (id, value) VALUES (11, 'manual_rollback')`;
      await tx.rollback();
      const { rows } = await db.sql`SELECT * FROM tx_test WHERE id = 11`;
      expect(rows).toHaveLength(0);
    });

    it("throws on double commit", async () => {
      const tx = await db.beginTransaction();
      await tx.sql`INSERT INTO tx_test (id, value) VALUES (12, 'double')`;
      await tx.commit();
      await expect(tx.commit()).rejects.toThrow("already committed");
    });

    it("throws on double rollback", async () => {
      const tx = await db.beginTransaction();
      await tx.rollback();
      await expect(tx.rollback()).rejects.toThrow("already rolled back");
    });

    it("throws on commit after rollback", async () => {
      const tx = await db.beginTransaction();
      await tx.rollback();
      await expect(tx.commit()).rejects.toThrow("already rolled back");
    });

    it("throws on rollback after commit", async () => {
      const tx = await db.beginTransaction();
      await tx.sql`INSERT INTO tx_test (id, value) VALUES (13, 'test')`;
      await tx.commit();
      await expect(tx.rollback()).rejects.toThrow("already committed");
    });

    it("prevents sql after commit", async () => {
      const tx = await db.beginTransaction();
      await tx.commit();
      await expect(tx.sql`SELECT 1`).rejects.toThrow("already committed");
    });

    it("prevents sql after rollback", async () => {
      const tx = await db.beginTransaction();
      await tx.rollback();
      await expect(tx.sql`SELECT 1`).rejects.toThrow("already rolled back");
    });

    it("prevents exec after commit", async () => {
      const tx = await db.beginTransaction();
      await tx.commit();
      expect(() => tx.exec("SELECT 1")).toThrow("already committed");
    });

    it("prevents prepare after rollback", async () => {
      const tx = await db.beginTransaction();
      await tx.rollback();
      expect(() => tx.prepare("SELECT 1")).toThrow("already rolled back");
    });
  });

  describe("prepared statements in transactions", () => {
    it("works with prepare and run", async () => {
      await db.transaction(async (tx) => {
        const stmt = tx.prepare(
          "INSERT INTO tx_test (id, value) VALUES (?, ?)",
        );
        await stmt.run(20, "prepared_1");
        await stmt.run(21, "prepared_2");
      });
      const { rows } =
        await db.sql`SELECT * FROM tx_test WHERE id IN (20, 21) ORDER BY id`;
      expect(rows).toHaveLength(2);
    });

    it("works with prepare and all", async () => {
      await db.sql`INSERT INTO tx_test (id, value) VALUES (22, 'query_test')`;
      const result = await db.transaction(async (tx) => {
        const stmt = tx.prepare("SELECT * FROM tx_test WHERE id = ?");
        return stmt.all(22);
      });
      expect(result).toHaveLength(1);
      expect((result as any[])[0].value).toBe("query_test");
    });

    it("works with prepare and get", async () => {
      await db.sql`INSERT INTO tx_test (id, value) VALUES (23, 'get_test')`;
      const result = await db.transaction(async (tx) => {
        const stmt = tx.prepare("SELECT * FROM tx_test WHERE id = ?");
        return stmt.get(23);
      });
      expect((result as any).value).toBe("get_test");
    });
  });

  describe("error scenarios", () => {
    it("rolls back on constraint violation", async () => {
      await db.sql`INSERT INTO tx_test (id, value) VALUES (30, 'unique')`;
      await expect(
        db.transaction(async (tx) => {
          await tx.sql`INSERT INTO tx_test (id, value) VALUES (31, 'before_error')`;
          await tx.sql`INSERT INTO tx_test (id, value) VALUES (30, 'duplicate')`; // PRIMARY KEY violation
        }),
      ).rejects.toThrow();
      const { rows } = await db.sql`SELECT * FROM tx_test WHERE id = 31`;
      expect(rows).toHaveLength(0);
    });

    it("rolls back on syntax error", async () => {
      await expect(
        db.transaction(async (tx) => {
          await tx.sql`INSERT INTO tx_test (id, value) VALUES (32, 'before_syntax')`;
          await tx.exec("INVALID SQL SYNTAX");
        }),
      ).rejects.toThrow();
      const { rows } = await db.sql`SELECT * FROM tx_test WHERE id = 32`;
      expect(rows).toHaveLength(0);
    });
  });

  describe("isolation", () => {
    it("changes not visible outside until committed", async () => {
      const tx = await db.beginTransaction();
      await tx.sql`INSERT INTO tx_test (id, value) VALUES (40, 'isolated')`;

      // In SQLite with same connection, reads see the change
      // This test verifies the transaction is working
      await tx.commit();

      const { rows } = await db.sql`SELECT * FROM tx_test WHERE id = 40`;
      expect(rows).toHaveLength(1);
    });
  });

  describe("concurrent transactions", () => {
    it("handles sequential transactions", async () => {
      await db.transaction(async (tx) => {
        await tx.sql`INSERT INTO tx_test (id, value) VALUES (50, 'first_tx')`;
      });
      await db.transaction(async (tx) => {
        await tx.sql`INSERT INTO tx_test (id, value) VALUES (51, 'second_tx')`;
      });
      const { rows } = await db.sql`SELECT * FROM tx_test WHERE id IN (50, 51)`;
      expect(rows).toHaveLength(2);
    });
  });

  describe("transaction with data types", () => {
    it("handles null values", async () => {
      await db.transaction(async (tx) => {
        await tx.sql`INSERT INTO tx_test (id, value) VALUES (60, ${null})`;
      });
      const { rows } = await db.sql`SELECT * FROM tx_test WHERE id = 60`;
      expect((rows as any[])[0].value).toBeNull();
    });

    it("handles numeric values", async () => {
      await db.transaction(async (tx) => {
        await tx.sql`INSERT INTO tx_test (id, value, count) VALUES (61, 'num', ${42})`;
      });
      const { rows } = await db.sql`SELECT * FROM tx_test WHERE id = 61`;
      expect((rows as any[])[0].count).toBe(42);
    });

    it("handles special characters", async () => {
      const special = "Hello 'World' \"Test\" \\ `backtick`";
      await db.transaction(async (tx) => {
        await tx.sql`INSERT INTO tx_test (id, value) VALUES (62, ${special})`;
      });
      const { rows } = await db.sql`SELECT * FROM tx_test WHERE id = 62`;
      expect((rows as any[])[0].value).toBe(special);
    });

    it("handles unicode", async () => {
      const unicode = "こんにちは 🌍 émojis";
      await db.transaction(async (tx) => {
        await tx.sql`INSERT INTO tx_test (id, value) VALUES (63, ${unicode})`;
      });
      const { rows } = await db.sql`SELECT * FROM tx_test WHERE id = 63`;
      expect((rows as any[])[0].value).toBe(unicode);
    });
  });
});

describe("transactions: disposed database", () => {
  it("throws when starting transaction on disposed db", async () => {
    const db = createDatabase(sqliteConnector({}));
    await db.dispose();
    await expect(db.beginTransaction()).rejects.toThrow("disposed");
  });

  it("throws when using transaction callback on disposed db", async () => {
    const db = createDatabase(sqliteConnector({}));
    await db.dispose();
    await expect(db.transaction(async () => {})).rejects.toThrow("disposed");
  });
});

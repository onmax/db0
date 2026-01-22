import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import { createDatabase } from "../../src";
import sqliteConnector from "../../src/connectors/better-sqlite3";
import httpConnector from "../../src/connectors/http";
import { createDatabaseHandler } from "../../src/server";

describe("connectors: http", () => {
  let server: Server;
  let serverUrl: string;
  let backendDb: ReturnType<typeof createDatabase>;

  beforeAll(async () => {
    // Create backend SQLite database
    backendDb = createDatabase(sqliteConnector({ name: ":memory:" }));

    // Create the database handler
    const handler = createDatabaseHandler({ db: backendDb });

    // Create HTTP server
    server = createServer(async (req, res) => {
      const event = {
        node: { req, res },
        method: req.method,
        path: req.url,
      };

      const result = await handler(event);

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
    });

    // Start server on random port
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        if (addr && typeof addr === "object") {
          serverUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await backendDb.dispose();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  describe("basic operations", () => {
    it("create table", async () => {
      const db = createDatabase(httpConnector({ url: serverUrl }));
      await db.sql`CREATE TABLE IF NOT EXISTS users ("id" INTEGER PRIMARY KEY, "name" TEXT, "email" TEXT)`;
      await db.dispose();
    });

    it("insert and select", async () => {
      const db = createDatabase(httpConnector({ url: serverUrl }));

      await db.sql`INSERT INTO users (id, name, email) VALUES (1, 'Alice', 'alice@test.com')`;
      await db.sql`INSERT INTO users (id, name, email) VALUES (2, 'Bob', 'bob@test.com')`;

      const { rows } = await db.sql`SELECT * FROM users ORDER BY id`;
      expect(rows).toHaveLength(2);
      expect((rows as { name: string }[])[0].name).toBe("Alice");
      expect((rows as { name: string }[])[1].name).toBe("Bob");

      await db.dispose();
    });

    it("select with parameters", async () => {
      const db = createDatabase(httpConnector({ url: serverUrl }));

      const { rows } = await db.sql`SELECT * FROM users WHERE id = ${1}`;
      expect(rows).toHaveLength(1);
      expect((rows as { name: string }[])[0].name).toBe("Alice");

      await db.dispose();
    });

    it("update", async () => {
      const db = createDatabase(httpConnector({ url: serverUrl }));

      await db.sql`UPDATE users SET name = 'Alice Updated' WHERE id = 1`;

      const { rows } = await db.sql`SELECT * FROM users WHERE id = 1`;
      expect((rows as { name: string }[])[0].name).toBe("Alice Updated");

      await db.dispose();
    });

    it("delete", async () => {
      const db = createDatabase(httpConnector({ url: serverUrl }));

      await db.sql`DELETE FROM users WHERE id = 2`;

      const { rows } = await db.sql`SELECT * FROM users`;
      expect(rows).toHaveLength(1);

      await db.dispose();
    });
  });

  describe("prepared statements", () => {
    it("prepare and run", async () => {
      const db = createDatabase(httpConnector({ url: serverUrl }));

      await db.sql`DROP TABLE IF EXISTS prep_http_test`;
      await db.sql`CREATE TABLE prep_http_test ("id" INTEGER PRIMARY KEY, "value" TEXT)`;

      const stmt = db.prepare(
        "INSERT INTO prep_http_test (id, value) VALUES (?, ?)",
      );
      await stmt.run(1, "first");
      await stmt.run(2, "second");

      const selectStmt = db.prepare("SELECT * FROM prep_http_test ORDER BY id");
      const rows = await selectStmt.all();
      expect(rows).toHaveLength(2);

      await db.dispose();
    });

    it("prepare and get", async () => {
      const db = createDatabase(httpConnector({ url: serverUrl }));

      const stmt = db.prepare("SELECT * FROM prep_http_test WHERE id = ?");
      const row = await stmt.get(1);
      expect(row).toMatchObject({ id: 1, value: "first" });

      await db.dispose();
    });
  });

  describe("error handling", () => {
    it("throws on invalid SQL", async () => {
      const db = createDatabase(httpConnector({ url: serverUrl }));

      await expect(db.sql`SELECT * FROM nonexistent_table`).rejects.toThrow();

      await db.dispose();
    });
  });

  describe("dialect configuration", () => {
    it("uses sqlite dialect by default", () => {
      const db = createDatabase(httpConnector({ url: serverUrl }));
      expect(db.dialect).toBe("sqlite");
    });

    it("respects custom dialect option", () => {
      const db = createDatabase(
        httpConnector({ url: serverUrl, dialect: "postgresql" }),
      );
      expect(db.dialect).toBe("postgresql");
    });
  });

  describe("capabilities", () => {
    it("reports correct capabilities", () => {
      const db = createDatabase(httpConnector({ url: serverUrl }));
      expect(db.capabilities.supportsTransactions).toBe(false);
      expect(db.capabilities.supportsBatch).toBe(false);
    });
  });
});

describe("http server: authorization", () => {
  let server: Server;
  let serverUrl: string;
  let backendDb: ReturnType<typeof createDatabase>;

  beforeAll(async () => {
    backendDb = createDatabase(sqliteConnector({ name: ":memory:" }));
    await backendDb.sql`CREATE TABLE auth_test ("id" INTEGER PRIMARY KEY, "value" TEXT)`;

    const handler = createDatabaseHandler({
      db: backendDb,
      authorize: ({ event, type }) => {
        const authHeader = event.node?.req?.headers?.["authorization"];
        if (type === "write" && authHeader !== "Bearer secret-token") {
          throw new Error("Unauthorized");
        }
      },
    });

    server = createServer(async (req, res) => {
      const event = { node: { req, res }, method: req.method, path: req.url };
      const result = await handler(event);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        if (addr && typeof addr === "object") {
          serverUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await backendDb.dispose();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it("allows read without auth", async () => {
    const db = createDatabase(httpConnector({ url: serverUrl }));
    const { rows } = await db.sql`SELECT * FROM auth_test`;
    expect(rows).toBeDefined();
    await db.dispose();
  });

  it("rejects write without auth", async () => {
    const db = createDatabase(httpConnector({ url: serverUrl }));
    await expect(
      db.sql`INSERT INTO auth_test (id, value) VALUES (1, 'test')`,
    ).rejects.toThrow("Unauthorized");
    await db.dispose();
  });

  it("allows write with valid auth", async () => {
    const db = createDatabase(
      httpConnector({
        url: serverUrl,
        headers: { Authorization: "Bearer secret-token" },
      }),
    );

    await db.sql`INSERT INTO auth_test (id, value) VALUES (1, 'authorized')`;

    const { rows } = await db.sql`SELECT * FROM auth_test WHERE id = 1`;
    expect((rows as { value: string }[])[0].value).toBe("authorized");

    await db.dispose();
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Database, createDatabase } from "../../src";
import {
  betterAuthAdapter,
  type BetterAuthAdapter,
  type Where,
} from "../../src/integrations/better-auth";
import sqliteConnector from "../../src/connectors/better-sqlite3";
import pgConnector from "../../src/connectors/postgresql/postgres";
import mysqlConnector from "../../src/connectors/mysql/mysql2";

describe("integrations: better-auth: sqlite", () => {
  let db: Database;
  let adapter: BetterAuthAdapter;

  beforeAll(async () => {
    db = createDatabase(sqliteConnector({}));
    adapter = betterAuthAdapter(db);

    await db.sql`DROP TABLE IF EXISTS user`;
    await db.sql`CREATE TABLE IF NOT EXISTS user (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE,
      emailVerified INTEGER,
      image TEXT,
      createdAt TEXT,
      updatedAt TEXT
    )`;

    await db.sql`DROP TABLE IF EXISTS session`;
    await db.sql`CREATE TABLE IF NOT EXISTS session (
      id TEXT PRIMARY KEY,
      userId TEXT,
      token TEXT UNIQUE,
      expiresAt TEXT,
      createdAt TEXT,
      updatedAt TEXT
    )`;
  });

  beforeEach(async () => {
    await db.sql`DELETE FROM user`;
    await db.sql`DELETE FROM session`;
  });

  afterAll(async () => {
    await db.sql`DROP TABLE IF EXISTS user`;
    await db.sql`DROP TABLE IF EXISTS session`;
  });

  describe("adapter.id", () => {
    it("has correct adapter id", () => {
      expect(adapter.id).toBe("db0");
    });

    it("can customize adapter id", () => {
      const customAdapter = betterAuthAdapter(db, { adapterId: "custom-db0" });
      expect(customAdapter.id).toBe("custom-db0");
    });
  });

  describe("adapter.capabilities", () => {
    it("exposes capability flags", () => {
      expect(adapter.capabilities).toBeDefined();
      expect(typeof adapter.capabilities.supportsJSON).toBe("boolean");
      expect(typeof adapter.capabilities.supportsBooleans).toBe("boolean");
      expect(typeof adapter.capabilities.supportsDates).toBe("boolean");
      expect(typeof adapter.capabilities.supportsArrays).toBe("boolean");
      expect(typeof adapter.capabilities.supportsUUIDs).toBe("boolean");
      expect(typeof adapter.capabilities.supportsTransactions).toBe("boolean");
      expect(typeof adapter.capabilities.supportsBatch).toBe("boolean");
      expect(typeof adapter.capabilities.supportsNumericIds).toBe("boolean");
    });
  });

  describe("create", () => {
    it("creates a record and returns it", async () => {
      const result = await adapter.create<{ name: string; email: string }>({
        model: "user",
        data: { name: "John Doe", email: "john@example.com" },
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe("string");
      expect(result.name).toBe("John Doe");
      expect(result.email).toBe("john@example.com");
    });

    it("generates ID automatically", async () => {
      const result = await adapter.create({
        model: "user",
        data: { name: "Jane Doe", email: "jane@example.com" },
      });

      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe("string");
      expect((result.id as string).length).toBeGreaterThan(0);
    });

    it("allows forcing custom ID with forceAllowId", async () => {
      const customId = "custom-user-id-123";
      const result = await adapter.create({
        model: "user",
        data: {
          id: customId,
          name: "Custom User",
          email: "custom@example.com",
        },
        forceAllowId: true,
      });

      expect(result.id).toBe(customId);
    });

    it("supports select parameter", async () => {
      const result = await adapter.create({
        model: "user",
        data: { name: "Select Test", email: "select@example.com" },
        select: ["id", "name"],
      });

      expect(result.id).toBeDefined();
      expect(result.name).toBe("Select Test");
    });
  });

  describe("findOne", () => {
    it("finds a single record", async () => {
      await adapter.create({
        model: "user",
        data: {
          id: "find-one-1",
          name: "Find One",
          email: "findone@example.com",
        },
        forceAllowId: true,
      });

      const result = await adapter.findOne<{
        id: string;
        name: string;
        email: string;
      }>({
        model: "user",
        where: [{ field: "id", value: "find-one-1" }],
      });

      expect(result).not.toBeNull();
      expect(result?.id).toBe("find-one-1");
      expect(result?.name).toBe("Find One");
    });

    it("returns null when no record found", async () => {
      const result = await adapter.findOne({
        model: "user",
        where: [{ field: "id", value: "non-existent" }],
      });

      expect(result).toBeNull();
    });

    it("supports multiple where conditions with AND", async () => {
      await adapter.create({
        model: "user",
        data: { id: "multi-1", name: "Multi Test", email: "multi@example.com" },
        forceAllowId: true,
      });

      const result = await adapter.findOne({
        model: "user",
        where: [
          { field: "id", value: "multi-1" },
          { field: "name", value: "Multi Test", connector: "AND" },
        ],
      });

      expect(result).not.toBeNull();
    });

    it("supports select parameter", async () => {
      await adapter.create({
        model: "user",
        data: {
          id: "select-1",
          name: "Select Test",
          email: "selecttest@example.com",
        },
        forceAllowId: true,
      });

      const result = await adapter.findOne<{ id: string; name: string }>({
        model: "user",
        where: [{ field: "id", value: "select-1" }],
        select: ["id", "name"],
      });

      expect(result?.id).toBe("select-1");
      expect(result?.name).toBe("Select Test");
    });
  });

  describe("findMany", () => {
    beforeEach(async () => {
      await adapter.create({
        model: "user",
        data: { id: "u1", name: "User 1", email: "u1@example.com" },
        forceAllowId: true,
      });
      await adapter.create({
        model: "user",
        data: { id: "u2", name: "User 2", email: "u2@example.com" },
        forceAllowId: true,
      });
      await adapter.create({
        model: "user",
        data: { id: "u3", name: "User 3", email: "u3@example.com" },
        forceAllowId: true,
      });
    });

    it("finds multiple records", async () => {
      const results = await adapter.findMany<{ id: string; name: string }>({
        model: "user",
      });

      expect(results.length).toBe(3);
    });

    it("supports where clause", async () => {
      const results = await adapter.findMany({
        model: "user",
        where: [{ field: "name", value: "User 1" }],
      });

      expect(results.length).toBe(1);
    });

    it("supports limit", async () => {
      const results = await adapter.findMany({
        model: "user",
        limit: 2,
      });

      expect(results.length).toBe(2);
    });

    it("supports offset", async () => {
      const results = await adapter.findMany({
        model: "user",
        limit: 10,
        offset: 1,
      });

      expect(results.length).toBe(2);
    });

    it("supports sortBy ascending", async () => {
      const results = await adapter.findMany<{ id: string; name: string }>({
        model: "user",
        sortBy: { field: "name", direction: "asc" },
      });

      expect(results[0].name).toBe("User 1");
      expect(results[2].name).toBe("User 3");
    });

    it("supports sortBy descending", async () => {
      const results = await adapter.findMany<{ id: string; name: string }>({
        model: "user",
        sortBy: { field: "name", direction: "desc" },
      });

      expect(results[0].name).toBe("User 3");
      expect(results[2].name).toBe("User 1");
    });
  });

  describe("update", () => {
    it("updates a record and returns it", async () => {
      await adapter.create({
        model: "user",
        data: {
          id: "update-1",
          name: "Before Update",
          email: "before@example.com",
        },
        forceAllowId: true,
      });

      const result = await adapter.update<{
        id: string;
        name: string;
        email: string;
      }>({
        model: "user",
        where: [{ field: "id", value: "update-1" }],
        update: { name: "After Update" },
      });

      expect(result?.name).toBe("After Update");
      expect(result?.email).toBe("before@example.com");
    });

    it("returns null when no record matches", async () => {
      const result = await adapter.update({
        model: "user",
        where: [{ field: "id", value: "non-existent" }],
        update: { name: "Test" },
      });

      expect(result).toBeNull();
    });
  });

  describe("updateMany", () => {
    it("updates multiple records and returns count", async () => {
      await adapter.create({
        model: "user",
        data: { id: "um1", name: "Update Many", email: "um1@example.com" },
        forceAllowId: true,
      });
      await adapter.create({
        model: "user",
        data: { id: "um2", name: "Update Many", email: "um2@example.com" },
        forceAllowId: true,
      });

      const count = await adapter.updateMany({
        model: "user",
        where: [{ field: "name", value: "Update Many" }],
        update: { name: "Updated All" },
      });

      expect(count).toBe(2);

      const results = await adapter.findMany({
        model: "user",
        where: [{ field: "name", value: "Updated All" }],
      });

      expect(results.length).toBe(2);
    });
  });

  describe("delete", () => {
    it("deletes a record", async () => {
      await adapter.create({
        model: "user",
        data: {
          id: "delete-1",
          name: "To Delete",
          email: "delete@example.com",
        },
        forceAllowId: true,
      });

      await adapter.delete({
        model: "user",
        where: [{ field: "id", value: "delete-1" }],
      });

      const result = await adapter.findOne({
        model: "user",
        where: [{ field: "id", value: "delete-1" }],
      });

      expect(result).toBeNull();
    });
  });

  describe("deleteMany", () => {
    it("deletes multiple records and returns count", async () => {
      await adapter.create({
        model: "user",
        data: { id: "dm1", name: "Delete Many", email: "dm1@example.com" },
        forceAllowId: true,
      });
      await adapter.create({
        model: "user",
        data: { id: "dm2", name: "Delete Many", email: "dm2@example.com" },
        forceAllowId: true,
      });

      const count = await adapter.deleteMany({
        model: "user",
        where: [{ field: "name", value: "Delete Many" }],
      });

      expect(count).toBe(2);
    });
  });

  describe("count", () => {
    it("counts all records", async () => {
      await adapter.create({
        model: "user",
        data: { id: "c1", name: "Count 1", email: "c1@example.com" },
        forceAllowId: true,
      });
      await adapter.create({
        model: "user",
        data: { id: "c2", name: "Count 2", email: "c2@example.com" },
        forceAllowId: true,
      });

      const count = await adapter.count({ model: "user" });
      expect(count).toBe(2);
    });

    it("counts with where clause", async () => {
      await adapter.create({
        model: "user",
        data: { id: "cw1", name: "Count Where", email: "cw1@example.com" },
        forceAllowId: true,
      });
      await adapter.create({
        model: "user",
        data: { id: "cw2", name: "Count Where", email: "cw2@example.com" },
        forceAllowId: true,
      });
      await adapter.create({
        model: "user",
        data: { id: "cw3", name: "Other", email: "cw3@example.com" },
        forceAllowId: true,
      });

      const count = await adapter.count({
        model: "user",
        where: [{ field: "name", value: "Count Where" }],
      });

      expect(count).toBe(2);
    });
  });

  describe("where operators", () => {
    beforeEach(async () => {
      await adapter.create({
        model: "session",
        data: {
          id: "s1",
          userId: "u1",
          token: "token1",
          expiresAt: "2025-01-01",
        },
        forceAllowId: true,
      });
      await adapter.create({
        model: "session",
        data: {
          id: "s2",
          userId: "u2",
          token: "token2",
          expiresAt: "2025-06-01",
        },
        forceAllowId: true,
      });
      await adapter.create({
        model: "session",
        data: {
          id: "s3",
          userId: "u3",
          token: "token3",
          expiresAt: "2025-12-01",
        },
        forceAllowId: true,
      });
    });

    it("supports eq operator (default)", async () => {
      const result = await adapter.findOne({
        model: "session",
        where: [{ field: "id", operator: "eq", value: "s1" }],
      });
      expect(result).not.toBeNull();
    });

    it("supports ne operator", async () => {
      const results = await adapter.findMany({
        model: "session",
        where: [{ field: "id", operator: "ne", value: "s1" }],
      });
      expect(results.length).toBe(2);
    });

    it("supports gt operator", async () => {
      const results = await adapter.findMany({
        model: "session",
        where: [{ field: "expiresAt", operator: "gt", value: "2025-01-01" }],
      });
      expect(results.length).toBe(2);
    });

    it("supports gte operator", async () => {
      const results = await adapter.findMany({
        model: "session",
        where: [{ field: "expiresAt", operator: "gte", value: "2025-06-01" }],
      });
      expect(results.length).toBe(2);
    });

    it("supports lt operator", async () => {
      const results = await adapter.findMany({
        model: "session",
        where: [{ field: "expiresAt", operator: "lt", value: "2025-12-01" }],
      });
      expect(results.length).toBe(2);
    });

    it("supports lte operator", async () => {
      const results = await adapter.findMany({
        model: "session",
        where: [{ field: "expiresAt", operator: "lte", value: "2025-06-01" }],
      });
      expect(results.length).toBe(2);
    });

    it("supports in operator", async () => {
      const results = await adapter.findMany({
        model: "session",
        where: [{ field: "id", operator: "in", value: ["s1", "s2"] }],
      });
      expect(results.length).toBe(2);
    });

    it("supports not_in operator", async () => {
      const results = await adapter.findMany({
        model: "session",
        where: [{ field: "id", operator: "not_in", value: ["s1", "s2"] }],
      });
      expect(results.length).toBe(1);
    });

    it("supports contains operator", async () => {
      const results = await adapter.findMany({
        model: "session",
        where: [{ field: "token", operator: "contains", value: "oken" }],
      });
      expect(results.length).toBe(3);
    });

    it("supports starts_with operator", async () => {
      const results = await adapter.findMany({
        model: "session",
        where: [{ field: "token", operator: "starts_with", value: "token" }],
      });
      expect(results.length).toBe(3);
    });

    it("supports ends_with operator", async () => {
      const results = await adapter.findMany({
        model: "session",
        where: [{ field: "token", operator: "ends_with", value: "1" }],
      });
      expect(results.length).toBe(1);
    });
  });

  describe("transaction", () => {
    it("commits on success", async () => {
      await adapter.transaction(async (tx) => {
        await tx.create({
          model: "user",
          data: {
            id: "tx-1",
            name: "Transaction User",
            email: "tx@example.com",
          },
          forceAllowId: true,
        });
      });

      const result = await adapter.findOne({
        model: "user",
        where: [{ field: "id", value: "tx-1" }],
      });

      expect(result).not.toBeNull();
    });

    it("rolls back on error", async () => {
      try {
        await adapter.transaction(async (tx) => {
          await tx.create({
            model: "user",
            data: {
              id: "tx-rollback",
              name: "Rollback User",
              email: "rollback@example.com",
            },
            forceAllowId: true,
          });
          throw new Error("Intentional error");
        });
      } catch {
        // Expected
      }

      const result = await adapter.findOne({
        model: "user",
        where: [{ field: "id", value: "tx-rollback" }],
      });

      expect(result).toBeNull();
    });

    it("supports all operations within transaction", async () => {
      await adapter.create({
        model: "user",
        data: { id: "tx-ops", name: "TX Ops", email: "txops@example.com" },
        forceAllowId: true,
      });

      await adapter.transaction(async (tx) => {
        const user = await tx.findOne({
          model: "user",
          where: [{ field: "id", value: "tx-ops" }],
        });
        expect(user).not.toBeNull();

        await tx.update({
          model: "user",
          where: [{ field: "id", value: "tx-ops" }],
          update: { name: "Updated in TX" },
        });

        const count = await tx.count({ model: "user" });
        expect(count).toBeGreaterThan(0);
      });

      const updated = await adapter.findOne<{ name: string }>({
        model: "user",
        where: [{ field: "id", value: "tx-ops" }],
      });

      expect(updated?.name).toBe("Updated in TX");
    });
  });

  describe("type transformations", () => {
    it("transforms booleans to integers for sqlite", async () => {
      await db.sql`DROP TABLE IF EXISTS test_types`;
      await db.sql`CREATE TABLE test_types (id TEXT PRIMARY KEY, active INTEGER)`;

      const customAdapter = betterAuthAdapter(db, {
        supportsBooleans: false,
      });

      await customAdapter.create({
        model: "test_types",
        data: { id: "bool-1", active: true },
        forceAllowId: true,
      });

      // Check raw value in database
      const rawResult =
        await db.sql`SELECT active FROM test_types WHERE id = 'bool-1'`;
      expect((rawResult as any).rows[0].active).toBe(1);

      await db.sql`DROP TABLE IF EXISTS test_types`;
    });
  });

  describe("configuration options", () => {
    it("supports usePlural for table names", async () => {
      await db.sql`DROP TABLE IF EXISTS users`;
      await db.sql`CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT)`;

      const pluralAdapter = betterAuthAdapter(db, { usePlural: true });

      await pluralAdapter.create({
        model: "user",
        data: { id: "plural-1", name: "Plural Test" },
        forceAllowId: true,
      });

      const result = await pluralAdapter.findOne({
        model: "user",
        where: [{ field: "id", value: "plural-1" }],
      });

      expect(result).not.toBeNull();

      await db.sql`DROP TABLE IF EXISTS users`;
    });

    it("supports custom ID generator", async () => {
      const customAdapter = betterAuthAdapter(db, {
        customIdGenerator: ({ model }) => `${model}-custom-${Date.now()}`,
      });

      const result = await customAdapter.create({
        model: "user",
        data: { name: "Custom ID", email: "customid@example.com" },
      });

      expect((result.id as string).startsWith("user-custom-")).toBe(true);
    });

    it("supports disabling ID generation", async () => {
      const noIdAdapter = betterAuthAdapter(db, {
        disableIdGeneration: true,
      });

      // Create with explicit ID since generation is disabled
      const result = await noIdAdapter.create({
        model: "user",
        data: {
          id: "explicit-id",
          name: "Explicit ID",
          email: "explicit@example.com",
        },
        forceAllowId: true,
      });

      expect(result.id).toBe("explicit-id");
    });

    it("supports key mapping for input/output", async () => {
      await db.sql`DROP TABLE IF EXISTS mapped_table`;
      await db.sql`CREATE TABLE mapped_table (_id TEXT PRIMARY KEY, user_name TEXT)`;

      const mappedAdapter = betterAuthAdapter(db, {
        mapKeysTransformInput: { id: "_id", name: "user_name" },
        mapKeysTransformOutput: { id: "_id", name: "user_name" },
      });

      await mappedAdapter.create({
        model: "mapped_table",
        data: { id: "mapped-1", name: "Mapped Name" },
        forceAllowId: true,
      });

      const result = await mappedAdapter.findOne<{ id: string; name: string }>({
        model: "mapped_table",
        where: [{ field: "id", value: "mapped-1" }],
      });

      expect(result?.id).toBe("mapped-1");
      expect(result?.name).toBe("Mapped Name");

      await db.sql`DROP TABLE IF EXISTS mapped_table`;
    });
  });
});

describe.runIf(process.env.POSTGRESQL_URL)(
  "integrations: better-auth: postgresql",
  () => {
    let db: Database;
    let adapter: BetterAuthAdapter;

    beforeAll(async () => {
      db = createDatabase(
        pgConnector({ url: process.env.POSTGRESQL_URL as string }),
      );
      adapter = betterAuthAdapter(db);

      await db.sql`DROP TABLE IF EXISTS "user"`;
      await db.sql`CREATE TABLE "user" (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE
    )`;
    });

    beforeEach(async () => {
      await db.sql`DELETE FROM "user"`;
    });

    afterAll(async () => {
      await db.sql`DROP TABLE IF EXISTS "user"`;
    });

    it("creates and finds records", async () => {
      const created = await adapter.create({
        model: "user",
        data: { id: "pg-1", name: "PG User", email: "pg@example.com" },
        forceAllowId: true,
      });

      expect(created.id).toBe("pg-1");

      const found = await adapter.findOne({
        model: "user",
        where: [{ field: "id", value: "pg-1" }],
      });

      expect(found).not.toBeNull();
    });

    it("supports all where operators", async () => {
      await adapter.create({
        model: "user",
        data: {
          id: "pg-op-1",
          name: "Operator Test",
          email: "op1@example.com",
        },
        forceAllowId: true,
      });
      await adapter.create({
        model: "user",
        data: {
          id: "pg-op-2",
          name: "Operator Test",
          email: "op2@example.com",
        },
        forceAllowId: true,
      });

      const inResults = await adapter.findMany({
        model: "user",
        where: [{ field: "id", operator: "in", value: ["pg-op-1", "pg-op-2"] }],
      });

      expect(inResults.length).toBe(2);
    });
  },
);

describe.runIf(process.env.MYSQL_URL)(
  "integrations: better-auth: mysql",
  () => {
    let db: Database;
    let adapter: BetterAuthAdapter;

    beforeAll(async () => {
      db = createDatabase(
        mysqlConnector({ uri: process.env.MYSQL_URL as string }),
      );
      adapter = betterAuthAdapter(db);

      await db.sql`DROP TABLE IF EXISTS user`;
      await db.sql`CREATE TABLE user (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255),
      email VARCHAR(255) UNIQUE
    )`;
    });

    beforeEach(async () => {
      await db.sql`DELETE FROM user`;
    });

    afterAll(async () => {
      await db.sql`DROP TABLE IF EXISTS user`;
    });

    it("creates and finds records", async () => {
      const created = await adapter.create({
        model: "user",
        data: { id: "mysql-1", name: "MySQL User", email: "mysql@example.com" },
        forceAllowId: true,
      });

      expect(created.id).toBe("mysql-1");

      const found = await adapter.findOne({
        model: "user",
        where: [{ field: "id", value: "mysql-1" }],
      });

      expect(found).not.toBeNull();
    });

    it("handles MySQL-specific quoting", async () => {
      await adapter.create({
        model: "user",
        data: {
          id: "mysql-quote",
          name: "MySQL Quote Test",
          email: "quote@example.com",
        },
        forceAllowId: true,
      });

      const results = await adapter.findMany({
        model: "user",
        where: [{ field: "name", operator: "contains", value: "Quote" }],
      });

      expect(results.length).toBe(1);
    });
  },
);

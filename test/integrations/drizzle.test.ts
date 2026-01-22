import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { Database, createDatabase } from "../../src";
import {
  drizzle,
  drizzleAdapter,
  type DrizzleSQLiteDatabase,
  type DrizzlePgDatabase,
  type DrizzleMySqlDatabase,
  type InferSelectModel,
  type InferInsertModel,
} from "../../src/integrations/drizzle";

import * as dSqlite from "drizzle-orm/sqlite-core";
import sqliteConnector from "../../src/connectors/better-sqlite3";

import * as dPg from "drizzle-orm/pg-core";
import pgConnector from "../../src/connectors/postgresql/postgres";

import * as dMySql from "drizzle-orm/mysql-core";
import mysqlConnector from "../../src/connectors/mysql/mysql2";

describe("integrations: drizzle: better-sqlite3", () => {
  const users = dSqlite.sqliteTable("users", {
    id: dSqlite.numeric("id"),
    name: dSqlite.text("name"),
  });

  let drizzleDb: DrizzleSQLiteDatabase;
  let db: Database;

  beforeAll(async () => {
    db = createDatabase(sqliteConnector({}));
    drizzleDb = drizzle(db);
    await db.sql`DROP TABLE IF EXISTS users`;
    await db.sql`create table if not exists users (
      id integer primary key autoincrement,
      name text
    )`;
  });

  it("insert", async () => {
    const res = await drizzleDb
      .insert(users)
      .values({
        name: "John Doe",
      })
      .returning();

    expect(res.length).toBe(1);
    expect(res[0].name).toBe("John Doe");
  });

  it("select", async () => {
    const res = await drizzleDb.select().from(users).all();

    expect(res.length).toBe(1);
    expect(res[0].name).toBe("John Doe");
  });

  it("accepts boolean logger config", () => {
    expect(() => drizzle(db, { logger: true })).not.toThrow();
  });

  afterAll(async () => {
    await db.sql`DROP TABLE IF EXISTS users`;
  });
});

describe("integrations: drizzle: with schema parameter", () => {
  const users = dSqlite.sqliteTable("users_schema", {
    id: dSqlite.numeric("id"),
    name: dSqlite.text("name"),
    email: dSqlite.text("email"),
  });

  const schema = { users };

  let drizzleDb: DrizzleSQLiteDatabase<typeof schema>;
  let db: Database;

  beforeAll(async () => {
    db = createDatabase(sqliteConnector({}));
    drizzleDb = drizzle(db, { schema });
    await db.sql`DROP TABLE IF EXISTS users_schema`;
    await db.sql`create table if not exists users_schema (
      id integer primary key autoincrement,
      name text,
      email text
    )`;
  });

  it("insert with schema", async () => {
    const res = await drizzleDb
      .insert(users)
      .values({
        name: "Jane Doe",
        email: "jane@example.com",
      })
      .returning();

    expect(res.length).toBe(1);
    expect(res[0].name).toBe("Jane Doe");
    expect(res[0].email).toBe("jane@example.com");
  });

  it("select with schema", async () => {
    const res = await drizzleDb.select().from(users).all();

    expect(res.length).toBe(1);
    expect(res[0].name).toBe("Jane Doe");
    expect(res[0].email).toBe("jane@example.com");
  });

  afterAll(async () => {
    await db.sql`DROP TABLE IF EXISTS users_schema`;
  });
});

describe.runIf(process.env.POSTGRESQL_URL)(
  "integrations: drizzle: postgres",
  () => {
    const users = dPg.pgTable("users", {
      id: dPg.integer("id").primaryKey(),
      name: dPg.text("name"),
    });

    let drizzleDb: DrizzlePgDatabase;
    let db: Database<ReturnType<typeof pgConnector>>;

    beforeAll(async () => {
      db = createDatabase(
        pgConnector({
          url: process.env.POSTGRESQL_URL as string,
        }),
      );

      drizzleDb = drizzle(db);
      await db.sql`DROP TABLE IF EXISTS users`;
      await db.sql`CREATE TABLE users ("id" INTEGER PRIMARY KEY, "name" TEXT)`;
    });

    it("insert", async () => {
      const res = await drizzleDb
        .insert(users)
        .values({
          id: 1,
          name: "John Doe",
        })
        .returning();

      expect(res.length).toBe(1);
      expect(res[0].name).toBe("John Doe");
    });

    it("select", async () => {
      const res = await drizzleDb.select().from(users);

      expect(res.length).toBe(1);
      expect(res[0].name).toBe("John Doe");
    });

    afterAll(async () => {
      await db.sql`DROP TABLE IF EXISTS users`;
    });
  },
);

describe.runIf(process.env.MYSQL_URL)("integrations: drizzle: mysql", () => {
  const users = dMySql.mysqlTable("users", {
    id: dMySql.int("id").primaryKey(),
    name: dMySql.text("name"),
  });

  let drizzleDb: DrizzleMySqlDatabase;
  let db: Database<ReturnType<typeof mysqlConnector>>;

  beforeAll(async () => {
    db = createDatabase(
      mysqlConnector({
        uri: process.env.MYSQL_URL as string,
      }),
    );

    drizzleDb = drizzle(db);
    await db.sql`DROP TABLE IF EXISTS users`;
    await db.sql`CREATE TABLE users (id INT PRIMARY KEY, name TEXT)`;
  });

  it("insert", async () => {
    await drizzleDb.insert(users).values({
      id: 1,
      name: "John Doe",
    });

    const res = await drizzleDb.select().from(users);
    expect(res.length).toBe(1);
    expect(res[0].name).toBe("John Doe");
  });

  it("select", async () => {
    const res = await drizzleDb.select().from(users);

    expect(res.length).toBe(1);
    expect(res[0].name).toBe("John Doe");
  });

  afterAll(async () => {
    await db.sql`DROP TABLE IF EXISTS users`;
  });
});

// ============================================================================
// drizzleAdapter tests
// ============================================================================

describe("integrations: drizzleAdapter: sqlite", () => {
  const users = dSqlite.sqliteTable("adapter_users", {
    id: dSqlite.integer("id").primaryKey({ autoIncrement: true }),
    name: dSqlite.text("name").notNull(),
    email: dSqlite.text("email"),
    active: dSqlite.integer("active", { mode: "boolean" }).default(true),
  });

  const posts = dSqlite.sqliteTable("adapter_posts", {
    id: dSqlite.integer("id").primaryKey({ autoIncrement: true }),
    title: dSqlite.text("title").notNull(),
    authorId: dSqlite.integer("author_id").notNull(),
  });

  const schema = { users, posts };

  let db: Database;

  beforeAll(async () => {
    db = createDatabase(sqliteConnector({}));
    await db.sql`DROP TABLE IF EXISTS adapter_users`;
    await db.sql`DROP TABLE IF EXISTS adapter_posts`;
    await db.sql`CREATE TABLE adapter_users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT, active INTEGER DEFAULT 1)`;
    await db.sql`CREATE TABLE adapter_posts (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, author_id INTEGER NOT NULL)`;
  });

  it("extracts table definitions", () => {
    const adapter = drizzleAdapter(db, schema);

    expect(adapter.tables.users).toBeDefined();
    expect(adapter.tables.users.name).toBe("adapter_users");
    expect(adapter.tables.users.columns.id).toBeDefined();
    expect(adapter.tables.users.columns.name).toBeDefined();
    expect(adapter.tables.users.columns.email).toBeDefined();

    expect(adapter.tables.posts).toBeDefined();
    expect(adapter.tables.posts.name).toBe("adapter_posts");
  });

  it("provides column metadata", () => {
    const adapter = drizzleAdapter(db, schema);

    expect(adapter.tables.users.columns.id.notNull).toBe(true);
    expect(adapter.tables.users.columns.id.hasDefault).toBe(true);
    expect(adapter.tables.users.columns.name.notNull).toBe(true);
    expect(adapter.tables.users.columns.email.notNull).toBe(false);
    expect(adapter.tables.users.columns.active.hasDefault).toBe(true);
  });

  it("exposes native drizzle instance", async () => {
    const adapter = drizzleAdapter(db, schema);

    const res = await adapter.native
      .insert(users)
      .values({ name: "Alice" })
      .returning();

    expect(res.length).toBe(1);
    expect(res[0].name).toBe("Alice");
  });

  it("native instance supports select", async () => {
    const adapter = drizzleAdapter(db, schema);
    const res = await adapter.native.select().from(users).all();

    expect(res.length).toBeGreaterThan(0);
    expect(res[0].name).toBe("Alice");
  });

  it("getTableDefinition returns correct table", () => {
    const adapter = drizzleAdapter(db, schema);
    const usersDef = adapter.getTableDefinition("users");

    expect(usersDef.name).toBe("adapter_users");
    expect(usersDef.table).toBe(users);
  });

  it("preserves original table reference", () => {
    const adapter = drizzleAdapter(db, schema);
    expect(adapter.tables.users.table).toBe(users);
    expect(adapter.tables.posts.table).toBe(posts);
  });

  afterAll(async () => {
    await db.sql`DROP TABLE IF EXISTS adapter_users`;
    await db.sql`DROP TABLE IF EXISTS adapter_posts`;
  });
});

describe.runIf(process.env.POSTGRESQL_URL)(
  "integrations: drizzleAdapter: postgresql",
  () => {
    const users = dPg.pgTable("adapter_pg_users", {
      id: dPg.serial("id").primaryKey(),
      name: dPg.text("name").notNull(),
      email: dPg.text("email"),
    });

    const schema = { users };
    let db: Database<ReturnType<typeof pgConnector>>;

    beforeAll(async () => {
      db = createDatabase(
        pgConnector({ url: process.env.POSTGRESQL_URL as string }),
      );
      await db.sql`DROP TABLE IF EXISTS adapter_pg_users`;
      await db.sql`CREATE TABLE adapter_pg_users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT)`;
    });

    it("extracts table definitions for postgresql", () => {
      const adapter = drizzleAdapter(db, schema);

      expect(adapter.tables.users.name).toBe("adapter_pg_users");
      expect(adapter.tables.users.columns.id.hasDefault).toBe(true);
      expect(adapter.tables.users.columns.name.notNull).toBe(true);
    });

    it("native instance works with postgresql", async () => {
      const adapter = drizzleAdapter(db, schema);

      const res = await adapter.native
        .insert(users)
        .values({ name: "Bob" })
        .returning();

      expect(res[0].name).toBe("Bob");
    });

    afterAll(async () => {
      await db.sql`DROP TABLE IF EXISTS adapter_pg_users`;
    });
  },
);

describe.runIf(process.env.MYSQL_URL)(
  "integrations: drizzleAdapter: mysql",
  () => {
    const users = dMySql.mysqlTable("adapter_mysql_users", {
      id: dMySql.int("id").primaryKey().autoincrement(),
      name: dMySql.text("name").notNull(),
      email: dMySql.text("email"),
    });

    const schema = { users };
    let db: Database<ReturnType<typeof mysqlConnector>>;

    beforeAll(async () => {
      db = createDatabase(
        mysqlConnector({ uri: process.env.MYSQL_URL as string }),
      );
      await db.sql`DROP TABLE IF EXISTS adapter_mysql_users`;
      await db.sql`CREATE TABLE adapter_mysql_users (id INT PRIMARY KEY AUTO_INCREMENT, name TEXT NOT NULL, email TEXT)`;
    });

    it("extracts table definitions for mysql", () => {
      const adapter = drizzleAdapter(db, schema);

      expect(adapter.tables.users.name).toBe("adapter_mysql_users");
      expect(adapter.tables.users.columns.id.hasDefault).toBe(true);
      expect(adapter.tables.users.columns.name.notNull).toBe(true);
    });

    it("native instance works with mysql", async () => {
      const adapter = drizzleAdapter(db, schema);

      await adapter.native.insert(users).values({ name: "Charlie" });
      const res = await adapter.native.select().from(users);

      expect(res[0].name).toBe("Charlie");
    });

    afterAll(async () => {
      await db.sql`DROP TABLE IF EXISTS adapter_mysql_users`;
    });
  },
);

describe("integrations: drizzleAdapter: type inference", () => {
  const users = dSqlite.sqliteTable("typed_users", {
    id: dSqlite.integer("id").primaryKey({ autoIncrement: true }),
    name: dSqlite.text("name").notNull(),
    age: dSqlite.integer("age"),
  });

  const schema = { users };

  it("InferSelectModel extracts correct types", () => {
    type UserSelect = InferSelectModel<typeof users>;
    const testUser: UserSelect = { id: 1, name: "Test", age: 25 };

    expect(testUser.id).toBe(1);
    expect(testUser.name).toBe("Test");
    expect(testUser.age).toBe(25);
  });

  it("InferInsertModel allows optional fields", () => {
    type UserInsert = InferInsertModel<typeof users>;
    const newUser: UserInsert = { name: "Test" };

    expect(newUser.name).toBe("Test");
    expect(newUser.age).toBeUndefined();
  });
});

// ============================================================================
// Model API: findOne tests
// ============================================================================

describe("integrations: drizzleAdapter: model.findOne: sqlite", () => {
  const users = dSqlite.sqliteTable("model_users", {
    id: dSqlite.integer("id").primaryKey({ autoIncrement: true }),
    name: dSqlite.text("name").notNull(),
    email: dSqlite.text("email"),
    age: dSqlite.integer("age"),
    score: dSqlite.real("score"),
  });

  const schema = { users };
  let db: Database;

  beforeAll(async () => {
    db = createDatabase(sqliteConnector({}));
    await db.sql`DROP TABLE IF EXISTS model_users`;
    await db.sql`CREATE TABLE model_users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT, age INTEGER, score REAL)`;

    const adapter = drizzleAdapter(db, schema);
    await adapter.native.insert(users).values([
      { name: "Alice", email: "alice@example.com", age: 30, score: 95.5 },
      { name: "Bob", email: "bob@example.com", age: 25, score: 87 },
      { name: "Charlie", email: "charlie@example.com", age: 35, score: 92.5 },
      { name: "Diana", email: null, age: 28, score: 88 },
    ]);
  });

  it("returns single object when found", async () => {
    const adapter = drizzleAdapter(db, schema);
    const user = await adapter
      .model("users")
      .findOne({ where: { name: "Alice" } });

    expect(user).not.toBeNull();
    expect(user?.name).toBe("Alice");
    expect(user?.email).toBe("alice@example.com");
  });

  it("returns null when not found", async () => {
    const adapter = drizzleAdapter(db, schema);
    const user = await adapter
      .model("users")
      .findOne({ where: { name: "NonExistent" } });

    expect(user).toBeNull();
  });

  it("returns first match when multiple exist", async () => {
    const adapter = drizzleAdapter(db, schema);
    const user = await adapter.model("users").findOne();

    expect(user).not.toBeNull();
    expect(user?.id).toBe(1);
  });

  it("supports equality operator (implicit)", async () => {
    const adapter = drizzleAdapter(db, schema);
    const user = await adapter.model("users").findOne({ where: { age: 30 } });

    expect(user?.name).toBe("Alice");
  });

  it("supports eq operator (explicit)", async () => {
    const adapter = drizzleAdapter(db, schema);
    const user = await adapter
      .model("users")
      .findOne({ where: { age: { eq: 25 } } });

    expect(user?.name).toBe("Bob");
  });

  it("supports ne operator", async () => {
    const adapter = drizzleAdapter(db, schema);
    const user = await adapter
      .model("users")
      .findOne({ where: { name: { ne: "Alice" } } });

    expect(user?.name).not.toBe("Alice");
  });

  it("supports gt operator", async () => {
    const adapter = drizzleAdapter(db, schema);
    const user = await adapter
      .model("users")
      .findOne({ where: { age: { gt: 30 } } });

    expect(user?.name).toBe("Charlie");
  });

  it("supports gte operator", async () => {
    const adapter = drizzleAdapter(db, schema);
    const user = await adapter
      .model("users")
      .findOne({ where: { age: { gte: 35 } } });

    expect(user?.name).toBe("Charlie");
  });

  it("supports lt operator", async () => {
    const adapter = drizzleAdapter(db, schema);
    const user = await adapter
      .model("users")
      .findOne({ where: { age: { lt: 28 } } });

    expect(user?.name).toBe("Bob");
  });

  it("supports lte operator", async () => {
    const adapter = drizzleAdapter(db, schema);
    const user = await adapter
      .model("users")
      .findOne({ where: { age: { lte: 25 } } });

    expect(user?.name).toBe("Bob");
  });

  it("supports like operator", async () => {
    const adapter = drizzleAdapter(db, schema);
    const user = await adapter
      .model("users")
      .findOne({ where: { email: { like: "%@example.com" } } });

    expect(user).not.toBeNull();
  });

  it("supports in operator", async () => {
    const adapter = drizzleAdapter(db, schema);
    const user = await adapter
      .model("users")
      .findOne({ where: { name: { in: ["Bob", "Charlie"] } } });

    expect(["Bob", "Charlie"]).toContain(user?.name);
  });

  it("supports multiple where conditions (AND)", async () => {
    const adapter = drizzleAdapter(db, schema);
    const user = await adapter
      .model("users")
      .findOne({ where: { age: { gte: 25 }, name: { like: "B%" } } });

    expect(user?.name).toBe("Bob");
  });

  it("supports select to pick specific fields", async () => {
    const adapter = drizzleAdapter(db, schema);
    const user = await adapter.model("users").findOne({
      where: { name: "Alice" },
      select: ["name", "email"],
    });

    expect(user).not.toBeNull();
    expect(user?.name).toBe("Alice");
    expect(user?.email).toBe("alice@example.com");
    expect((user as any)?.age).toBeUndefined();
    expect((user as any)?.id).toBeUndefined();
  });

  it("TypeScript inference works for return type", async () => {
    const adapter = drizzleAdapter(db, schema);

    const fullUser = await adapter
      .model("users")
      .findOne({ where: { name: "Alice" } });
    if (fullUser) {
      const _id: number = fullUser.id;
      const _name: string = fullUser.name;
      const _email: string | null = fullUser.email;
      const _age: number | null = fullUser.age;
      expect(_id).toBeDefined();
      expect(_name).toBeDefined();
      expect(_email).toBeDefined();
      expect(_age).toBeDefined();
    }

    const partialUser = await adapter.model("users").findOne({
      where: { name: "Alice" },
      select: ["name", "email"],
    });
    if (partialUser) {
      const _name: string = partialUser.name;
      const _email: string | null = partialUser.email;
      expect(_name).toBe("Alice");
      expect(_email).toBe("alice@example.com");
    }
  });

  afterAll(async () => {
    await db.sql`DROP TABLE IF EXISTS model_users`;
  });
});

describe.runIf(process.env.POSTGRESQL_URL)(
  "integrations: drizzleAdapter: model.findOne: postgresql",
  () => {
    const users = dPg.pgTable("model_pg_users", {
      id: dPg.serial("id").primaryKey(),
      name: dPg.text("name").notNull(),
      email: dPg.text("email"),
      age: dPg.integer("age"),
    });

    const schema = { users };
    let db: Database<ReturnType<typeof pgConnector>>;

    beforeAll(async () => {
      db = createDatabase(
        pgConnector({ url: process.env.POSTGRESQL_URL as string }),
      );
      await db.sql`DROP TABLE IF EXISTS model_pg_users`;
      await db.sql`CREATE TABLE model_pg_users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT, age INTEGER)`;

      const adapter = drizzleAdapter(db, schema);
      await adapter.native.insert(users).values([
        { name: "Alice", email: "alice@example.com", age: 30 },
        { name: "Bob", email: "bob@example.com", age: 25 },
      ]);
    });

    it("returns single object when found", async () => {
      const adapter = drizzleAdapter(db, schema);
      const user = await adapter
        .model("users")
        .findOne({ where: { name: "Alice" } });

      expect(user).not.toBeNull();
      expect(user?.name).toBe("Alice");
    });

    it("supports where operators", async () => {
      const adapter = drizzleAdapter(db, schema);
      const user = await adapter
        .model("users")
        .findOne({ where: { age: { gt: 26 } } });

      expect(user?.name).toBe("Alice");
    });

    it("supports select", async () => {
      const adapter = drizzleAdapter(db, schema);
      const user = await adapter.model("users").findOne({
        where: { name: "Bob" },
        select: ["name"],
      });

      expect(user?.name).toBe("Bob");
      expect((user as any)?.email).toBeUndefined();
    });

    afterAll(async () => {
      await db.sql`DROP TABLE IF EXISTS model_pg_users`;
    });
  },
);

describe.runIf(process.env.MYSQL_URL)(
  "integrations: drizzleAdapter: model.findOne: mysql",
  () => {
    const users = dMySql.mysqlTable("model_mysql_users", {
      id: dMySql.int("id").primaryKey().autoincrement(),
      name: dMySql.text("name").notNull(),
      email: dMySql.text("email"),
      age: dMySql.int("age"),
    });

    const schema = { users };
    let db: Database<ReturnType<typeof mysqlConnector>>;

    beforeAll(async () => {
      db = createDatabase(
        mysqlConnector({ uri: process.env.MYSQL_URL as string }),
      );
      await db.sql`DROP TABLE IF EXISTS model_mysql_users`;
      await db.sql`CREATE TABLE model_mysql_users (id INT PRIMARY KEY AUTO_INCREMENT, name TEXT NOT NULL, email TEXT, age INT)`;

      const adapter = drizzleAdapter(db, schema);
      await adapter.native.insert(users).values([
        { name: "Alice", email: "alice@example.com", age: 30 },
        { name: "Bob", email: "bob@example.com", age: 25 },
      ]);
    });

    it("returns single object when found", async () => {
      const adapter = drizzleAdapter(db, schema);
      const user = await adapter
        .model("users")
        .findOne({ where: { name: "Alice" } });

      expect(user).not.toBeNull();
      expect(user?.name).toBe("Alice");
    });

    it("supports where operators", async () => {
      const adapter = drizzleAdapter(db, schema);
      const user = await adapter
        .model("users")
        .findOne({ where: { age: { lt: 30 } } });

      expect(user?.name).toBe("Bob");
    });

    it("supports select", async () => {
      const adapter = drizzleAdapter(db, schema);
      const user = await adapter.model("users").findOne({
        where: { name: "Alice" },
        select: ["name", "age"],
      });

      expect(user?.name).toBe("Alice");
      expect(user?.age).toBe(30);
      expect((user as any)?.email).toBeUndefined();
    });

    afterAll(async () => {
      await db.sql`DROP TABLE IF EXISTS model_mysql_users`;
    });
  },
);

// ============================================================================
// Model API: findMany tests
// ============================================================================

describe("integrations: drizzleAdapter: model.findMany: sqlite", () => {
  const users = dSqlite.sqliteTable("findmany_users", {
    id: dSqlite.integer("id").primaryKey({ autoIncrement: true }),
    name: dSqlite.text("name").notNull(),
    email: dSqlite.text("email"),
    age: dSqlite.integer("age"),
    score: dSqlite.real("score"),
  });

  const schema = { users };
  let db: Database;

  beforeAll(async () => {
    db = createDatabase(sqliteConnector({}));
    await db.sql`DROP TABLE IF EXISTS findmany_users`;
    await db.sql`CREATE TABLE findmany_users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT, age INTEGER, score REAL)`;

    const adapter = drizzleAdapter(db, schema);
    await adapter.native.insert(users).values([
      { name: "Alice", email: "alice@example.com", age: 30, score: 95.5 },
      { name: "Bob", email: "bob@example.com", age: 25, score: 87 },
      { name: "Charlie", email: "charlie@example.com", age: 35, score: 92.5 },
      { name: "Diana", email: null, age: 28, score: 88 },
      { name: "Eve", email: "eve@example.com", age: 22, score: 91 },
    ]);
  });

  it("returns array of objects", async () => {
    const adapter = drizzleAdapter(db, schema);
    const results = await adapter.model("users").findMany();

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(5);
  });

  it("returns empty array when no matches", async () => {
    const adapter = drizzleAdapter(db, schema);
    const results = await adapter
      .model("users")
      .findMany({ where: { name: "NonExistent" } });

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
  });

  it("supports where with equality operator", async () => {
    const adapter = drizzleAdapter(db, schema);
    const results = await adapter
      .model("users")
      .findMany({ where: { age: 30 } });

    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Alice");
  });

  it("supports where with gt operator", async () => {
    const adapter = drizzleAdapter(db, schema);
    const results = await adapter
      .model("users")
      .findMany({ where: { age: { gt: 28 } } });

    expect(results.length).toBe(2);
    expect(results.map((u) => u.name).sort()).toEqual(["Alice", "Charlie"]);
  });

  it("supports where with in operator", async () => {
    const adapter = drizzleAdapter(db, schema);
    const results = await adapter
      .model("users")
      .findMany({ where: { name: { in: ["Alice", "Bob", "Eve"] } } });

    expect(results.length).toBe(3);
  });

  it("supports where with like operator", async () => {
    const adapter = drizzleAdapter(db, schema);
    const results = await adapter
      .model("users")
      .findMany({ where: { name: { like: "%e" } } });

    expect(results.map((u) => u.name).sort()).toEqual([
      "Alice",
      "Charlie",
      "Eve",
    ]);
  });

  it("supports multiple where conditions (AND)", async () => {
    const adapter = drizzleAdapter(db, schema);
    const results = await adapter
      .model("users")
      .findMany({ where: { age: { gte: 25 }, score: { gt: 90 } } });

    expect(results.length).toBe(2);
    expect(results.map((u) => u.name).sort()).toEqual(["Alice", "Charlie"]);
  });

  it("supports limit", async () => {
    const adapter = drizzleAdapter(db, schema);
    const results = await adapter.model("users").findMany({ limit: 2 });

    expect(results.length).toBe(2);
  });

  it("supports offset with limit", async () => {
    const adapter = drizzleAdapter(db, schema);
    const results = await adapter
      .model("users")
      .findMany({ limit: 10, offset: 3 });

    expect(results.length).toBe(2);
  });

  it("supports limit and offset together (pagination)", async () => {
    const adapter = drizzleAdapter(db, schema);
    const page1 = await adapter
      .model("users")
      .findMany({ limit: 2, offset: 0 });
    const page2 = await adapter
      .model("users")
      .findMany({ limit: 2, offset: 2 });
    const page3 = await adapter
      .model("users")
      .findMany({ limit: 2, offset: 4 });

    expect(page1.length).toBe(2);
    expect(page2.length).toBe(2);
    expect(page3.length).toBe(1);
  });

  it("supports orderBy ascending", async () => {
    const adapter = drizzleAdapter(db, schema);
    const results = await adapter
      .model("users")
      .findMany({ orderBy: { age: "asc" } });

    expect(results[0].name).toBe("Eve");
    expect(results[4].name).toBe("Charlie");
  });

  it("supports orderBy descending", async () => {
    const adapter = drizzleAdapter(db, schema);
    const results = await adapter
      .model("users")
      .findMany({ orderBy: { age: "desc" } });

    expect(results[0].name).toBe("Charlie");
    expect(results[4].name).toBe("Eve");
  });

  it("supports orderBy with limit", async () => {
    const adapter = drizzleAdapter(db, schema);
    const results = await adapter
      .model("users")
      .findMany({ orderBy: { score: "desc" }, limit: 3 });

    expect(results.length).toBe(3);
    expect(results[0].name).toBe("Alice");
    expect(results[1].name).toBe("Charlie");
    expect(results[2].name).toBe("Eve");
  });

  it("supports select to pick specific fields", async () => {
    const adapter = drizzleAdapter(db, schema);
    const results = await adapter.model("users").findMany({
      select: ["name", "age"],
      limit: 2,
    });

    expect(results.length).toBe(2);
    expect(results[0].name).toBeDefined();
    expect(results[0].age).toBeDefined();
    expect((results[0] as any).email).toBeUndefined();
    expect((results[0] as any).id).toBeUndefined();
  });

  it("supports combined where, orderBy, limit, offset, and select", async () => {
    const adapter = drizzleAdapter(db, schema);
    const results = await adapter.model("users").findMany({
      where: { age: { gte: 25 } },
      orderBy: { score: "desc" },
      limit: 2,
      offset: 1,
      select: ["name", "score"],
    });

    expect(results.length).toBe(2);
    expect(results[0].name).toBe("Charlie");
    expect(results[1].name).toBe("Diana");
    expect((results[0] as any).age).toBeUndefined();
  });

  afterAll(async () => {
    await db.sql`DROP TABLE IF EXISTS findmany_users`;
  });
});

describe.runIf(process.env.POSTGRESQL_URL)(
  "integrations: drizzleAdapter: model.findMany: postgresql",
  () => {
    const users = dPg.pgTable("findmany_pg_users", {
      id: dPg.serial("id").primaryKey(),
      name: dPg.text("name").notNull(),
      email: dPg.text("email"),
      age: dPg.integer("age"),
    });

    const schema = { users };
    let db: Database<ReturnType<typeof pgConnector>>;

    beforeAll(async () => {
      db = createDatabase(
        pgConnector({ url: process.env.POSTGRESQL_URL as string }),
      );
      await db.sql`DROP TABLE IF EXISTS findmany_pg_users`;
      await db.sql`CREATE TABLE findmany_pg_users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT, age INTEGER)`;

      const adapter = drizzleAdapter(db, schema);
      await adapter.native.insert(users).values([
        { name: "Alice", email: "alice@example.com", age: 30 },
        { name: "Bob", email: "bob@example.com", age: 25 },
        { name: "Charlie", email: "charlie@example.com", age: 35 },
      ]);
    });

    it("returns array of objects", async () => {
      const adapter = drizzleAdapter(db, schema);
      const results = await adapter.model("users").findMany();

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(3);
    });

    it("supports where operators", async () => {
      const adapter = drizzleAdapter(db, schema);
      const results = await adapter
        .model("users")
        .findMany({ where: { age: { gt: 26 } } });

      expect(results.length).toBe(2);
    });

    it("supports orderBy and limit", async () => {
      const adapter = drizzleAdapter(db, schema);
      const results = await adapter
        .model("users")
        .findMany({ orderBy: { age: "asc" }, limit: 2 });

      expect(results.length).toBe(2);
      expect(results[0].name).toBe("Bob");
      expect(results[1].name).toBe("Alice");
    });

    it("supports pagination", async () => {
      const adapter = drizzleAdapter(db, schema);
      const results = await adapter
        .model("users")
        .findMany({ orderBy: { age: "asc" }, limit: 1, offset: 1 });

      expect(results.length).toBe(1);
      expect(results[0].name).toBe("Alice");
    });

    afterAll(async () => {
      await db.sql`DROP TABLE IF EXISTS findmany_pg_users`;
    });
  },
);

describe.runIf(process.env.MYSQL_URL)(
  "integrations: drizzleAdapter: model.findMany: mysql",
  () => {
    const users = dMySql.mysqlTable("findmany_mysql_users", {
      id: dMySql.int("id").primaryKey().autoincrement(),
      name: dMySql.text("name").notNull(),
      email: dMySql.text("email"),
      age: dMySql.int("age"),
    });

    const schema = { users };
    let db: Database<ReturnType<typeof mysqlConnector>>;

    beforeAll(async () => {
      db = createDatabase(
        mysqlConnector({ uri: process.env.MYSQL_URL as string }),
      );
      await db.sql`DROP TABLE IF EXISTS findmany_mysql_users`;
      await db.sql`CREATE TABLE findmany_mysql_users (id INT PRIMARY KEY AUTO_INCREMENT, name TEXT NOT NULL, email TEXT, age INT)`;

      const adapter = drizzleAdapter(db, schema);
      await adapter.native.insert(users).values([
        { name: "Alice", email: "alice@example.com", age: 30 },
        { name: "Bob", email: "bob@example.com", age: 25 },
        { name: "Charlie", email: "charlie@example.com", age: 35 },
      ]);
    });

    it("returns array of objects", async () => {
      const adapter = drizzleAdapter(db, schema);
      const results = await adapter.model("users").findMany();

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(3);
    });

    it("supports where operators", async () => {
      const adapter = drizzleAdapter(db, schema);
      const results = await adapter
        .model("users")
        .findMany({ where: { age: { lt: 30 } } });

      expect(results.length).toBe(1);
      expect(results[0].name).toBe("Bob");
    });

    it("supports orderBy and limit", async () => {
      const adapter = drizzleAdapter(db, schema);
      const results = await adapter
        .model("users")
        .findMany({ orderBy: { age: "desc" }, limit: 2 });

      expect(results.length).toBe(2);
      expect(results[0].name).toBe("Charlie");
      expect(results[1].name).toBe("Alice");
    });

    afterAll(async () => {
      await db.sql`DROP TABLE IF EXISTS findmany_mysql_users`;
    });
  },
);

// ============================================================================
// Model API: update tests
// ============================================================================

describe("integrations: drizzleAdapter: model.update: sqlite", () => {
  const users = dSqlite.sqliteTable("update_users", {
    id: dSqlite.integer("id").primaryKey({ autoIncrement: true }),
    name: dSqlite.text("name").notNull(),
    email: dSqlite.text("email"),
    age: dSqlite.integer("age"),
  });

  const schema = { users };
  let db: Database;

  beforeAll(async () => {
    db = createDatabase(sqliteConnector({}));
    await db.sql`DROP TABLE IF EXISTS update_users`;
    await db.sql`CREATE TABLE update_users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT, age INTEGER)`;

    const adapter = drizzleAdapter(db, schema);
    await adapter.native.insert(users).values([
      { name: "Alice", email: "alice@example.com", age: 30 },
      { name: "Bob", email: "bob@example.com", age: 25 },
      { name: "Charlie", email: "charlie@example.com", age: 35 },
    ]);
  });

  it("returns updated object", async () => {
    const adapter = drizzleAdapter(db, schema);
    const updated = await adapter.model("users").update({
      where: { name: "Alice" },
      data: { age: 31 },
    });

    expect(updated).not.toBeNull();
    expect(updated?.name).toBe("Alice");
    expect(updated?.age).toBe(31);
  });

  it("returns null when no match", async () => {
    const adapter = drizzleAdapter(db, schema);
    const updated = await adapter.model("users").update({
      where: { name: "NonExistent" },
      data: { age: 99 },
    });

    expect(updated).toBeNull();
  });

  it("supports same where operators as findOne", async () => {
    const adapter = drizzleAdapter(db, schema);

    const updated = await adapter.model("users").update({
      where: { age: { gt: 31 } },
      data: { email: "updated@example.com" },
    });

    expect(updated?.name).toBe("Charlie");
    expect(updated?.email).toBe("updated@example.com");
  });

  it("supports partial updates (only specified fields)", async () => {
    const adapter = drizzleAdapter(db, schema);

    const updated = await adapter.model("users").update({
      where: { name: "Bob" },
      data: { email: "bob-new@example.com" },
    });

    expect(updated?.name).toBe("Bob");
    expect(updated?.email).toBe("bob-new@example.com");
    expect(updated?.age).toBe(25);
  });

  it("supports eq operator", async () => {
    const adapter = drizzleAdapter(db, schema);
    const updated = await adapter.model("users").update({
      where: { name: { eq: "Alice" } },
      data: { age: 32 },
    });

    expect(updated?.age).toBe(32);
  });

  it("supports ne operator", async () => {
    const adapter = drizzleAdapter(db, schema);
    await adapter.model("users").update({
      where: { name: { ne: "Alice" } },
      data: { age: 50 },
    });

    const result = await adapter.model("users").findOne({ where: { age: 50 } });
    expect(result).not.toBeNull();
    expect(result?.name).not.toBe("Alice");
  });

  it("supports gte operator", async () => {
    const adapter = drizzleAdapter(db, schema);
    const updated = await adapter.model("users").update({
      where: { age: { gte: 50 } },
      data: { email: "gte-test@example.com" },
    });

    expect(updated?.email).toBe("gte-test@example.com");
  });

  it("supports lte operator", async () => {
    const adapter = drizzleAdapter(db, schema);
    const updated = await adapter.model("users").update({
      where: { age: { lte: 32 } },
      data: { email: "lte-test@example.com" },
    });

    expect(updated?.email).toBe("lte-test@example.com");
  });

  it("supports like operator", async () => {
    const adapter = drizzleAdapter(db, schema);
    const updated = await adapter.model("users").update({
      where: { name: { like: "Char%" } },
      data: { age: 36 },
    });

    expect(updated?.name).toBe("Charlie");
    expect(updated?.age).toBe(36);
  });

  it("supports in operator", async () => {
    const adapter = drizzleAdapter(db, schema);
    const updated = await adapter.model("users").update({
      where: { name: { in: ["Alice", "Bob"] } },
      data: { email: "in-test@example.com" },
    });

    expect(["Alice", "Bob"]).toContain(updated?.name);
    expect(updated?.email).toBe("in-test@example.com");
  });

  it("supports multiple where conditions", async () => {
    const adapter = drizzleAdapter(db, schema);
    const updated = await adapter.model("users").update({
      where: { name: "Alice", age: { gte: 30 } },
      data: { email: "multi-where@example.com" },
    });

    expect(updated?.name).toBe("Alice");
    expect(updated?.email).toBe("multi-where@example.com");
  });

  afterAll(async () => {
    await db.sql`DROP TABLE IF EXISTS update_users`;
  });
});

describe.runIf(process.env.POSTGRESQL_URL)(
  "integrations: drizzleAdapter: model.update: postgresql",
  () => {
    const users = dPg.pgTable("update_pg_users", {
      id: dPg.serial("id").primaryKey(),
      name: dPg.text("name").notNull(),
      email: dPg.text("email"),
      age: dPg.integer("age"),
    });

    const schema = { users };
    let db: Database<ReturnType<typeof pgConnector>>;

    beforeAll(async () => {
      db = createDatabase(
        pgConnector({ url: process.env.POSTGRESQL_URL as string }),
      );
      await db.sql`DROP TABLE IF EXISTS update_pg_users`;
      await db.sql`CREATE TABLE update_pg_users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT, age INTEGER)`;

      const adapter = drizzleAdapter(db, schema);
      await adapter.native.insert(users).values([
        { name: "Alice", email: "alice@example.com", age: 30 },
        { name: "Bob", email: "bob@example.com", age: 25 },
      ]);
    });

    it("returns updated object", async () => {
      const adapter = drizzleAdapter(db, schema);
      const updated = await adapter.model("users").update({
        where: { name: "Alice" },
        data: { age: 31 },
      });

      expect(updated).not.toBeNull();
      expect(updated?.age).toBe(31);
    });

    it("supports where operators", async () => {
      const adapter = drizzleAdapter(db, schema);
      const updated = await adapter.model("users").update({
        where: { age: { lt: 30 } },
        data: { email: "bob-updated@example.com" },
      });

      expect(updated?.name).toBe("Bob");
      expect(updated?.email).toBe("bob-updated@example.com");
    });

    afterAll(async () => {
      await db.sql`DROP TABLE IF EXISTS update_pg_users`;
    });
  },
);

describe.runIf(process.env.MYSQL_URL)(
  "integrations: drizzleAdapter: model.update: mysql",
  () => {
    const users = dMySql.mysqlTable("update_mysql_users", {
      id: dMySql.int("id").primaryKey().autoincrement(),
      name: dMySql.text("name").notNull(),
      email: dMySql.text("email"),
      age: dMySql.int("age"),
    });

    const schema = { users };
    let db: Database<ReturnType<typeof mysqlConnector>>;

    beforeAll(async () => {
      db = createDatabase(
        mysqlConnector({ uri: process.env.MYSQL_URL as string }),
      );
      await db.sql`DROP TABLE IF EXISTS update_mysql_users`;
      await db.sql`CREATE TABLE update_mysql_users (id INT PRIMARY KEY AUTO_INCREMENT, name TEXT NOT NULL, email TEXT, age INT)`;

      const adapter = drizzleAdapter(db, schema);
      await adapter.native.insert(users).values([
        { name: "Alice", email: "alice@example.com", age: 30 },
        { name: "Bob", email: "bob@example.com", age: 25 },
      ]);
    });

    it("returns updated object", async () => {
      const adapter = drizzleAdapter(db, schema);
      const updated = await adapter.model("users").update({
        where: { name: "Alice" },
        data: { age: 31 },
      });

      expect(updated).not.toBeNull();
      expect(updated?.age).toBe(31);
    });

    it("supports where operators", async () => {
      const adapter = drizzleAdapter(db, schema);
      const updated = await adapter.model("users").update({
        where: { age: { lt: 30 } },
        data: { email: "bob-updated@example.com" },
      });

      expect(updated?.name).toBe("Bob");
      expect(updated?.email).toBe("bob-updated@example.com");
    });

    afterAll(async () => {
      await db.sql`DROP TABLE IF EXISTS update_mysql_users`;
    });
  },
);

// ============================================================================
// Model API: updateMany tests
// ============================================================================

describe("integrations: drizzleAdapter: model.updateMany: sqlite", () => {
  const users = dSqlite.sqliteTable("updatemany_users", {
    id: dSqlite.integer("id").primaryKey({ autoIncrement: true }),
    name: dSqlite.text("name").notNull(),
    email: dSqlite.text("email"),
    age: dSqlite.integer("age"),
    active: dSqlite.integer("active", { mode: "boolean" }).default(true),
  });

  const schema = { users };
  let db: Database;

  beforeAll(async () => {
    db = createDatabase(sqliteConnector({}));
    await db.sql`DROP TABLE IF EXISTS updatemany_users`;
    await db.sql`CREATE TABLE updatemany_users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT, age INTEGER, active INTEGER DEFAULT 1)`;

    const adapter = drizzleAdapter(db, schema);
    await adapter.native.insert(users).values([
      { name: "Alice", email: "alice@example.com", age: 30, active: true },
      { name: "Bob", email: "bob@example.com", age: 25, active: true },
      { name: "Charlie", email: "charlie@example.com", age: 35, active: true },
      { name: "Diana", email: "diana@example.com", age: 28, active: false },
    ]);
  });

  it("returns array of updated objects", async () => {
    const adapter = drizzleAdapter(db, schema);
    const updated = await adapter.model("users").updateMany({
      where: { active: true },
      data: { email: "bulk@example.com" },
    });

    expect(Array.isArray(updated)).toBe(true);
    expect(updated.length).toBe(3);
    for (const user of updated) {
      expect(user.email).toBe("bulk@example.com");
    }
  });

  it("returns empty array when no match", async () => {
    const adapter = drizzleAdapter(db, schema);
    const updated = await adapter.model("users").updateMany({
      where: { name: "NonExistent" },
      data: { age: 99 },
    });

    expect(Array.isArray(updated)).toBe(true);
    expect(updated.length).toBe(0);
  });

  it("updates all matching records", async () => {
    const adapter = drizzleAdapter(db, schema);
    const updated = await adapter.model("users").updateMany({
      where: { age: { gte: 30 } },
      data: { active: false },
    });

    expect(updated.length).toBe(2);
    expect(updated.map((u) => u.name).sort()).toEqual(["Alice", "Charlie"]);
    for (const user of updated) {
      expect(user.active).toBeFalsy();
    }
  });

  it("supports same where operators as findOne", async () => {
    const adapter = drizzleAdapter(db, schema);

    const updated = await adapter.model("users").updateMany({
      where: { name: { like: "%a%" } },
      data: { age: 40 },
    });

    expect(updated.length).toBeGreaterThan(0);
    for (const user of updated) {
      expect(user.age).toBe(40);
    }
  });

  it("supports partial updates", async () => {
    const adapter = drizzleAdapter(db, schema);
    const updated = await adapter.model("users").updateMany({
      where: { name: { in: ["Alice", "Bob"] } },
      data: { email: "partial@example.com" },
    });

    for (const user of updated) {
      expect(user.email).toBe("partial@example.com");
      expect(user.name).toBeDefined();
      expect(user.age).toBeDefined();
    }
  });

  it("updates all records when no where clause", async () => {
    const adapter = drizzleAdapter(db, schema);
    const updated = await adapter.model("users").updateMany({
      data: { active: true },
    });

    expect(updated.length).toBe(4);
    for (const user of updated) {
      expect(user.active).toBeTruthy();
    }
  });

  afterAll(async () => {
    await db.sql`DROP TABLE IF EXISTS updatemany_users`;
  });
});

describe.runIf(process.env.POSTGRESQL_URL)(
  "integrations: drizzleAdapter: model.updateMany: postgresql",
  () => {
    const users = dPg.pgTable("updatemany_pg_users", {
      id: dPg.serial("id").primaryKey(),
      name: dPg.text("name").notNull(),
      email: dPg.text("email"),
      age: dPg.integer("age"),
    });

    const schema = { users };
    let db: Database<ReturnType<typeof pgConnector>>;

    beforeAll(async () => {
      db = createDatabase(
        pgConnector({ url: process.env.POSTGRESQL_URL as string }),
      );
      await db.sql`DROP TABLE IF EXISTS updatemany_pg_users`;
      await db.sql`CREATE TABLE updatemany_pg_users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT, age INTEGER)`;

      const adapter = drizzleAdapter(db, schema);
      await adapter.native.insert(users).values([
        { name: "Alice", email: "alice@example.com", age: 30 },
        { name: "Bob", email: "bob@example.com", age: 25 },
        { name: "Charlie", email: "charlie@example.com", age: 35 },
      ]);
    });

    it("returns array of updated objects", async () => {
      const adapter = drizzleAdapter(db, schema);
      const updated = await adapter.model("users").updateMany({
        where: { age: { gte: 30 } },
        data: { email: "bulk@example.com" },
      });

      expect(updated.length).toBe(2);
      for (const user of updated) {
        expect(user.email).toBe("bulk@example.com");
      }
    });

    it("supports batch updates", async () => {
      const adapter = drizzleAdapter(db, schema);
      const updated = await adapter.model("users").updateMany({
        data: { age: 50 },
      });

      expect(updated.length).toBe(3);
      for (const user of updated) {
        expect(user.age).toBe(50);
      }
    });

    afterAll(async () => {
      await db.sql`DROP TABLE IF EXISTS updatemany_pg_users`;
    });
  },
);

describe.runIf(process.env.MYSQL_URL)(
  "integrations: drizzleAdapter: model.updateMany: mysql",
  () => {
    const users = dMySql.mysqlTable("updatemany_mysql_users", {
      id: dMySql.int("id").primaryKey().autoincrement(),
      name: dMySql.text("name").notNull(),
      email: dMySql.text("email"),
      age: dMySql.int("age"),
    });

    const schema = { users };
    let db: Database<ReturnType<typeof mysqlConnector>>;

    beforeAll(async () => {
      db = createDatabase(
        mysqlConnector({ uri: process.env.MYSQL_URL as string }),
      );
      await db.sql`DROP TABLE IF EXISTS updatemany_mysql_users`;
      await db.sql`CREATE TABLE updatemany_mysql_users (id INT PRIMARY KEY AUTO_INCREMENT, name TEXT NOT NULL, email TEXT, age INT)`;

      const adapter = drizzleAdapter(db, schema);
      await adapter.native.insert(users).values([
        { name: "Alice", email: "alice@example.com", age: 30 },
        { name: "Bob", email: "bob@example.com", age: 25 },
        { name: "Charlie", email: "charlie@example.com", age: 35 },
      ]);
    });

    it("returns array of updated objects", async () => {
      const adapter = drizzleAdapter(db, schema);
      const updated = await adapter.model("users").updateMany({
        where: { age: { lt: 30 } },
        data: { email: "young@example.com" },
      });

      expect(updated.length).toBe(1);
      expect(updated[0].name).toBe("Bob");
      expect(updated[0].email).toBe("young@example.com");
    });

    it("supports batch updates", async () => {
      const adapter = drizzleAdapter(db, schema);
      const updated = await adapter.model("users").updateMany({
        data: { age: 40 },
      });

      expect(updated.length).toBe(3);
      for (const user of updated) {
        expect(user.age).toBe(40);
      }
    });

    afterAll(async () => {
      await db.sql`DROP TABLE IF EXISTS updatemany_mysql_users`;
    });
  },
);

// ============================================================================
// Model API: delete tests
// ============================================================================

describe("integrations: drizzleAdapter: model.delete: sqlite", () => {
  const users = dSqlite.sqliteTable("delete_users", {
    id: dSqlite.integer("id").primaryKey({ autoIncrement: true }),
    name: dSqlite.text("name").notNull(),
    email: dSqlite.text("email"),
    age: dSqlite.integer("age"),
  });

  const schema = { users };
  let db: Database;

  beforeAll(async () => {
    db = createDatabase(sqliteConnector({}));
  });

  beforeEach(async () => {
    await db.sql`DROP TABLE IF EXISTS delete_users`;
    await db.sql`CREATE TABLE delete_users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT, age INTEGER)`;

    const adapter = drizzleAdapter(db, schema);
    await adapter.native.insert(users).values([
      { name: "Alice", email: "alice@example.com", age: 30 },
      { name: "Bob", email: "bob@example.com", age: 25 },
      { name: "Charlie", email: "charlie@example.com", age: 35 },
      { name: "Diana", email: "diana@example.com", age: 28 },
    ]);
  });

  it("returns deleted object by default", async () => {
    const adapter = drizzleAdapter(db, schema);
    const deleted = await adapter
      .model("users")
      .delete({ where: { name: "Alice" } });

    expect(deleted).not.toBeNull();
    expect(deleted?.name).toBe("Alice");
    expect(deleted?.email).toBe("alice@example.com");
  });

  it("returns null when no match", async () => {
    const adapter = drizzleAdapter(db, schema);
    const deleted = await adapter
      .model("users")
      .delete({ where: { name: "NonExistent" } });

    expect(deleted).toBeNull();
  });

  it("actually removes the record from db", async () => {
    const adapter = drizzleAdapter(db, schema);
    await adapter.model("users").delete({ where: { name: "Alice" } });

    const user = await adapter
      .model("users")
      .findOne({ where: { name: "Alice" } });
    expect(user).toBeNull();
  });

  it("returns count when returning: false", async () => {
    const adapter = drizzleAdapter(db, schema);
    const count = await adapter
      .model("users")
      .delete({ where: { name: "Bob" }, returning: false });

    expect(count).toBe(1);
  });

  it("returns 0 count when no match with returning: false", async () => {
    const adapter = drizzleAdapter(db, schema);
    const count = await adapter
      .model("users")
      .delete({ where: { name: "NonExistent" }, returning: false });

    expect(count).toBe(0);
  });

  it("supports eq operator", async () => {
    const adapter = drizzleAdapter(db, schema);
    const deleted = await adapter
      .model("users")
      .delete({ where: { name: { eq: "Charlie" } } });

    expect(deleted?.name).toBe("Charlie");
  });

  it("supports ne operator", async () => {
    const adapter = drizzleAdapter(db, schema);
    const deleted = await adapter
      .model("users")
      .delete({ where: { name: { ne: "Alice" } } });

    expect(deleted?.name).not.toBe("Alice");
  });

  it("supports gt operator", async () => {
    const adapter = drizzleAdapter(db, schema);
    const deleted = await adapter
      .model("users")
      .delete({ where: { age: { gt: 30 } } });

    expect(deleted?.name).toBe("Charlie");
  });

  it("supports gte operator", async () => {
    const adapter = drizzleAdapter(db, schema);
    const deleted = await adapter
      .model("users")
      .delete({ where: { age: { gte: 35 } } });

    expect(deleted?.name).toBe("Charlie");
  });

  it("supports lt operator", async () => {
    const adapter = drizzleAdapter(db, schema);
    const deleted = await adapter
      .model("users")
      .delete({ where: { age: { lt: 28 } } });

    expect(deleted?.name).toBe("Bob");
  });

  it("supports lte operator", async () => {
    const adapter = drizzleAdapter(db, schema);
    const deleted = await adapter
      .model("users")
      .delete({ where: { age: { lte: 25 } } });

    expect(deleted?.name).toBe("Bob");
  });

  it("supports like operator", async () => {
    const adapter = drizzleAdapter(db, schema);
    const deleted = await adapter
      .model("users")
      .delete({ where: { name: { like: "Char%" } } });

    expect(deleted?.name).toBe("Charlie");
  });

  it("supports in operator", async () => {
    const adapter = drizzleAdapter(db, schema);
    const deleted = await adapter
      .model("users")
      .delete({ where: { name: { in: ["Bob", "Diana"] } } });

    expect(["Bob", "Diana"]).toContain(deleted?.name);
  });

  it("supports multiple where conditions (AND)", async () => {
    const adapter = drizzleAdapter(db, schema);
    const deleted = await adapter
      .model("users")
      .delete({ where: { age: { gte: 28 }, name: { like: "D%" } } });

    expect(deleted?.name).toBe("Diana");
  });

  it("throws error when where clause is empty", async () => {
    const adapter = drizzleAdapter(db, schema);

    await expect(adapter.model("users").delete({ where: {} })).rejects.toThrow(
      "delete() requires a where clause",
    );
  });

  afterAll(async () => {
    await db.sql`DROP TABLE IF EXISTS delete_users`;
  });
});

describe.runIf(process.env.POSTGRESQL_URL)(
  "integrations: drizzleAdapter: model.delete: postgresql",
  () => {
    const users = dPg.pgTable("delete_pg_users", {
      id: dPg.serial("id").primaryKey(),
      name: dPg.text("name").notNull(),
      email: dPg.text("email"),
      age: dPg.integer("age"),
    });

    const schema = { users };
    let db: Database<ReturnType<typeof pgConnector>>;

    beforeAll(async () => {
      db = createDatabase(
        pgConnector({ url: process.env.POSTGRESQL_URL as string }),
      );
    });

    beforeEach(async () => {
      await db.sql`DROP TABLE IF EXISTS delete_pg_users`;
      await db.sql`CREATE TABLE delete_pg_users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT, age INTEGER)`;

      const adapter = drizzleAdapter(db, schema);
      await adapter.native.insert(users).values([
        { name: "Alice", email: "alice@example.com", age: 30 },
        { name: "Bob", email: "bob@example.com", age: 25 },
      ]);
    });

    it("returns deleted object", async () => {
      const adapter = drizzleAdapter(db, schema);
      const deleted = await adapter
        .model("users")
        .delete({ where: { name: "Alice" } });

      expect(deleted).not.toBeNull();
      expect(deleted?.name).toBe("Alice");
    });

    it("supports where operators", async () => {
      const adapter = drizzleAdapter(db, schema);
      const deleted = await adapter
        .model("users")
        .delete({ where: { age: { lt: 30 } } });

      expect(deleted?.name).toBe("Bob");
    });

    it("returns count when returning: false", async () => {
      const adapter = drizzleAdapter(db, schema);
      const count = await adapter
        .model("users")
        .delete({ where: { name: "Alice" }, returning: false });

      expect(count).toBe(1);
    });

    afterAll(async () => {
      await db.sql`DROP TABLE IF EXISTS delete_pg_users`;
    });
  },
);

describe.runIf(process.env.MYSQL_URL)(
  "integrations: drizzleAdapter: model.delete: mysql",
  () => {
    const users = dMySql.mysqlTable("delete_mysql_users", {
      id: dMySql.int("id").primaryKey().autoincrement(),
      name: dMySql.text("name").notNull(),
      email: dMySql.text("email"),
      age: dMySql.int("age"),
    });

    const schema = { users };
    let db: Database<ReturnType<typeof mysqlConnector>>;

    beforeAll(async () => {
      db = createDatabase(
        mysqlConnector({ uri: process.env.MYSQL_URL as string }),
      );
    });

    beforeEach(async () => {
      await db.sql`DROP TABLE IF EXISTS delete_mysql_users`;
      await db.sql`CREATE TABLE delete_mysql_users (id INT PRIMARY KEY AUTO_INCREMENT, name TEXT NOT NULL, email TEXT, age INT)`;

      const adapter = drizzleAdapter(db, schema);
      await adapter.native.insert(users).values([
        { name: "Alice", email: "alice@example.com", age: 30 },
        { name: "Bob", email: "bob@example.com", age: 25 },
      ]);
    });

    it("returns deleted object", async () => {
      const adapter = drizzleAdapter(db, schema);
      const deleted = await adapter
        .model("users")
        .delete({ where: { name: "Alice" } });

      expect(deleted).not.toBeNull();
      expect(deleted?.name).toBe("Alice");
    });

    it("supports where operators", async () => {
      const adapter = drizzleAdapter(db, schema);
      const deleted = await adapter
        .model("users")
        .delete({ where: { age: { gt: 26 } } });

      expect(deleted?.name).toBe("Alice");
    });

    it("returns count when returning: false", async () => {
      const adapter = drizzleAdapter(db, schema);
      const count = await adapter
        .model("users")
        .delete({ where: { name: "Bob" }, returning: false });

      expect(count).toBe(1);
    });

    afterAll(async () => {
      await db.sql`DROP TABLE IF EXISTS delete_mysql_users`;
    });
  },
);

// ============================================================================
// Model API: deleteMany tests
// ============================================================================

describe("integrations: drizzleAdapter: model.deleteMany: sqlite", () => {
  const users = dSqlite.sqliteTable("deletemany_users", {
    id: dSqlite.integer("id").primaryKey({ autoIncrement: true }),
    name: dSqlite.text("name").notNull(),
    email: dSqlite.text("email"),
    age: dSqlite.integer("age"),
    active: dSqlite.integer("active", { mode: "boolean" }).default(true),
  });

  const schema = { users };
  let db: Database;

  beforeAll(async () => {
    db = createDatabase(sqliteConnector({}));
  });

  beforeEach(async () => {
    await db.sql`DROP TABLE IF EXISTS deletemany_users`;
    await db.sql`CREATE TABLE deletemany_users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT, age INTEGER, active INTEGER DEFAULT 1)`;

    const adapter = drizzleAdapter(db, schema);
    await adapter.native.insert(users).values([
      { name: "Alice", email: "alice@example.com", age: 30, active: true },
      { name: "Bob", email: "bob@example.com", age: 25, active: true },
      { name: "Charlie", email: "charlie@example.com", age: 35, active: true },
      { name: "Diana", email: "diana@example.com", age: 28, active: false },
    ]);
  });

  it("returns array of deleted objects by default", async () => {
    const adapter = drizzleAdapter(db, schema);
    const deleted = await adapter
      .model("users")
      .deleteMany({ where: { active: true } });

    expect(Array.isArray(deleted)).toBe(true);
    expect(deleted.length).toBe(3);
    for (const user of deleted) {
      expect(user.active).toBeTruthy();
    }
  });

  it("returns empty array when no match", async () => {
    const adapter = drizzleAdapter(db, schema);
    const deleted = await adapter
      .model("users")
      .deleteMany({ where: { name: "NonExistent" } });

    expect(Array.isArray(deleted)).toBe(true);
    expect(deleted.length).toBe(0);
  });

  it("actually removes records from db", async () => {
    const adapter = drizzleAdapter(db, schema);
    await adapter.model("users").deleteMany({ where: { active: true } });

    const remaining = await adapter.model("users").findMany();
    expect(remaining.length).toBe(1);
    expect(remaining[0].name).toBe("Diana");
  });

  it("returns count when returning: false", async () => {
    const adapter = drizzleAdapter(db, schema);
    const count = await adapter
      .model("users")
      .deleteMany({ where: { age: { gte: 30 } }, returning: false });

    expect(count).toBe(2);
  });

  it("returns 0 count when no match with returning: false", async () => {
    const adapter = drizzleAdapter(db, schema);
    const count = await adapter
      .model("users")
      .deleteMany({ where: { name: "NonExistent" }, returning: false });

    expect(count).toBe(0);
  });

  it("deletes all matching records", async () => {
    const adapter = drizzleAdapter(db, schema);
    const deleted = await adapter
      .model("users")
      .deleteMany({ where: { age: { gte: 28 } } });

    expect(deleted.length).toBe(3);
    expect(deleted.map((u) => u.name).sort()).toEqual([
      "Alice",
      "Charlie",
      "Diana",
    ]);
  });

  it("supports same where operators as findOne", async () => {
    const adapter = drizzleAdapter(db, schema);

    const deleted = await adapter
      .model("users")
      .deleteMany({ where: { name: { like: "%a%" } } });

    expect(deleted.length).toBeGreaterThan(0);
    for (const user of deleted) {
      expect(user.name.toLowerCase()).toContain("a");
    }
  });

  it("supports in operator", async () => {
    const adapter = drizzleAdapter(db, schema);
    const deleted = await adapter
      .model("users")
      .deleteMany({ where: { name: { in: ["Alice", "Bob"] } } });

    expect(deleted.length).toBe(2);
    expect(deleted.map((u) => u.name).sort()).toEqual(["Alice", "Bob"]);
  });

  it("supports multiple where conditions", async () => {
    const adapter = drizzleAdapter(db, schema);
    const deleted = await adapter
      .model("users")
      .deleteMany({ where: { active: true, age: { lt: 30 } } });

    expect(deleted.length).toBe(1);
    expect(deleted[0].name).toBe("Bob");
  });

  it("throws error when where clause is empty", async () => {
    const adapter = drizzleAdapter(db, schema);

    await expect(
      adapter.model("users").deleteMany({ where: {} }),
    ).rejects.toThrow("deleteMany() requires a where clause");
  });

  afterAll(async () => {
    await db.sql`DROP TABLE IF EXISTS deletemany_users`;
  });
});

describe.runIf(process.env.POSTGRESQL_URL)(
  "integrations: drizzleAdapter: model.deleteMany: postgresql",
  () => {
    const users = dPg.pgTable("deletemany_pg_users", {
      id: dPg.serial("id").primaryKey(),
      name: dPg.text("name").notNull(),
      email: dPg.text("email"),
      age: dPg.integer("age"),
    });

    const schema = { users };
    let db: Database<ReturnType<typeof pgConnector>>;

    beforeAll(async () => {
      db = createDatabase(
        pgConnector({ url: process.env.POSTGRESQL_URL as string }),
      );
    });

    beforeEach(async () => {
      await db.sql`DROP TABLE IF EXISTS deletemany_pg_users`;
      await db.sql`CREATE TABLE deletemany_pg_users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT, age INTEGER)`;

      const adapter = drizzleAdapter(db, schema);
      await adapter.native.insert(users).values([
        { name: "Alice", email: "alice@example.com", age: 30 },
        { name: "Bob", email: "bob@example.com", age: 25 },
        { name: "Charlie", email: "charlie@example.com", age: 35 },
      ]);
    });

    it("returns array of deleted objects", async () => {
      const adapter = drizzleAdapter(db, schema);
      const deleted = await adapter
        .model("users")
        .deleteMany({ where: { age: { gte: 30 } } });

      expect(deleted.length).toBe(2);
      for (const user of deleted) {
        expect(user.age).toBeGreaterThanOrEqual(30);
      }
    });

    it("returns count when returning: false", async () => {
      const adapter = drizzleAdapter(db, schema);
      const count = await adapter
        .model("users")
        .deleteMany({ where: { age: { lt: 30 } }, returning: false });

      expect(count).toBe(1);
    });

    afterAll(async () => {
      await db.sql`DROP TABLE IF EXISTS deletemany_pg_users`;
    });
  },
);

describe.runIf(process.env.MYSQL_URL)(
  "integrations: drizzleAdapter: model.deleteMany: mysql",
  () => {
    const users = dMySql.mysqlTable("deletemany_mysql_users", {
      id: dMySql.int("id").primaryKey().autoincrement(),
      name: dMySql.text("name").notNull(),
      email: dMySql.text("email"),
      age: dMySql.int("age"),
    });

    const schema = { users };
    let db: Database<ReturnType<typeof mysqlConnector>>;

    beforeAll(async () => {
      db = createDatabase(
        mysqlConnector({ uri: process.env.MYSQL_URL as string }),
      );
    });

    beforeEach(async () => {
      await db.sql`DROP TABLE IF EXISTS deletemany_mysql_users`;
      await db.sql`CREATE TABLE deletemany_mysql_users (id INT PRIMARY KEY AUTO_INCREMENT, name TEXT NOT NULL, email TEXT, age INT)`;

      const adapter = drizzleAdapter(db, schema);
      await adapter.native.insert(users).values([
        { name: "Alice", email: "alice@example.com", age: 30 },
        { name: "Bob", email: "bob@example.com", age: 25 },
        { name: "Charlie", email: "charlie@example.com", age: 35 },
      ]);
    });

    it("returns array of deleted objects", async () => {
      const adapter = drizzleAdapter(db, schema);
      const deleted = await adapter
        .model("users")
        .deleteMany({ where: { age: { lt: 35 } } });

      expect(deleted.length).toBe(2);
    });

    it("returns count when returning: false", async () => {
      const adapter = drizzleAdapter(db, schema);
      const count = await adapter
        .model("users")
        .deleteMany({ where: { age: { gte: 25 } }, returning: false });

      expect(count).toBe(3);
    });

    afterAll(async () => {
      await db.sql`DROP TABLE IF EXISTS deletemany_mysql_users`;
    });
  },
);

// ============================================================================
// Model API: create tests
// ============================================================================

describe("integrations: drizzleAdapter: model.create: sqlite", () => {
  const users = dSqlite.sqliteTable("create_users", {
    id: dSqlite.integer("id").primaryKey({ autoIncrement: true }),
    name: dSqlite.text("name").notNull(),
    email: dSqlite.text("email"),
    age: dSqlite.integer("age"),
  });

  const schema = { users };
  let db: Database;

  beforeAll(async () => {
    db = createDatabase(sqliteConnector({}));
  });

  beforeEach(async () => {
    await db.sql`DROP TABLE IF EXISTS create_users`;
    await db.sql`CREATE TABLE create_users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT, age INTEGER)`;
  });

  it("returns created object with generated ID", async () => {
    const adapter = drizzleAdapter(db, schema);
    const created = await adapter.model("users").create({
      data: { name: "Alice", email: "alice@example.com", age: 30 },
    });

    expect(created).not.toBeNull();
    expect(created.id).toBeDefined();
    expect(created.id).toBeGreaterThan(0);
    expect(created.name).toBe("Alice");
    expect(created.email).toBe("alice@example.com");
    expect(created.age).toBe(30);
  });

  it("auto-increments ID for sequential inserts", async () => {
    const adapter = drizzleAdapter(db, schema);

    const first = await adapter.model("users").create({
      data: { name: "Alice" },
    });
    const second = await adapter.model("users").create({
      data: { name: "Bob" },
    });

    expect(second.id).toBeGreaterThan(first.id);
  });

  it("inserts with null optional fields", async () => {
    const adapter = drizzleAdapter(db, schema);
    const created = await adapter.model("users").create({
      data: { name: "Alice" },
    });

    expect(created.name).toBe("Alice");
    expect(created.email).toBeNull();
    expect(created.age).toBeNull();
  });

  it("actually persists record in db", async () => {
    const adapter = drizzleAdapter(db, schema);
    const created = await adapter.model("users").create({
      data: { name: "Alice", email: "alice@example.com" },
    });

    const found = await adapter
      .model("users")
      .findOne({ where: { id: created.id } });
    expect(found).not.toBeNull();
    expect(found?.name).toBe("Alice");
  });

  afterAll(async () => {
    await db.sql`DROP TABLE IF EXISTS create_users`;
  });
});

describe.runIf(process.env.POSTGRESQL_URL)(
  "integrations: drizzleAdapter: model.create: postgresql",
  () => {
    const users = dPg.pgTable("create_pg_users", {
      id: dPg.serial("id").primaryKey(),
      name: dPg.text("name").notNull(),
      email: dPg.text("email"),
      age: dPg.integer("age"),
    });

    const schema = { users };
    let db: Database<ReturnType<typeof pgConnector>>;

    beforeAll(async () => {
      db = createDatabase(
        pgConnector({ url: process.env.POSTGRESQL_URL as string }),
      );
    });

    beforeEach(async () => {
      await db.sql`DROP TABLE IF EXISTS create_pg_users`;
      await db.sql`CREATE TABLE create_pg_users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT, age INTEGER)`;
    });

    it("returns created object with generated ID", async () => {
      const adapter = drizzleAdapter(db, schema);
      const created = await adapter.model("users").create({
        data: { name: "Alice", email: "alice@example.com", age: 30 },
      });

      expect(created.id).toBeDefined();
      expect(created.name).toBe("Alice");
    });

    it("auto-increments ID", async () => {
      const adapter = drizzleAdapter(db, schema);

      const first = await adapter
        .model("users")
        .create({ data: { name: "Alice" } });
      const second = await adapter
        .model("users")
        .create({ data: { name: "Bob" } });

      expect(second.id).toBeGreaterThan(first.id);
    });

    afterAll(async () => {
      await db.sql`DROP TABLE IF EXISTS create_pg_users`;
    });
  },
);

describe.runIf(process.env.MYSQL_URL)(
  "integrations: drizzleAdapter: model.create: mysql",
  () => {
    const users = dMySql.mysqlTable("create_mysql_users", {
      id: dMySql.int("id").primaryKey().autoincrement(),
      name: dMySql.text("name").notNull(),
      email: dMySql.text("email"),
      age: dMySql.int("age"),
    });

    const schema = { users };
    let db: Database<ReturnType<typeof mysqlConnector>>;

    beforeAll(async () => {
      db = createDatabase(
        mysqlConnector({ uri: process.env.MYSQL_URL as string }),
      );
    });

    beforeEach(async () => {
      await db.sql`DROP TABLE IF EXISTS create_mysql_users`;
      await db.sql`CREATE TABLE create_mysql_users (id INT PRIMARY KEY AUTO_INCREMENT, name TEXT NOT NULL, email TEXT, age INT)`;
    });

    it("returns created object with generated ID", async () => {
      const adapter = drizzleAdapter(db, schema);
      const created = await adapter.model("users").create({
        data: { name: "Alice", email: "alice@example.com", age: 30 },
      });

      expect(created.id).toBeDefined();
      expect(created.name).toBe("Alice");
    });

    it("auto-increments ID", async () => {
      const adapter = drizzleAdapter(db, schema);

      const first = await adapter
        .model("users")
        .create({ data: { name: "Alice" } });
      const second = await adapter
        .model("users")
        .create({ data: { name: "Bob" } });

      expect(second.id).toBeGreaterThan(first.id);
    });

    afterAll(async () => {
      await db.sql`DROP TABLE IF EXISTS create_mysql_users`;
    });
  },
);

// ============================================================================
// Model API: createMany tests
// ============================================================================

describe("integrations: drizzleAdapter: model.createMany: sqlite", () => {
  const users = dSqlite.sqliteTable("createmany_users", {
    id: dSqlite.integer("id").primaryKey({ autoIncrement: true }),
    name: dSqlite.text("name").notNull(),
    email: dSqlite.text("email"),
    age: dSqlite.integer("age"),
  });

  const schema = { users };
  let db: Database;

  beforeAll(async () => {
    db = createDatabase(sqliteConnector({}));
  });

  beforeEach(async () => {
    await db.sql`DROP TABLE IF EXISTS createmany_users`;
    await db.sql`CREATE TABLE createmany_users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT, age INTEGER)`;
  });

  it("returns array of created objects", async () => {
    const adapter = drizzleAdapter(db, schema);
    const created = await adapter.model("users").createMany({
      data: [
        { name: "Alice", email: "alice@example.com", age: 30 },
        { name: "Bob", email: "bob@example.com", age: 25 },
        { name: "Charlie", email: "charlie@example.com", age: 35 },
      ],
    });

    expect(Array.isArray(created)).toBe(true);
    expect(created.length).toBe(3);
    expect(created[0].name).toBe("Alice");
    expect(created[1].name).toBe("Bob");
    expect(created[2].name).toBe("Charlie");
  });

  it("all returned objects have generated IDs", async () => {
    const adapter = drizzleAdapter(db, schema);
    const created = await adapter.model("users").createMany({
      data: [{ name: "Alice" }, { name: "Bob" }],
    });

    for (const user of created) {
      expect(user.id).toBeDefined();
      expect(user.id).toBeGreaterThan(0);
    }
    expect(created[1].id).toBeGreaterThan(created[0].id);
  });

  it("returns empty array for empty input", async () => {
    const adapter = drizzleAdapter(db, schema);
    const created = await adapter.model("users").createMany({
      data: [],
    });

    expect(Array.isArray(created)).toBe(true);
    expect(created.length).toBe(0);
  });

  it("actually persists all records in db", async () => {
    const adapter = drizzleAdapter(db, schema);
    await adapter.model("users").createMany({
      data: [{ name: "Alice" }, { name: "Bob" }, { name: "Charlie" }],
    });

    const all = await adapter.model("users").findMany();
    expect(all.length).toBe(3);
  });

  it("handles mixed null and non-null optional fields", async () => {
    const adapter = drizzleAdapter(db, schema);
    const created = await adapter.model("users").createMany({
      data: [
        { name: "Alice", email: "alice@example.com", age: 30 },
        { name: "Bob", age: 25 },
        { name: "Charlie", email: "charlie@example.com" },
      ],
    });

    expect(created[0].email).toBe("alice@example.com");
    expect(created[0].age).toBe(30);
    expect(created[1].email).toBeNull();
    expect(created[1].age).toBe(25);
    expect(created[2].email).toBe("charlie@example.com");
    expect(created[2].age).toBeNull();
  });

  afterAll(async () => {
    await db.sql`DROP TABLE IF EXISTS createmany_users`;
  });
});

describe.runIf(process.env.POSTGRESQL_URL)(
  "integrations: drizzleAdapter: model.createMany: postgresql",
  () => {
    const users = dPg.pgTable("createmany_pg_users", {
      id: dPg.serial("id").primaryKey(),
      name: dPg.text("name").notNull(),
      email: dPg.text("email"),
      age: dPg.integer("age"),
    });

    const schema = { users };
    let db: Database<ReturnType<typeof pgConnector>>;

    beforeAll(async () => {
      db = createDatabase(
        pgConnector({ url: process.env.POSTGRESQL_URL as string }),
      );
    });

    beforeEach(async () => {
      await db.sql`DROP TABLE IF EXISTS createmany_pg_users`;
      await db.sql`CREATE TABLE createmany_pg_users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT, age INTEGER)`;
    });

    it("returns array of created objects", async () => {
      const adapter = drizzleAdapter(db, schema);
      const created = await adapter.model("users").createMany({
        data: [
          { name: "Alice", age: 30 },
          { name: "Bob", age: 25 },
        ],
      });

      expect(created.length).toBe(2);
      expect(created[0].name).toBe("Alice");
      expect(created[1].name).toBe("Bob");
    });

    it("all objects have generated IDs", async () => {
      const adapter = drizzleAdapter(db, schema);
      const created = await adapter.model("users").createMany({
        data: [{ name: "Alice" }, { name: "Bob" }],
      });

      for (const user of created) {
        expect(user.id).toBeDefined();
      }
    });

    afterAll(async () => {
      await db.sql`DROP TABLE IF EXISTS createmany_pg_users`;
    });
  },
);

describe.runIf(process.env.MYSQL_URL)(
  "integrations: drizzleAdapter: model.createMany: mysql",
  () => {
    const users = dMySql.mysqlTable("createmany_mysql_users", {
      id: dMySql.int("id").primaryKey().autoincrement(),
      name: dMySql.text("name").notNull(),
      email: dMySql.text("email"),
      age: dMySql.int("age"),
    });

    const schema = { users };
    let db: Database<ReturnType<typeof mysqlConnector>>;

    beforeAll(async () => {
      db = createDatabase(
        mysqlConnector({ uri: process.env.MYSQL_URL as string }),
      );
    });

    beforeEach(async () => {
      await db.sql`DROP TABLE IF EXISTS createmany_mysql_users`;
      await db.sql`CREATE TABLE createmany_mysql_users (id INT PRIMARY KEY AUTO_INCREMENT, name TEXT NOT NULL, email TEXT, age INT)`;
    });

    it("returns array of created objects", async () => {
      const adapter = drizzleAdapter(db, schema);
      const created = await adapter.model("users").createMany({
        data: [
          { name: "Alice", age: 30 },
          { name: "Bob", age: 25 },
        ],
      });

      expect(created.length).toBe(2);
      expect(created[0].name).toBe("Alice");
      expect(created[1].name).toBe("Bob");
    });

    it("all objects have generated IDs", async () => {
      const adapter = drizzleAdapter(db, schema);
      const created = await adapter.model("users").createMany({
        data: [{ name: "Alice" }, { name: "Bob" }],
      });

      for (const user of created) {
        expect(user.id).toBeDefined();
      }
    });

    afterAll(async () => {
      await db.sql`DROP TABLE IF EXISTS createmany_mysql_users`;
    });
  },
);

// ============================================================================
// Model API: count tests
// ============================================================================

describe("integrations: drizzleAdapter: model.count: sqlite", () => {
  const users = dSqlite.sqliteTable("count_users", {
    id: dSqlite.integer("id").primaryKey({ autoIncrement: true }),
    name: dSqlite.text("name").notNull(),
    email: dSqlite.text("email"),
    age: dSqlite.integer("age"),
    active: dSqlite.integer("active", { mode: "boolean" }).default(true),
  });

  const schema = { users };
  let db: Database;

  beforeAll(async () => {
    db = createDatabase(sqliteConnector({}));
    await db.sql`DROP TABLE IF EXISTS count_users`;
    await db.sql`CREATE TABLE count_users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT, age INTEGER, active INTEGER DEFAULT 1)`;

    const adapter = drizzleAdapter(db, schema);
    await adapter.native.insert(users).values([
      { name: "Alice", email: "alice@example.com", age: 30, active: true },
      { name: "Bob", email: "bob@example.com", age: 25, active: true },
      { name: "Charlie", email: "charlie@example.com", age: 35, active: true },
      { name: "Diana", email: "diana@example.com", age: 28, active: false },
    ]);
  });

  it("returns number", async () => {
    const adapter = drizzleAdapter(db, schema);
    const result = await adapter.model("users").count();

    expect(typeof result).toBe("number");
    expect(result).toBe(4);
  });

  it("returns 0 for empty result set", async () => {
    const adapter = drizzleAdapter(db, schema);
    const result = await adapter
      .model("users")
      .count({ where: { name: "NonExistent" } });

    expect(result).toBe(0);
  });

  it("supports equality operator (implicit)", async () => {
    const adapter = drizzleAdapter(db, schema);
    const result = await adapter.model("users").count({ where: { age: 30 } });

    expect(result).toBe(1);
  });

  it("supports eq operator (explicit)", async () => {
    const adapter = drizzleAdapter(db, schema);
    const result = await adapter
      .model("users")
      .count({ where: { age: { eq: 25 } } });

    expect(result).toBe(1);
  });

  it("supports ne operator", async () => {
    const adapter = drizzleAdapter(db, schema);
    const result = await adapter
      .model("users")
      .count({ where: { name: { ne: "Alice" } } });

    expect(result).toBe(3);
  });

  it("supports gt operator", async () => {
    const adapter = drizzleAdapter(db, schema);
    const result = await adapter
      .model("users")
      .count({ where: { age: { gt: 28 } } });

    expect(result).toBe(2);
  });

  it("supports gte operator", async () => {
    const adapter = drizzleAdapter(db, schema);
    const result = await adapter
      .model("users")
      .count({ where: { age: { gte: 28 } } });

    expect(result).toBe(3);
  });

  it("supports lt operator", async () => {
    const adapter = drizzleAdapter(db, schema);
    const result = await adapter
      .model("users")
      .count({ where: { age: { lt: 28 } } });

    expect(result).toBe(1);
  });

  it("supports lte operator", async () => {
    const adapter = drizzleAdapter(db, schema);
    const result = await adapter
      .model("users")
      .count({ where: { age: { lte: 28 } } });

    expect(result).toBe(2);
  });

  it("supports like operator", async () => {
    const adapter = drizzleAdapter(db, schema);
    const result = await adapter
      .model("users")
      .count({ where: { email: { like: "%@example.com" } } });

    expect(result).toBe(4);
  });

  it("supports in operator", async () => {
    const adapter = drizzleAdapter(db, schema);
    const result = await adapter
      .model("users")
      .count({ where: { name: { in: ["Alice", "Bob", "NonExistent"] } } });

    expect(result).toBe(2);
  });

  it("supports multiple where conditions (AND)", async () => {
    const adapter = drizzleAdapter(db, schema);
    const result = await adapter
      .model("users")
      .count({ where: { age: { gte: 28 }, active: true } });

    expect(result).toBe(2);
  });

  it("counts with boolean where", async () => {
    const adapter = drizzleAdapter(db, schema);
    const activeCount = await adapter
      .model("users")
      .count({ where: { active: true } });
    const inactiveCount = await adapter
      .model("users")
      .count({ where: { active: false } });

    expect(activeCount).toBe(3);
    expect(inactiveCount).toBe(1);
  });

  afterAll(async () => {
    await db.sql`DROP TABLE IF EXISTS count_users`;
  });
});

describe.runIf(process.env.POSTGRESQL_URL)(
  "integrations: drizzleAdapter: model.count: postgresql",
  () => {
    const users = dPg.pgTable("count_pg_users", {
      id: dPg.serial("id").primaryKey(),
      name: dPg.text("name").notNull(),
      email: dPg.text("email"),
      age: dPg.integer("age"),
    });

    const schema = { users };
    let db: Database<ReturnType<typeof pgConnector>>;

    beforeAll(async () => {
      db = createDatabase(
        pgConnector({ url: process.env.POSTGRESQL_URL as string }),
      );
      await db.sql`DROP TABLE IF EXISTS count_pg_users`;
      await db.sql`CREATE TABLE count_pg_users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT, age INTEGER)`;

      const adapter = drizzleAdapter(db, schema);
      await adapter.native.insert(users).values([
        { name: "Alice", email: "alice@example.com", age: 30 },
        { name: "Bob", email: "bob@example.com", age: 25 },
        { name: "Charlie", email: "charlie@example.com", age: 35 },
      ]);
    });

    it("returns number", async () => {
      const adapter = drizzleAdapter(db, schema);
      const result = await adapter.model("users").count();

      expect(typeof result).toBe("number");
      expect(result).toBe(3);
    });

    it("supports where operators", async () => {
      const adapter = drizzleAdapter(db, schema);
      const result = await adapter
        .model("users")
        .count({ where: { age: { gt: 26 } } });

      expect(result).toBe(2);
    });

    it("returns 0 when no matches", async () => {
      const adapter = drizzleAdapter(db, schema);
      const result = await adapter
        .model("users")
        .count({ where: { age: { gt: 100 } } });

      expect(result).toBe(0);
    });

    afterAll(async () => {
      await db.sql`DROP TABLE IF EXISTS count_pg_users`;
    });
  },
);

describe.runIf(process.env.MYSQL_URL)(
  "integrations: drizzleAdapter: model.count: mysql",
  () => {
    const users = dMySql.mysqlTable("count_mysql_users", {
      id: dMySql.int("id").primaryKey().autoincrement(),
      name: dMySql.text("name").notNull(),
      email: dMySql.text("email"),
      age: dMySql.int("age"),
    });

    const schema = { users };
    let db: Database<ReturnType<typeof mysqlConnector>>;

    beforeAll(async () => {
      db = createDatabase(
        mysqlConnector({ uri: process.env.MYSQL_URL as string }),
      );
      await db.sql`DROP TABLE IF EXISTS count_mysql_users`;
      await db.sql`CREATE TABLE count_mysql_users (id INT PRIMARY KEY AUTO_INCREMENT, name TEXT NOT NULL, email TEXT, age INT)`;

      const adapter = drizzleAdapter(db, schema);
      await adapter.native.insert(users).values([
        { name: "Alice", email: "alice@example.com", age: 30 },
        { name: "Bob", email: "bob@example.com", age: 25 },
        { name: "Charlie", email: "charlie@example.com", age: 35 },
      ]);
    });

    it("returns number", async () => {
      const adapter = drizzleAdapter(db, schema);
      const result = await adapter.model("users").count();

      expect(typeof result).toBe("number");
      expect(result).toBe(3);
    });

    it("supports where operators", async () => {
      const adapter = drizzleAdapter(db, schema);
      const result = await adapter
        .model("users")
        .count({ where: { age: { lt: 30 } } });

      expect(result).toBe(1);
    });

    it("returns 0 when no matches", async () => {
      const adapter = drizzleAdapter(db, schema);
      const result = await adapter
        .model("users")
        .count({ where: { name: "NonExistent" } });

      expect(result).toBe(0);
    });

    afterAll(async () => {
      await db.sql`DROP TABLE IF EXISTS count_mysql_users`;
    });
  },
);

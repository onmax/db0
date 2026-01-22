import {
  describe,
  expect,
  it,
  vi,
  beforeEach,
  beforeAll,
  afterAll,
} from "vitest";
import {
  kyselyAdapter,
  type KyselyInstance,
  type KyselyAdapterResult,
  type Generated,
} from "../../src/integrations/kysely";

// Define a test database schema using Kysely's type system
interface UserTable {
  id: Generated<number>;
  name: string;
  email: string | null;
  age: number | null;
}

interface PostTable {
  id: Generated<number>;
  title: string;
  content: string;
  userId: number;
}

interface TestDatabase {
  user: UserTable;
  post: PostTable;
}

// Mock Kysely instance factory
function createMockKyselyInstance(): KyselyInstance<TestDatabase> {
  const users: Array<{
    id: number;
    name: string;
    email: string | null;
    age: number | null;
  }> = [];
  let nextId = 1;

  const createSelectQuery = () => {
    let _selectedFields: string[] | null = null;
    const _whereConditions: Array<{ field: string; op: string; value: any }> =
      [];
    const _orderBy: Array<{ field: string; direction: string }> = [];
    let _limit: number | undefined;
    let _offset: number | undefined;

    const query = {
      select: (fieldsOrFn: string[] | ((eb: any) => any)) => {
        _selectedFields =
          typeof fieldsOrFn === "function"
            ? ("__aggregate__" as any)
            : fieldsOrFn;
        return query;
      },
      selectAll: () => {
        _selectedFields = null;
        return query;
      },
      where: (field: string, op: string, value: any) => {
        _whereConditions.push({ field, op, value });
        return query;
      },
      orderBy: (field: string, direction: string) => {
        _orderBy.push({ field, direction });
        return query;
      },
      limit: (n: number) => {
        _limit = n;
        return query;
      },
      offset: (n: number) => {
        _offset = n;
        return query;
      },
      execute: async () => {
        let result = [...users];

        for (const { field, op, value } of _whereConditions) {
          result = result.filter((u) => {
            const fieldValue = (u as any)[field];
            switch (op) {
              case "=": {
                return fieldValue === value;
              }
              case "!=": {
                return fieldValue !== value;
              }
              case ">": {
                return fieldValue > value;
              }
              case ">=": {
                return fieldValue >= value;
              }
              case "<": {
                return fieldValue < value;
              }
              case "<=": {
                return fieldValue <= value;
              }
              case "like": {
                return String(fieldValue).includes(
                  String(value).replace(/%/g, ""),
                );
              }
              case "in": {
                return (value as any[]).includes(fieldValue);
              }
              case "is": {
                return fieldValue === value;
              }
              case "is not": {
                return fieldValue !== value;
              }
              default: {
                return true;
              }
            }
          });
        }

        for (const { field, direction } of _orderBy) {
          result.sort((a, b) => {
            const av = (a as any)[field];
            const bv = (b as any)[field];
            if (direction === "asc") return av > bv ? 1 : -1;
            return av < bv ? 1 : -1;
          });
        }

        if (_offset !== undefined) result = result.slice(_offset);
        if (_limit !== undefined) result = result.slice(0, _limit);

        if (_selectedFields === ("__aggregate__" as any)) {
          // Return count result
          return [{ count: BigInt(result.length) }];
        }

        if (_selectedFields) {
          result = result.map((u) => {
            const obj: any = {};
            for (const f of _selectedFields!) {
              obj[f] = (u as any)[f];
            }
            return obj;
          });
        }

        return result;
      },
      executeTakeFirst: async () => {
        const results = await query.execute();
        return results[0];
      },
    };
    return query;
  };

  const createInsertQuery = () => {
    let _values: any[] = [];

    const query = {
      values: (data: any | any[]) => {
        _values = Array.isArray(data) ? data : [data];
        return query;
      },
      returningAll: () => query,
      execute: async () => {
        for (const v of _values) {
          const user = {
            id: nextId++,
            name: v.name,
            email: v.email ?? null,
            age: v.age ?? null,
          };
          users.push(user);
        }
        return [{ numInsertedOrUpdatedRows: BigInt(_values.length) }];
      },
      executeTakeFirstOrThrow: async () => {
        const user = {
          id: nextId++,
          ..._values[0],
          email: _values[0].email ?? null,
          age: _values[0].age ?? null,
        };
        users.push(user);
        return user;
      },
    };
    return query;
  };

  const createUpdateQuery = () => {
    let _setData: any = {};
    const _whereConditions: Array<{ field: string; op: string; value: any }> =
      [];

    const query = {
      set: (data: any) => {
        _setData = data;
        return query;
      },
      where: (field: string, op: string, value: any) => {
        _whereConditions.push({ field, op, value });
        return query;
      },
      returningAll: () => query,
      execute: async () => {
        const updated: any[] = [];
        for (let i = 0; i < users.length; i++) {
          const u = users[i];
          let matches = true;
          for (const { field, op, value } of _whereConditions) {
            const fieldValue = (u as any)[field];
            if (op === "=" && fieldValue !== value) matches = false;
            if (op === "!=" && fieldValue === value) matches = false;
          }
          if (matches) {
            users[i] = { ...u, ..._setData };
            updated.push(users[i]);
          }
        }
        return updated;
      },
    };
    return query;
  };

  const createDeleteQuery = () => {
    const _whereConditions: Array<{ field: string; op: string; value: any }> =
      [];

    const query = {
      where: (field: string, op: string, value: any) => {
        _whereConditions.push({ field, op, value });
        return query;
      },
      returningAll: () => query,
      execute: async () => {
        const deleted: any[] = [];
        for (let i = users.length - 1; i >= 0; i--) {
          const u = users[i];
          let matches = true;
          for (const { field, op, value } of _whereConditions) {
            const fieldValue = (u as any)[field];
            if (op === "=" && fieldValue !== value) matches = false;
            if (op === "!=" && fieldValue === value) matches = false;
            if (op === "<=" && !(fieldValue <= value)) matches = false;
            if (op === ">=" && !(fieldValue >= value)) matches = false;
          }
          if (matches) {
            deleted.push(users.splice(i, 1)[0]);
          }
        }
        return deleted;
      },
    };
    return query;
  };

  return {
    selectFrom: vi.fn((_table: string) => createSelectQuery()),
    insertInto: vi.fn((_table: string) => createInsertQuery()),
    updateTable: vi.fn((_table: string) => createUpdateQuery()),
    deleteFrom: vi.fn((_table: string) => createDeleteQuery()),
    destroy: vi.fn(async () => {}),
    transaction: vi.fn(() => ({
      execute: async <T>(fn: (trx: any) => Promise<T>) => {
        const trx = createMockKyselyInstance();
        return fn(trx);
      },
    })),
    _users: users,
    _reset: () => {
      users.length = 0;
      nextId = 1;
    },
    _dialect: { constructor: { name: "PostgresDialect" } },
  } as unknown as KyselyInstance<TestDatabase> & {
    _users: typeof users;
    _reset: () => void;
  };
}

describe("integrations: kyselyAdapter", () => {
  let mockKysely: KyselyInstance<TestDatabase> & {
    _users: any[];
    _reset: () => void;
  };
  let adapter: KyselyAdapterResult<TestDatabase>;

  beforeEach(() => {
    mockKysely = createMockKyselyInstance() as any;
    mockKysely._reset();
    adapter = kyselyAdapter(mockKysely, { tableNames: ["user", "post"] });
  });

  describe("basic setup", () => {
    it("extracts table definitions from config", () => {
      expect(adapter.tables.user).toBeDefined();
      expect(adapter.tables.user.name).toBe("user");
    });

    it("exposes native kysely instance via db.native", () => {
      expect(adapter.native).toBe(mockKysely);
    });

    it("detects dialect from Kysely internals", () => {
      expect(adapter.dialect).toBe("postgresql");
    });

    it("sets capabilities based on dialect", () => {
      expect(adapter.capabilities.supportsJSON).toBe(true);
      expect(adapter.capabilities.supportsTransactions).toBe(true);
      expect(adapter.capabilities.supportsArrays).toBe(true);
    });

    it("allows manual dialect override", () => {
      const mysqlAdapter = kyselyAdapter(mockKysely, { dialect: "mysql" });
      expect(mysqlAdapter.dialect).toBe("mysql");
      expect(mysqlAdapter.capabilities.supportsArrays).toBe(false);
    });
  });

  describe("model.findOne", () => {
    beforeEach(async () => {
      await adapter
        .model("user")
        .create({ name: "Alice", email: "alice@example.com", age: 30 });
      await adapter
        .model("user")
        .create({ name: "Bob", email: "bob@example.com", age: 25 });
    });

    it("returns single object when found", async () => {
      const user = await adapter.model("user").findOne({ where: { id: 1 } });

      expect(user).not.toBeNull();
      expect(user?.name).toBe("Alice");
      expect(user?.email).toBe("alice@example.com");
    });

    it("returns null when not found", async () => {
      const user = await adapter.model("user").findOne({ where: { id: 999 } });

      expect(user).toBeNull();
    });

    it("supports where operators", async () => {
      const user = await adapter
        .model("user")
        .findOne({ where: { age: { gte: 30 } } });

      expect(user?.name).toBe("Alice");
    });
  });

  describe("model.findMany", () => {
    beforeEach(async () => {
      await adapter
        .model("user")
        .create({ name: "Alice", email: "alice@example.com", age: 30 });
      await adapter
        .model("user")
        .create({ name: "Bob", email: "bob@example.com", age: 25 });
      await adapter
        .model("user")
        .create({ name: "Charlie", email: "charlie@example.com", age: 35 });
    });

    it("returns array of objects", async () => {
      const users = await adapter.model("user").findMany();

      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBe(3);
    });

    it("supports where clause", async () => {
      const users = await adapter
        .model("user")
        .findMany({ where: { age: { gt: 26 } } });

      expect(users.length).toBe(2);
    });

    it("supports limit", async () => {
      const users = await adapter.model("user").findMany({ limit: 2 });

      expect(users.length).toBe(2);
    });

    it("supports offset", async () => {
      const users = await adapter.model("user").findMany({ offset: 1 });

      expect(users.length).toBe(2);
    });

    it("supports orderBy", async () => {
      const users = await adapter
        .model("user")
        .findMany({ orderBy: { age: "desc" } });

      expect(users[0].name).toBe("Charlie");
      expect(users[2].name).toBe("Bob");
    });

    it("supports select fields", async () => {
      const users = await adapter
        .model("user")
        .findMany({ select: ["name", "email"] });

      expect(users[0]).toHaveProperty("name");
      expect(users[0]).toHaveProperty("email");
      expect(users[0]).not.toHaveProperty("age");
    });
  });

  describe("model.create", () => {
    it("creates and returns new record", async () => {
      const user = await adapter
        .model("user")
        .create({ name: "Diana", email: "diana@example.com", age: 28 });

      expect(user.name).toBe("Diana");
      expect(user.id).toBe(1);
    });

    it("handles nullable fields", async () => {
      const user = await adapter.model("user").create({ name: "Eve" });

      expect(user.name).toBe("Eve");
      expect(user.email).toBeNull();
      expect(user.age).toBeNull();
    });
  });

  describe("model.createMany", () => {
    it("creates multiple records and returns count", async () => {
      const result = await adapter.model("user").createMany([
        { name: "Alice", email: "alice@example.com" },
        { name: "Bob", email: "bob@example.com" },
      ]);

      expect(result.count).toBe(2);
    });
  });

  describe("model.update", () => {
    beforeEach(async () => {
      await adapter
        .model("user")
        .create({ name: "Alice", email: "alice@example.com", age: 30 });
    });

    it("updates and returns modified record", async () => {
      const updated = await adapter
        .model("user")
        .update({ where: { id: 1 }, data: { age: 31 } });

      expect(updated?.age).toBe(31);
      expect(updated?.name).toBe("Alice");
    });

    it("returns null when no match", async () => {
      const updated = await adapter
        .model("user")
        .update({ where: { id: 999 }, data: { age: 31 } });

      expect(updated).toBeNull();
    });
  });

  describe("model.updateMany", () => {
    beforeEach(async () => {
      await adapter
        .model("user")
        .create({ name: "Alice", email: "alice@example.com", age: 30 });
      await adapter
        .model("user")
        .create({ name: "Bob", email: "bob@example.com", age: 30 });
    });

    it("updates multiple records and returns them", async () => {
      const result = await adapter
        .model("user")
        .updateMany({ where: { age: 30 }, data: { age: 31 } });

      expect(result.length).toBe(2);
      expect(result[0].age).toBe(31);
    });
  });

  describe("model.delete", () => {
    beforeEach(async () => {
      await adapter
        .model("user")
        .create({ name: "Alice", email: "alice@example.com", age: 30 });
    });

    it("deletes and returns deleted record", async () => {
      const deleted = await adapter.model("user").delete({ where: { id: 1 } });

      expect(deleted?.name).toBe("Alice");
    });

    it("throws when where clause is empty", async () => {
      await expect(adapter.model("user").delete({ where: {} })).rejects.toThrow(
        "delete() requires a where clause",
      );
    });
  });

  describe("model.deleteMany", () => {
    beforeEach(async () => {
      await adapter
        .model("user")
        .create({ name: "Alice", email: "alice@example.com", age: 30 });
      await adapter
        .model("user")
        .create({ name: "Bob", email: "bob@example.com", age: 25 });
    });

    it("deletes multiple records and returns count", async () => {
      const result = await adapter
        .model("user")
        .deleteMany({ where: { age: { lte: 30 } } });

      expect(result.count).toBe(2);
    });

    it("throws when where clause is empty", async () => {
      await expect(
        adapter.model("user").deleteMany({ where: {} }),
      ).rejects.toThrow("deleteMany() requires a where clause");
    });
  });

  describe("model.count", () => {
    beforeEach(async () => {
      await adapter
        .model("user")
        .create({ name: "Alice", email: "alice@example.com", age: 30 });
      await adapter
        .model("user")
        .create({ name: "Bob", email: "bob@example.com", age: 25 });
    });

    it("returns count of all records", async () => {
      const count = await adapter.model("user").count();

      expect(count).toBe(2);
    });

    it("returns count with where clause", async () => {
      const count = await adapter.model("user").count({ where: { age: 30 } });

      expect(count).toBe(1);
    });
  });

  describe("transactions", () => {
    it("executes operations within transaction", async () => {
      const result = await adapter.transaction(async (tx) => {
        const user = await tx
          .model("user")
          .create({ name: "TxUser", email: "tx@example.com" });
        return user;
      });

      expect(result.name).toBe("TxUser");
      expect(mockKysely.transaction).toHaveBeenCalled();
    });

    it("provides native client in transaction", async () => {
      await adapter.transaction(async (tx) => {
        expect(tx.native).toBeDefined();
      });
    });
  });

  describe("dispose", () => {
    it("calls destroy on Kysely instance", async () => {
      await adapter.dispose();

      expect(mockKysely.destroy).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("returns table definition on demand for unknown tables", () => {
      const def = adapter.getTableDefinition("user");
      expect(def.name).toBe("user");
    });
  });
});

describe("integrations: kyselyAdapter: dialect detection", () => {
  it("detects postgresql from dialect name", () => {
    const kysely = {
      _dialect: { constructor: { name: "PostgresDialect" } },
      selectFrom: vi.fn(),
      insertInto: vi.fn(),
      updateTable: vi.fn(),
      deleteFrom: vi.fn(),
      destroy: vi.fn(),
      transaction: vi.fn(),
    } as unknown as KyselyInstance<any>;

    const adapter = kyselyAdapter(kysely);
    expect(adapter.dialect).toBe("postgresql");
  });

  it("detects mysql from dialect name", () => {
    const kysely = {
      _dialect: { constructor: { name: "MysqlDialect" } },
      selectFrom: vi.fn(),
      insertInto: vi.fn(),
      updateTable: vi.fn(),
      deleteFrom: vi.fn(),
      destroy: vi.fn(),
      transaction: vi.fn(),
    } as unknown as KyselyInstance<any>;

    const adapter = kyselyAdapter(kysely);
    expect(adapter.dialect).toBe("mysql");
  });

  it("detects sqlite from dialect name", () => {
    const kysely = {
      _dialect: { constructor: { name: "SqliteDialect" } },
      selectFrom: vi.fn(),
      insertInto: vi.fn(),
      updateTable: vi.fn(),
      deleteFrom: vi.fn(),
      destroy: vi.fn(),
      transaction: vi.fn(),
    } as unknown as KyselyInstance<any>;

    const adapter = kyselyAdapter(kysely);
    expect(adapter.dialect).toBe("sqlite");
  });

  it("defaults to postgresql when dialect unknown", () => {
    const kysely = {
      selectFrom: vi.fn(),
      insertInto: vi.fn(),
      updateTable: vi.fn(),
      deleteFrom: vi.fn(),
      destroy: vi.fn(),
      transaction: vi.fn(),
    } as unknown as KyselyInstance<any>;

    const adapter = kyselyAdapter(kysely);
    expect(adapter.dialect).toBe("postgresql");
  });
});

describe("integrations: kyselyAdapter: capabilities", () => {
  const createMockKysely = (dialect?: string) =>
    ({
      _dialect: dialect ? { constructor: { name: dialect } } : undefined,
      selectFrom: vi.fn(),
      insertInto: vi.fn(),
      updateTable: vi.fn(),
      deleteFrom: vi.fn(),
      destroy: vi.fn(),
      transaction: vi.fn(),
    }) as unknown as KyselyInstance<any>;

  it("postgresql has full capabilities", () => {
    const adapter = kyselyAdapter(createMockKysely("PostgresDialect"));

    expect(adapter.capabilities).toEqual({
      supportsJSON: true,
      supportsBooleans: true,
      supportsArrays: true,
      supportsDates: true,
      supportsUUIDs: true,
      supportsTransactions: true,
      supportsBatch: true,
    });
  });

  it("mysql has limited capabilities", () => {
    const adapter = kyselyAdapter(createMockKysely("MysqlDialect"));

    expect(adapter.capabilities.supportsArrays).toBe(false);
    expect(adapter.capabilities.supportsUUIDs).toBe(false);
  });

  it("sqlite has most limited capabilities", () => {
    const adapter = kyselyAdapter(createMockKysely("SqliteDialect"));

    expect(adapter.capabilities.supportsBooleans).toBe(false);
    expect(adapter.capabilities.supportsArrays).toBe(false);
    expect(adapter.capabilities.supportsDates).toBe(false);
    expect(adapter.capabilities.supportsUUIDs).toBe(false);
  });
});

describe("integrations: kyselyAdapter: type inference", () => {
  it("model types are inferred from Database type", () => {
    const mockKysely = createMockKyselyInstance();
    const adapter = kyselyAdapter(mockKysely, { tableNames: ["user"] });

    const model = adapter.model("user");
    expect(model.findOne).toBeDefined();
    expect(model.findMany).toBeDefined();
    expect(model.create).toBeDefined();
    expect(model.update).toBeDefined();
    expect(model.delete).toBeDefined();
    expect(model.count).toBeDefined();
  });
});

describe("integrations: kyselyAdapter: edge cases", () => {
  let mockKysely: KyselyInstance<TestDatabase> & {
    _users: any[];
    _reset: () => void;
  };
  let adapter: KyselyAdapterResult<TestDatabase>;

  beforeEach(() => {
    mockKysely = createMockKyselyInstance() as any;
    mockKysely._reset();
    adapter = kyselyAdapter(mockKysely, { tableNames: ["user", "post"] });
  });

  describe("null handling", () => {
    it("handles null in create", async () => {
      const user = await adapter.model("user").create({
        name: "NoEmail",
        email: null,
        age: null,
      });
      expect(user.email).toBeNull();
      expect(user.age).toBeNull();
    });

    it("handles null in update", async () => {
      await adapter.model("user").create({
        name: "HasEmail",
        email: "test@example.com",
        age: 25,
      });
      const updated = await adapter.model("user").update({
        where: { id: 1 },
        data: { email: null },
      });
      expect(updated?.email).toBeNull();
    });
  });

  describe("empty results", () => {
    it("findMany returns empty array when no data", async () => {
      const users = await adapter.model("user").findMany();
      expect(users).toEqual([]);
    });

    it("count returns 0 when no data", async () => {
      const count = await adapter.model("user").count();
      expect(count).toBe(0);
    });
  });

  describe("complex where clauses", () => {
    beforeEach(async () => {
      await adapter.model("user").create({ name: "Alice", age: 30 });
      await adapter.model("user").create({ name: "Bob", age: 25 });
      await adapter.model("user").create({ name: "Charlie", age: 35 });
    });

    it("supports gt operator", async () => {
      const users = await adapter
        .model("user")
        .findMany({ where: { age: { gt: 28 } } });
      expect(users.length).toBe(2);
    });

    it("supports gte operator", async () => {
      const users = await adapter
        .model("user")
        .findMany({ where: { age: { gte: 30 } } });
      expect(users.length).toBe(2);
    });

    it("supports lt operator", async () => {
      const users = await adapter
        .model("user")
        .findMany({ where: { age: { lt: 30 } } });
      expect(users.length).toBe(1);
    });

    it("supports lte operator", async () => {
      const users = await adapter
        .model("user")
        .findMany({ where: { age: { lte: 30 } } });
      expect(users.length).toBe(2);
    });

    it("supports in operator", async () => {
      const users = await adapter
        .model("user")
        .findMany({ where: { age: { in: [25, 35] } } });
      expect(users.length).toBe(2);
    });

    it("supports eq operator (explicit)", async () => {
      const users = await adapter
        .model("user")
        .findMany({ where: { age: { eq: 30 } } });
      expect(users.length).toBe(1);
    });

    it("supports ne operator", async () => {
      const users = await adapter
        .model("user")
        .findMany({ where: { age: { ne: 30 } } });
      expect(users.length).toBe(2);
    });

    it("supports like operator", async () => {
      const users = await adapter
        .model("user")
        .findMany({ where: { name: { like: "%li%" } } });
      expect(users.length).toBeGreaterThanOrEqual(1);
    });

    it("combines multiple where conditions (AND)", async () => {
      const users = await adapter.model("user").findMany({
        where: { age: { gt: 24 }, name: { ne: "Charlie" } },
      });
      expect(users.length).toBe(2);
    });
  });

  describe("ordering and pagination", () => {
    beforeEach(async () => {
      await adapter.model("user").create({ name: "Alice", age: 30 });
      await adapter.model("user").create({ name: "Bob", age: 25 });
      await adapter.model("user").create({ name: "Charlie", age: 35 });
    });

    it("supports orderBy ascending", async () => {
      const users = await adapter
        .model("user")
        .findMany({ orderBy: { age: "asc" } });
      expect(users[0].name).toBe("Bob");
      expect(users[2].name).toBe("Charlie");
    });

    it("supports orderBy descending", async () => {
      const users = await adapter
        .model("user")
        .findMany({ orderBy: { age: "desc" } });
      expect(users[0].name).toBe("Charlie");
      expect(users[2].name).toBe("Bob");
    });

    it("supports limit", async () => {
      const users = await adapter.model("user").findMany({ limit: 2 });
      expect(users.length).toBe(2);
    });

    it("supports offset", async () => {
      const users = await adapter.model("user").findMany({ offset: 1 });
      expect(users.length).toBe(2);
    });

    it("combines orderBy, limit, and offset", async () => {
      const users = await adapter.model("user").findMany({
        orderBy: { age: "asc" },
        offset: 1,
        limit: 1,
      });
      expect(users.length).toBe(1);
      expect(users[0].name).toBe("Alice");
    });
  });

  describe("select fields", () => {
    beforeEach(async () => {
      await adapter.model("user").create({
        name: "Alice",
        email: "alice@example.com",
        age: 30,
      });
    });

    it("returns only selected fields in findOne", async () => {
      const user = await adapter.model("user").findOne({
        where: { id: 1 },
        select: ["name", "email"],
      });
      expect(user?.name).toBe("Alice");
      expect(user?.email).toBe("alice@example.com");
      expect((user as any)?.age).toBeUndefined();
      expect((user as any)?.id).toBeUndefined();
    });

    it("returns only selected fields in findMany", async () => {
      const users = await adapter.model("user").findMany({
        select: ["name"],
      });
      expect(users[0].name).toBe("Alice");
      expect((users[0] as any)?.email).toBeUndefined();
    });
  });

  describe("createMany", () => {
    it("creates multiple records and returns count", async () => {
      const result = await adapter.model("user").createMany([
        { name: "User1", email: "user1@example.com" },
        { name: "User2", email: "user2@example.com" },
        { name: "User3", email: "user3@example.com" },
      ]);
      expect(result.count).toBe(3);
    });

    it("creates with mixed null values", async () => {
      const result = await adapter.model("user").createMany([
        { name: "WithEmail", email: "test@example.com", age: 25 },
        { name: "NoEmail", email: null, age: null },
      ]);
      expect(result.count).toBe(2);
    });
  });

  describe("update operations", () => {
    beforeEach(async () => {
      await adapter.model("user").create({ name: "Alice", age: 30 });
      await adapter.model("user").create({ name: "Bob", age: 30 });
    });

    it("updateMany updates all matching records", async () => {
      const updated = await adapter.model("user").updateMany({
        where: { age: 30 },
        data: { age: 31 },
      });
      expect(updated.length).toBe(2);
      expect(updated[0].age).toBe(31);
      expect(updated[1].age).toBe(31);
    });

    it("updateMany with no matches returns empty array", async () => {
      const updated = await adapter.model("user").updateMany({
        where: { age: 999 },
        data: { age: 31 },
      });
      expect(updated.length).toBe(0);
    });
  });
});

// ============================================================================
// Real Database Tests
// ============================================================================

import { Kysely, SqliteDialect, PostgresDialect, MysqlDialect } from "kysely";
import Database from "better-sqlite3";

// Define database schema for real DB tests
interface RealTestDatabase {
  kysely_test_users: {
    id: Generated<number>;
    name: string;
    email: string | null;
    age: number | null;
  };
}

describe("integrations: kyselyAdapter: real DB: sqlite", () => {
  let kysely: Kysely<RealTestDatabase>;
  let adapter: KyselyAdapterResult<RealTestDatabase>;

  beforeAll(async () => {
    const sqliteDb = new Database(":memory:");
    kysely = new Kysely<RealTestDatabase>({
      dialect: new SqliteDialect({ database: sqliteDb }),
    });

    // Create test table
    await kysely.schema
      .createTable("kysely_test_users")
      .ifNotExists()
      .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
      .addColumn("name", "text", (col) => col.notNull())
      .addColumn("email", "text")
      .addColumn("age", "integer")
      .execute();

    adapter = kyselyAdapter(kysely, { tableNames: ["kysely_test_users"] });
  });

  afterAll(async () => {
    await kysely.schema.dropTable("kysely_test_users").ifExists().execute();
    await kysely.destroy();
  });

  beforeEach(async () => {
    await kysely.deleteFrom("kysely_test_users").execute();
  });

  it("detects sqlite dialect", () => {
    expect(adapter.dialect).toBe("sqlite");
  });

  it("create and findOne", async () => {
    const created = await adapter
      .model("kysely_test_users")
      .create({ name: "Alice", email: "alice@test.com", age: 30 });

    expect(created.name).toBe("Alice");
    expect(created.id).toBeDefined();

    const found = await adapter
      .model("kysely_test_users")
      .findOne({ where: { id: created.id } });

    expect(found?.name).toBe("Alice");
    expect(found?.email).toBe("alice@test.com");
  });

  it("findMany with where and orderBy", async () => {
    await adapter.model("kysely_test_users").create({ name: "Alice", age: 30 });
    await adapter.model("kysely_test_users").create({ name: "Bob", age: 25 });
    await adapter
      .model("kysely_test_users")
      .create({ name: "Charlie", age: 35 });

    const users = await adapter.model("kysely_test_users").findMany({
      where: { age: { gt: 24 } },
      orderBy: { age: "desc" },
    });

    expect(users.length).toBe(3);
    expect(users[0].name).toBe("Charlie");
    expect(users[2].name).toBe("Bob");
  });

  it("update", async () => {
    const created = await adapter
      .model("kysely_test_users")
      .create({ name: "Alice", age: 30 });

    const updated = await adapter.model("kysely_test_users").update({
      where: { id: created.id },
      data: { age: 31 },
    });

    expect(updated?.age).toBe(31);
  });

  it("delete", async () => {
    const created = await adapter
      .model("kysely_test_users")
      .create({ name: "Alice", age: 30 });

    const deleted = await adapter
      .model("kysely_test_users")
      .delete({ where: { id: created.id } });

    expect(deleted?.name).toBe("Alice");

    const found = await adapter
      .model("kysely_test_users")
      .findOne({ where: { id: created.id } });
    expect(found).toBeNull();
  });

  it("count", async () => {
    await adapter.model("kysely_test_users").create({ name: "Alice", age: 30 });
    await adapter.model("kysely_test_users").create({ name: "Bob", age: 25 });

    const total = await adapter.model("kysely_test_users").count();
    expect(total).toBe(2);

    const filtered = await adapter
      .model("kysely_test_users")
      .count({ where: { age: { gte: 30 } } });
    expect(filtered).toBe(1);
  });

  it("transaction commits on success", async () => {
    await adapter.transaction(async (tx) => {
      await tx
        .model("kysely_test_users")
        .create({ name: "TxUser", email: "tx@test.com" });
    });

    const found = await adapter
      .model("kysely_test_users")
      .findOne({ where: { name: "TxUser" } });
    expect(found).not.toBeNull();
  });
});

describe.runIf(process.env.POSTGRESQL_URL)(
  "integrations: kyselyAdapter: real DB: postgresql",
  () => {
    let kysely: Kysely<RealTestDatabase>;
    let adapter: KyselyAdapterResult<RealTestDatabase>;
    let pool: any;

    beforeAll(async () => {
      const pg = await import("pg");
      pool = new pg.default.Pool({
        connectionString: process.env.POSTGRESQL_URL,
      });

      kysely = new Kysely<RealTestDatabase>({
        dialect: new PostgresDialect({ pool }),
      });

      // Create test table
      await kysely.schema.dropTable("kysely_test_users").ifExists().execute();
      await kysely.schema
        .createTable("kysely_test_users")
        .addColumn("id", "serial", (col) => col.primaryKey())
        .addColumn("name", "text", (col) => col.notNull())
        .addColumn("email", "text")
        .addColumn("age", "integer")
        .execute();

      adapter = kyselyAdapter(kysely, { tableNames: ["kysely_test_users"] });
    });

    afterAll(async () => {
      await kysely.schema.dropTable("kysely_test_users").ifExists().execute();
      await kysely.destroy();
    });

    beforeEach(async () => {
      await kysely.deleteFrom("kysely_test_users").execute();
    });

    it("detects postgresql dialect", () => {
      expect(adapter.dialect).toBe("postgresql");
    });

    it("create and findOne", async () => {
      const created = await adapter
        .model("kysely_test_users")
        .create({ name: "Alice", email: "alice@test.com", age: 30 });

      expect(created.name).toBe("Alice");
      expect(created.id).toBeDefined();

      const found = await adapter
        .model("kysely_test_users")
        .findOne({ where: { id: created.id } });

      expect(found?.name).toBe("Alice");
    });

    it("findMany with operators", async () => {
      await adapter
        .model("kysely_test_users")
        .create({ name: "Alice", age: 30 });
      await adapter.model("kysely_test_users").create({ name: "Bob", age: 25 });
      await adapter
        .model("kysely_test_users")
        .create({ name: "Charlie", age: 35 });

      const users = await adapter.model("kysely_test_users").findMany({
        where: { age: { in: [25, 35] } },
        orderBy: { name: "asc" },
      });

      expect(users.length).toBe(2);
      expect(users[0].name).toBe("Bob");
      expect(users[1].name).toBe("Charlie");
    });

    it("updateMany", async () => {
      await adapter
        .model("kysely_test_users")
        .create({ name: "Alice", age: 30 });
      await adapter.model("kysely_test_users").create({ name: "Bob", age: 30 });

      const updated = await adapter.model("kysely_test_users").updateMany({
        where: { age: 30 },
        data: { age: 31 },
      });

      expect(updated.length).toBe(2);
      expect(updated[0].age).toBe(31);
    });

    it("deleteMany", async () => {
      await adapter
        .model("kysely_test_users")
        .create({ name: "Alice", age: 30 });
      await adapter.model("kysely_test_users").create({ name: "Bob", age: 25 });

      const result = await adapter.model("kysely_test_users").deleteMany({
        where: { age: { lte: 30 } },
      });

      expect(result.count).toBe(2);
    });

    it("transaction", async () => {
      await adapter.transaction(async (tx) => {
        await tx.model("kysely_test_users").create({ name: "TxUser" });
        const count = await tx.model("kysely_test_users").count();
        expect(count).toBe(1);
      });

      const found = await adapter
        .model("kysely_test_users")
        .findOne({ where: { name: "TxUser" } });
      expect(found).not.toBeNull();
    });
  },
);

describe.runIf(process.env.MYSQL_URL)(
  "integrations: kyselyAdapter: real DB: mysql",
  () => {
    let kysely: Kysely<RealTestDatabase>;
    let adapter: KyselyAdapterResult<RealTestDatabase>;
    let pool: any;

    beforeAll(async () => {
      const mysql = await import("mysql2");
      pool = mysql.createPool(process.env.MYSQL_URL as string);

      kysely = new Kysely<RealTestDatabase>({
        dialect: new MysqlDialect({ pool }),
      });

      // Create test table
      await kysely.schema.dropTable("kysely_test_users").ifExists().execute();
      await kysely.schema
        .createTable("kysely_test_users")
        .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
        .addColumn("name", "varchar(255)", (col) => col.notNull())
        .addColumn("email", "varchar(255)")
        .addColumn("age", "integer")
        .execute();

      adapter = kyselyAdapter(kysely, {
        tableNames: ["kysely_test_users"],
        dialect: "mysql",
      });
    });

    afterAll(async () => {
      await kysely.schema.dropTable("kysely_test_users").ifExists().execute();
      await kysely.destroy();
    });

    beforeEach(async () => {
      await kysely.deleteFrom("kysely_test_users").execute();
    });

    it("detects mysql dialect", () => {
      expect(adapter.dialect).toBe("mysql");
    });

    it("create and findOne", async () => {
      // MySQL doesn't support RETURNING, so we need to work around
      await kysely
        .insertInto("kysely_test_users")
        .values({ name: "Alice", email: "alice@test.com", age: 30 })
        .execute();

      const found = await adapter
        .model("kysely_test_users")
        .findOne({ where: { name: "Alice" } });

      expect(found?.name).toBe("Alice");
      expect(found?.email).toBe("alice@test.com");
    });

    it("findMany with limit and offset", async () => {
      await kysely
        .insertInto("kysely_test_users")
        .values({ name: "Alice", age: 30 })
        .execute();
      await kysely
        .insertInto("kysely_test_users")
        .values({ name: "Bob", age: 25 })
        .execute();
      await kysely
        .insertInto("kysely_test_users")
        .values({ name: "Charlie", age: 35 })
        .execute();

      const users = await adapter.model("kysely_test_users").findMany({
        orderBy: { age: "asc" },
        limit: 2,
        offset: 1,
      });

      expect(users.length).toBe(2);
      expect(users[0].name).toBe("Alice");
      expect(users[1].name).toBe("Charlie");
    });

    it("count with where", async () => {
      await kysely
        .insertInto("kysely_test_users")
        .values({ name: "Alice", age: 30 })
        .execute();
      await kysely
        .insertInto("kysely_test_users")
        .values({ name: "Bob", age: 25 })
        .execute();

      const count = await adapter
        .model("kysely_test_users")
        .count({ where: { age: { gt: 26 } } });

      expect(count).toBe(1);
    });
  },
);

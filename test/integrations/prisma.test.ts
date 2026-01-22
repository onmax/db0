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
  prismaAdapter,
  type PrismaClient,
  type PrismaAdapterResult,
} from "../../src/integrations/prisma";

// Mock Prisma client factory
function createMockPrismaClient(): PrismaClient {
  const users: Array<{
    id: number;
    name: string;
    email: string | null;
    age: number | null;
  }> = [];
  let nextId = 1;

  const userDelegate = {
    findUnique: vi.fn(
      async ({ where }: { where: { id?: number; email?: string } }) => {
        if (where.id !== undefined) {
          return users.find((u) => u.id === where.id) ?? null;
        }
        return users.find((u) => u.email === where.email) ?? null;
      },
    ),
    findUniqueOrThrow: vi.fn(
      async ({ where }: { where: { id?: number; email?: string } }) => {
        const user =
          where.id === undefined
            ? users.find((u) => u.email === where.email)
            : users.find((u) => u.id === where.id);
        if (!user) throw new Error("Record not found");
        return user;
      },
    ),
    findFirst: vi.fn(
      async ({ where }: { where?: Record<string, any> } = {}) => {
        if (!where) return users[0] ?? null;
        return (
          users.find((u) =>
            Object.entries(where).every(([k, v]) => (u as any)[k] === v),
          ) ?? null
        );
      },
    ),
    findFirstOrThrow: vi.fn(
      async ({ where }: { where?: Record<string, any> } = {}) => {
        const user = users.find((u) =>
          Object.entries(where || {}).every(([k, v]) => (u as any)[k] === v),
        );
        if (!user) throw new Error("Record not found");
        return user;
      },
    ),
    findMany: vi.fn(
      async ({
        where,
        take,
        skip,
        orderBy,
      }: {
        where?: Record<string, any>;
        take?: number;
        skip?: number;
        orderBy?: Record<string, "asc" | "desc">;
      } = {}) => {
        let result = [...users];
        if (where) {
          result = result.filter((u) =>
            Object.entries(where).every(([k, v]) => {
              if (typeof v === "object" && v !== null) {
                if ("equals" in v) return (u as any)[k] === v.equals;
                if ("gt" in v) return (u as any)[k] > v.gt;
                if ("gte" in v) return (u as any)[k] >= v.gte;
                if ("lt" in v) return (u as any)[k] < v.lt;
                if ("lte" in v) return (u as any)[k] <= v.lte;
                if ("in" in v) return v.in.includes((u as any)[k]);
              }
              return (u as any)[k] === v;
            }),
          );
        }
        if (orderBy) {
          const [field, dir] = Object.entries(orderBy)[0];
          result.sort((a, b) => {
            const av = (a as any)[field];
            const bv = (b as any)[field];
            if (dir === "asc") {
              return av > bv ? 1 : -1;
            }
            return av < bv ? 1 : -1;
          });
        }
        if (skip) result = result.slice(skip);
        if (take) result = result.slice(0, take);
        return result;
      },
    ),
    create: vi.fn(
      async ({
        data,
      }: {
        data: { name: string; email?: string | null; age?: number | null };
      }) => {
        const user = {
          id: nextId++,
          name: data.name,
          email: data.email ?? null,
          age: data.age ?? null,
        };
        users.push(user);
        return user;
      },
    ),
    createMany: vi.fn(
      async ({
        data,
      }: {
        data: Array<{
          name: string;
          email?: string | null;
          age?: number | null;
        }>;
      }) => {
        const created = data.map((d) => ({
          id: nextId++,
          name: d.name,
          email: d.email ?? null,
          age: d.age ?? null,
        }));
        users.push(...created);
        return { count: created.length };
      },
    ),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id?: number; email?: string };
        data: Partial<{
          name: string;
          email: string | null;
          age: number | null;
        }>;
      }) => {
        const idx =
          where.id === undefined
            ? users.findIndex((u) => u.email === where.email)
            : users.findIndex((u) => u.id === where.id);
        if (idx === -1) throw new Error("Record not found");
        users[idx] = { ...users[idx], ...data };
        return users[idx];
      },
    ),
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where?: Record<string, any>;
        data: Partial<{
          name: string;
          email: string | null;
          age: number | null;
        }>;
      }) => {
        let count = 0;
        for (let i = 0; i < users.length; i++) {
          const u = users[i];
          if (
            !where ||
            Object.entries(where).every(([k, v]) => (u as any)[k] === v)
          ) {
            users[i] = { ...u, ...data };
            count++;
          }
        }
        return { count };
      },
    ),
    upsert: vi.fn(
      async ({
        where,
        create,
        update,
      }: {
        where: { id?: number; email?: string };
        create: any;
        update: any;
      }) => {
        const idx =
          where.id === undefined
            ? users.findIndex((u) => u.email === where.email)
            : users.findIndex((u) => u.id === where.id);
        if (idx === -1) {
          const user = { id: nextId++, ...create };
          users.push(user);
          return user;
        }
        users[idx] = { ...users[idx], ...update };
        return users[idx];
      },
    ),
    delete: vi.fn(
      async ({ where }: { where: { id?: number; email?: string } }) => {
        const idx =
          where.id === undefined
            ? users.findIndex((u) => u.email === where.email)
            : users.findIndex((u) => u.id === where.id);
        if (idx === -1) throw new Error("Record not found");
        return users.splice(idx, 1)[0];
      },
    ),
    deleteMany: vi.fn(
      async ({ where }: { where?: Record<string, any> } = {}) => {
        if (!where) {
          const count = users.length;
          users.length = 0;
          return { count };
        }
        let count = 0;
        for (let i = users.length - 1; i >= 0; i--) {
          const matches = Object.entries(where).every(([k, v]) => {
            const userVal = (users[i] as any)[k];
            if (typeof v === "object" && v !== null) {
              if ("lte" in v) return userVal <= v.lte;
              if ("lt" in v) return userVal < v.lt;
              if ("gte" in v) return userVal >= v.gte;
              if ("gt" in v) return userVal > v.gt;
              if ("equals" in v) return userVal === v.equals;
              if ("in" in v) return v.in.includes(userVal);
            }
            return userVal === v;
          });
          if (matches) {
            users.splice(i, 1);
            count++;
          }
        }
        return { count };
      },
    ),
    aggregate: vi.fn(async () => ({ _count: { _all: users.length } })),
    groupBy: vi.fn(async () => []),
    count: vi.fn(async ({ where }: { where?: Record<string, any> } = {}) => {
      if (!where) return users.length;
      return users.filter((u) =>
        Object.entries(where).every(([k, v]) => (u as any)[k] === v),
      ).length;
    }),
    fields: {
      id: {
        name: "id",
        typeName: "Int",
        isId: true,
        isRequired: true,
        isList: false,
        hasDefaultValue: true,
      },
      name: {
        name: "name",
        typeName: "String",
        isId: false,
        isRequired: true,
        isList: false,
        hasDefaultValue: false,
      },
      email: {
        name: "email",
        typeName: "String",
        isId: false,
        isRequired: false,
        isList: false,
        hasDefaultValue: false,
      },
      age: {
        name: "age",
        typeName: "Int",
        isId: false,
        isRequired: false,
        isList: false,
        hasDefaultValue: false,
      },
    },
    _reset: () => {
      users.length = 0;
      nextId = 1;
    },
  };

  return {
    $connect: vi.fn(async () => {}),
    $disconnect: vi.fn(async () => {}),
    $transaction: vi.fn(async (fn: (tx: any) => Promise<any>) =>
      fn({ user: userDelegate }),
    ),
    $queryRaw: vi.fn(async () => []),
    $executeRaw: vi.fn(async () => 0),
    $queryRawUnsafe: vi.fn(async () => []),
    $executeRawUnsafe: vi.fn(async () => 0),
    user: userDelegate,
    _engineConfig: { activeProvider: "postgresql" },
  } as unknown as PrismaClient;
}

describe("integrations: prismaAdapter", () => {
  let mockClient: PrismaClient & { user: { _reset: () => void } };
  let adapter: PrismaAdapterResult<typeof mockClient>;

  beforeEach(() => {
    mockClient = createMockPrismaClient() as any;
    mockClient.user._reset();
    adapter = prismaAdapter(mockClient);
  });

  describe("basic setup", () => {
    it("extracts model definitions", () => {
      expect(adapter.tables.user).toBeDefined();
      expect(adapter.tables.user.name).toBe("user");
    });

    it("provides field metadata", () => {
      const userDef = adapter.getModelDefinition("user");
      expect(userDef.fields.id).toBeDefined();
      expect(userDef.fields.id.isId).toBe(true);
      expect(userDef.fields.id.hasDefault).toBe(true);
      expect(userDef.fields.name.isRequired).toBe(true);
      expect(userDef.fields.email.isRequired).toBe(false);
    });

    it("exposes native prisma client via db.native", () => {
      expect(adapter.native).toBe(mockClient);
    });

    it("detects dialect from Prisma internals", () => {
      expect(adapter.dialect).toBe("postgresql");
    });

    it("sets capabilities based on dialect", () => {
      expect(adapter.capabilities.supportsJSON).toBe(true);
      expect(adapter.capabilities.supportsTransactions).toBe(true);
      expect(adapter.capabilities.supportsArrays).toBe(true);
    });

    it("allows manual dialect override", () => {
      const mysqlAdapter = prismaAdapter(mockClient, { dialect: "mysql" });
      expect(mysqlAdapter.dialect).toBe("mysql");
      expect(mysqlAdapter.capabilities.supportsArrays).toBe(false);
    });
  });

  describe("model.findOne", () => {
    beforeEach(async () => {
      await mockClient.user.create({
        data: { name: "Alice", email: "alice@example.com", age: 30 },
      });
      await mockClient.user.create({
        data: { name: "Bob", email: "bob@example.com", age: 25 },
      });
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

    it("delegates to Prisma findFirst", async () => {
      await adapter.model("user").findOne({ where: { id: 1 } });

      expect(mockClient.user.findFirst).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });
  });

  describe("model.findMany", () => {
    beforeEach(async () => {
      await mockClient.user.create({
        data: { name: "Alice", email: "alice@example.com", age: 30 },
      });
      await mockClient.user.create({
        data: { name: "Bob", email: "bob@example.com", age: 25 },
      });
      await mockClient.user.create({
        data: { name: "Charlie", email: "charlie@example.com", age: 35 },
      });
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

    it("supports take (limit)", async () => {
      const users = await adapter.model("user").findMany({ take: 2 });

      expect(users.length).toBe(2);
    });

    it("supports skip (offset)", async () => {
      const users = await adapter.model("user").findMany({ skip: 1 });

      expect(users.length).toBe(2);
    });

    it("supports orderBy", async () => {
      const users = await adapter
        .model("user")
        .findMany({ orderBy: { age: "desc" } });

      expect(users[0].name).toBe("Charlie");
      expect(users[2].name).toBe("Bob");
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

    it("delegates to Prisma create", async () => {
      await adapter
        .model("user")
        .create({ name: "Eve", email: "eve@example.com" });

      expect(mockClient.user.create).toHaveBeenCalledWith({
        data: { name: "Eve", email: "eve@example.com" },
      });
    });
  });

  describe("model.update", () => {
    beforeEach(async () => {
      await mockClient.user.create({
        data: { name: "Alice", email: "alice@example.com", age: 30 },
      });
    });

    it("updates and returns modified record", async () => {
      const updated = await adapter
        .model("user")
        .update({ where: { id: 1 }, data: { age: 31 } });

      expect(updated.age).toBe(31);
      expect(updated.name).toBe("Alice");
    });

    it("delegates to Prisma update", async () => {
      await adapter
        .model("user")
        .update({ where: { id: 1 }, data: { name: "Alice Updated" } });

      expect(mockClient.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { name: "Alice Updated" },
      });
    });
  });

  describe("model.updateMany", () => {
    beforeEach(async () => {
      await mockClient.user.create({
        data: { name: "Alice", email: "alice@example.com", age: 30 },
      });
      await mockClient.user.create({
        data: { name: "Bob", email: "bob@example.com", age: 30 },
      });
    });

    it("updates multiple records and returns count", async () => {
      const result = await adapter
        .model("user")
        .updateMany({ where: { age: 30 }, data: { age: 31 } });

      expect(result.count).toBe(2);
    });
  });

  describe("model.delete", () => {
    beforeEach(async () => {
      await mockClient.user.create({
        data: { name: "Alice", email: "alice@example.com", age: 30 },
      });
    });

    it("deletes and returns deleted record", async () => {
      const deleted = await adapter.model("user").delete({ where: { id: 1 } });

      expect(deleted.name).toBe("Alice");
    });

    it("delegates to Prisma delete", async () => {
      await adapter.model("user").delete({ where: { id: 1 } });

      expect(mockClient.user.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });

  describe("model.deleteMany", () => {
    beforeEach(async () => {
      await mockClient.user.create({
        data: { name: "Alice", email: "alice@example.com", age: 30 },
      });
      await mockClient.user.create({
        data: { name: "Bob", email: "bob@example.com", age: 25 },
      });
    });

    it("deletes multiple records and returns count", async () => {
      const result = await adapter
        .model("user")
        .deleteMany({ where: { age: { lte: 30 } } });

      expect(result.count).toBe(2);
    });
  });

  describe("model.count", () => {
    beforeEach(async () => {
      await mockClient.user.create({
        data: { name: "Alice", email: "alice@example.com", age: 30 },
      });
      await mockClient.user.create({
        data: { name: "Bob", email: "bob@example.com", age: 25 },
      });
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
      expect(mockClient.$transaction).toHaveBeenCalled();
    });

    it("provides native client in transaction", async () => {
      await adapter.transaction(async (tx) => {
        expect(tx.native).toBeDefined();
      });
    });

    it("supports transaction options", async () => {
      await adapter.transaction(
        async (tx) => {
          await tx.model("user").create({ name: "Test" });
        },
        { timeout: 5000, isolationLevel: "Serializable" },
      );

      expect(mockClient.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        {
          timeout: 5000,
          isolationLevel: "Serializable",
        },
      );
    });
  });

  describe("dispose", () => {
    it("calls $disconnect on Prisma client", async () => {
      await adapter.dispose();

      expect(mockClient.$disconnect).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("throws when model not found", () => {
      expect(() => adapter.model("nonexistent" as any)).toThrow(
        'Model "nonexistent" not found',
      );
    });

    it("throws when getModelDefinition for non-existent model", () => {
      expect(() => adapter.getModelDefinition("nonexistent" as any)).toThrow(
        'Model "nonexistent" not found',
      );
    });
  });
});

describe("integrations: prismaAdapter: dialect detection", () => {
  it("detects postgresql from activeProvider", () => {
    const client = {
      _engineConfig: { activeProvider: "postgresql" },
      $connect: vi.fn(),
      $disconnect: vi.fn(),
      $transaction: vi.fn(),
      $queryRaw: vi.fn(),
      $executeRaw: vi.fn(),
      $queryRawUnsafe: vi.fn(),
      $executeRawUnsafe: vi.fn(),
    } as unknown as PrismaClient;
    const adapter = prismaAdapter(client);
    expect(adapter.dialect).toBe("postgresql");
  });

  it("detects mysql from activeProvider", () => {
    const client = {
      _engineConfig: { activeProvider: "mysql" },
      $connect: vi.fn(),
      $disconnect: vi.fn(),
      $transaction: vi.fn(),
      $queryRaw: vi.fn(),
      $executeRaw: vi.fn(),
      $queryRawUnsafe: vi.fn(),
      $executeRawUnsafe: vi.fn(),
    } as unknown as PrismaClient;
    const adapter = prismaAdapter(client);
    expect(adapter.dialect).toBe("mysql");
  });

  it("detects sqlite from activeProvider", () => {
    const client = {
      _engineConfig: { activeProvider: "sqlite" },
      $connect: vi.fn(),
      $disconnect: vi.fn(),
      $transaction: vi.fn(),
      $queryRaw: vi.fn(),
      $executeRaw: vi.fn(),
      $queryRawUnsafe: vi.fn(),
      $executeRawUnsafe: vi.fn(),
    } as unknown as PrismaClient;
    const adapter = prismaAdapter(client);
    expect(adapter.dialect).toBe("sqlite");
  });

  it("defaults to postgresql when provider unknown", () => {
    const client = {
      $connect: vi.fn(),
      $disconnect: vi.fn(),
      $transaction: vi.fn(),
      $queryRaw: vi.fn(),
      $executeRaw: vi.fn(),
      $queryRawUnsafe: vi.fn(),
      $executeRawUnsafe: vi.fn(),
    } as unknown as PrismaClient;
    const adapter = prismaAdapter(client);
    expect(adapter.dialect).toBe("postgresql");
  });
});

describe("integrations: prismaAdapter: capabilities", () => {
  it("postgresql has full capabilities", () => {
    const client = {
      _engineConfig: { activeProvider: "postgresql" },
      $connect: vi.fn(),
      $disconnect: vi.fn(),
      $transaction: vi.fn(),
      $queryRaw: vi.fn(),
      $executeRaw: vi.fn(),
      $queryRawUnsafe: vi.fn(),
      $executeRawUnsafe: vi.fn(),
    } as unknown as PrismaClient;
    const adapter = prismaAdapter(client);

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
    const client = {
      _engineConfig: { activeProvider: "mysql" },
      $connect: vi.fn(),
      $disconnect: vi.fn(),
      $transaction: vi.fn(),
      $queryRaw: vi.fn(),
      $executeRaw: vi.fn(),
      $queryRawUnsafe: vi.fn(),
      $executeRawUnsafe: vi.fn(),
    } as unknown as PrismaClient;
    const adapter = prismaAdapter(client);

    expect(adapter.capabilities.supportsArrays).toBe(false);
    expect(adapter.capabilities.supportsUUIDs).toBe(false);
  });

  it("sqlite has most limited capabilities", () => {
    const client = {
      _engineConfig: { activeProvider: "sqlite" },
      $connect: vi.fn(),
      $disconnect: vi.fn(),
      $transaction: vi.fn(),
      $queryRaw: vi.fn(),
      $executeRaw: vi.fn(),
      $queryRawUnsafe: vi.fn(),
      $executeRawUnsafe: vi.fn(),
    } as unknown as PrismaClient;
    const adapter = prismaAdapter(client);

    expect(adapter.capabilities.supportsBooleans).toBe(false);
    expect(adapter.capabilities.supportsArrays).toBe(false);
    expect(adapter.capabilities.supportsDates).toBe(false);
    expect(adapter.capabilities.supportsUUIDs).toBe(false);
  });
});

describe("integrations: prismaAdapter: type inference", () => {
  it("model types are inferred from Prisma client", () => {
    const mockClient = createMockPrismaClient();
    const adapter = prismaAdapter(mockClient);

    const _model = adapter.model("user");
    expect(_model.findOne).toBeDefined();
    expect(_model.findMany).toBeDefined();
    expect(_model.create).toBeDefined();
    expect(_model.update).toBeDefined();
    expect(_model.delete).toBeDefined();
  });
});

describe("integrations: prismaAdapter: edge cases", () => {
  let mockClient: PrismaClient & { user: { _reset: () => void } };
  let adapter: PrismaAdapterResult<typeof mockClient>;

  beforeEach(() => {
    mockClient = createMockPrismaClient() as any;
    mockClient.user._reset();
    adapter = prismaAdapter(mockClient);
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
      await mockClient.user.create({
        data: { name: "HasEmail", email: "test@example.com", age: 25 },
      });
      const updated = await adapter.model("user").update({
        where: { id: 1 },
        data: { email: null },
      });
      expect(updated.email).toBeNull();
    });

    it("finds records with null values", async () => {
      await mockClient.user.create({
        data: { name: "NoEmail", email: null, age: null },
      });
      await mockClient.user.create({
        data: { name: "HasEmail", email: "test@example.com", age: 25 },
      });
      const count = await adapter.model("user").count();
      expect(count).toBe(2);
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

    it("deleteMany with no matches returns count 0", async () => {
      const result = await adapter
        .model("user")
        .deleteMany({ where: { age: 999 } });
      expect(result.count).toBe(0);
    });
  });

  describe("complex where clauses", () => {
    beforeEach(async () => {
      await mockClient.user.create({ data: { name: "Alice", age: 30 } });
      await mockClient.user.create({ data: { name: "Bob", age: 25 } });
      await mockClient.user.create({ data: { name: "Charlie", age: 35 } });
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

    it("supports equals operator", async () => {
      const users = await adapter
        .model("user")
        .findMany({ where: { age: { equals: 30 } } });
      expect(users.length).toBe(1);
    });
  });

  describe("ordering and pagination", () => {
    beforeEach(async () => {
      await mockClient.user.create({ data: { name: "Alice", age: 30 } });
      await mockClient.user.create({ data: { name: "Bob", age: 25 } });
      await mockClient.user.create({ data: { name: "Charlie", age: 35 } });
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

    it("supports take (limit)", async () => {
      const users = await adapter.model("user").findMany({ take: 2 });
      expect(users.length).toBe(2);
    });

    it("supports skip (offset)", async () => {
      const users = await adapter.model("user").findMany({ skip: 1 });
      expect(users.length).toBe(2);
    });

    it("combines orderBy, take, and skip", async () => {
      const users = await adapter.model("user").findMany({
        orderBy: { age: "asc" },
        skip: 1,
        take: 1,
      });
      expect(users.length).toBe(1);
      expect(users[0].name).toBe("Alice");
    });
  });
});

// ============================================================================
// Real Database Tests
// ============================================================================

// Helper to check if Prisma client exists
async function tryImportPrismaClient(
  path: string,
): Promise<{ PrismaClient: any } | null> {
  try {
    return await import(path);
  } catch {
    return null;
  }
}

// SQLite real DB tests (requires: pnpm prisma:test:generate)
describe.runIf(
  process.env.PRISMA_TEST_SQLITE ||
    (await tryImportPrismaClient("../fixtures/prisma/client-sqlite")),
)("integrations: prismaAdapter: real DB: sqlite", async () => {
  const clientModule = await tryImportPrismaClient(
    "../fixtures/prisma/client-sqlite",
  );

  if (!clientModule) {
    it.skip("Prisma SQLite client not generated - run pnpm prisma:test:generate", () => {});
    return;
  }

  const { PrismaClient } = clientModule;
  let client: PrismaClient;
  let adapter: PrismaAdapterResult<typeof client>;

  beforeAll(async () => {
    client = new PrismaClient();
    await client.$connect();

    // Create table via raw SQL
    await client.$executeRaw`DROP TABLE IF EXISTS User`;
    await client.$executeRaw`CREATE TABLE User (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT, age INTEGER)`;

    adapter = prismaAdapter(client);
  });

  afterAll(async () => {
    await client.$executeRaw`DROP TABLE IF EXISTS User`;
    await client.$disconnect();
  });

  beforeEach(async () => {
    await client.$executeRaw`DELETE FROM User`;
  });

  it("detects sqlite dialect", () => {
    expect(adapter.dialect).toBe("sqlite");
  });

  it("create and findOne", async () => {
    const created = await adapter
      .model("user")
      .create({ name: "Alice", email: "alice@test.com", age: 30 });

    expect(created.name).toBe("Alice");
    expect(created.id).toBeDefined();

    const found = await adapter
      .model("user")
      .findOne({ where: { id: created.id } });
    expect(found?.name).toBe("Alice");
  });

  it("findMany with orderBy and limit", async () => {
    await adapter.model("user").create({ name: "Alice", age: 30 });
    await adapter.model("user").create({ name: "Bob", age: 25 });
    await adapter.model("user").create({ name: "Charlie", age: 35 });

    const users = await adapter.model("user").findMany({
      orderBy: { age: "desc" },
      take: 2,
    });

    expect(users.length).toBe(2);
    expect(users[0].name).toBe("Charlie");
    expect(users[1].name).toBe("Alice");
  });

  it("update", async () => {
    const created = await adapter
      .model("user")
      .create({ name: "Alice", age: 30 });
    const updated = await adapter
      .model("user")
      .update({ where: { id: created.id }, data: { age: 31 } });

    expect(updated.age).toBe(31);
  });

  it("delete", async () => {
    const created = await adapter
      .model("user")
      .create({ name: "Alice", age: 30 });
    const deleted = await adapter
      .model("user")
      .delete({ where: { id: created.id } });

    expect(deleted.name).toBe("Alice");

    const found = await adapter
      .model("user")
      .findOne({ where: { id: created.id } });
    expect(found).toBeNull();
  });

  it("count", async () => {
    await adapter.model("user").create({ name: "Alice", age: 30 });
    await adapter.model("user").create({ name: "Bob", age: 25 });

    const total = await adapter.model("user").count();
    expect(total).toBe(2);
  });

  it("transaction", async () => {
    await adapter.transaction(async (tx) => {
      await tx.model("user").create({ name: "TxUser" });
    });

    const found = await adapter
      .model("user")
      .findOne({ where: { name: "TxUser" } });
    expect(found).not.toBeNull();
  });
});

// PostgreSQL real DB tests
describe.runIf(process.env.POSTGRESQL_URL)(
  "integrations: prismaAdapter: real DB: postgresql",
  async () => {
    const clientModule = await tryImportPrismaClient(
      "../fixtures/prisma/client-postgresql",
    );

    if (!clientModule) {
      it.skip("Prisma PostgreSQL client not generated - run pnpm prisma:test:generate", () => {});
      return;
    }

    const { PrismaClient } = clientModule;
    let client: PrismaClient;
    let adapter: PrismaAdapterResult<typeof client>;

    beforeAll(async () => {
      client = new PrismaClient();
      await client.$connect();

      // Create table via raw SQL
      await client.$executeRaw`DROP TABLE IF EXISTS "User"`;
      await client.$executeRaw`CREATE TABLE "User" (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT, age INTEGER)`;

      adapter = prismaAdapter(client);
    });

    afterAll(async () => {
      await client.$executeRaw`DROP TABLE IF EXISTS "User"`;
      await client.$disconnect();
    });

    beforeEach(async () => {
      await client.$executeRaw`TRUNCATE TABLE "User" RESTART IDENTITY`;
    });

    it("detects postgresql dialect", () => {
      expect(adapter.dialect).toBe("postgresql");
    });

    it("create and findOne", async () => {
      const created = await adapter
        .model("user")
        .create({ name: "Alice", email: "alice@test.com", age: 30 });

      expect(created.name).toBe("Alice");

      const found = await adapter
        .model("user")
        .findOne({ where: { id: created.id } });
      expect(found?.name).toBe("Alice");
    });

    it("findMany with operators", async () => {
      await adapter.model("user").create({ name: "Alice", age: 30 });
      await adapter.model("user").create({ name: "Bob", age: 25 });
      await adapter.model("user").create({ name: "Charlie", age: 35 });

      const users = await adapter.model("user").findMany({
        where: { age: { gt: 28 } },
        orderBy: { age: "asc" },
      });

      expect(users.length).toBe(2);
      expect(users[0].name).toBe("Alice");
      expect(users[1].name).toBe("Charlie");
    });

    it("updateMany", async () => {
      await adapter.model("user").create({ name: "Alice", age: 30 });
      await adapter.model("user").create({ name: "Bob", age: 30 });

      const result = await adapter
        .model("user")
        .updateMany({ where: { age: 30 }, data: { age: 31 } });

      expect(result.count).toBe(2);
    });

    it("deleteMany", async () => {
      await adapter.model("user").create({ name: "Alice", age: 30 });
      await adapter.model("user").create({ name: "Bob", age: 25 });

      const result = await adapter
        .model("user")
        .deleteMany({ where: { age: { lte: 30 } } });

      expect(result.count).toBe(2);
    });

    it("transaction", async () => {
      await adapter.transaction(async (tx) => {
        await tx.model("user").create({ name: "TxUser" });
        const count = await tx.model("user").count();
        expect(count).toBe(1);
      });

      const found = await adapter
        .model("user")
        .findOne({ where: { name: "TxUser" } });
      expect(found).not.toBeNull();
    });
  },
);

// MySQL real DB tests
describe.runIf(process.env.MYSQL_URL)(
  "integrations: prismaAdapter: real DB: mysql",
  async () => {
    const clientModule = await tryImportPrismaClient(
      "../fixtures/prisma/client-mysql",
    );

    if (!clientModule) {
      it.skip("Prisma MySQL client not generated - run pnpm prisma:test:generate", () => {});
      return;
    }

    const { PrismaClient } = clientModule;
    let client: PrismaClient;
    let adapter: PrismaAdapterResult<typeof client>;

    beforeAll(async () => {
      client = new PrismaClient();
      await client.$connect();

      // Create table via raw SQL
      await client.$executeRaw`DROP TABLE IF EXISTS User`;
      await client.$executeRaw`CREATE TABLE User (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL, email VARCHAR(255), age INT)`;

      adapter = prismaAdapter(client);
    });

    afterAll(async () => {
      await client.$executeRaw`DROP TABLE IF EXISTS User`;
      await client.$disconnect();
    });

    beforeEach(async () => {
      await client.$executeRaw`DELETE FROM User`;
    });

    it("detects mysql dialect", () => {
      expect(adapter.dialect).toBe("mysql");
    });

    it("create and findOne", async () => {
      const created = await adapter
        .model("user")
        .create({ name: "Alice", email: "alice@test.com", age: 30 });

      expect(created.name).toBe("Alice");

      const found = await adapter
        .model("user")
        .findOne({ where: { id: created.id } });
      expect(found?.name).toBe("Alice");
    });

    it("findMany with limit and skip", async () => {
      await adapter.model("user").create({ name: "Alice", age: 30 });
      await adapter.model("user").create({ name: "Bob", age: 25 });
      await adapter.model("user").create({ name: "Charlie", age: 35 });

      const users = await adapter.model("user").findMany({
        orderBy: { age: "asc" },
        skip: 1,
        take: 2,
      });

      expect(users.length).toBe(2);
      expect(users[0].name).toBe("Alice");
    });

    it("count with where", async () => {
      await adapter.model("user").create({ name: "Alice", age: 30 });
      await adapter.model("user").create({ name: "Bob", age: 25 });

      const count = await adapter
        .model("user")
        .count({ where: { age: { gte: 30 } } });
      expect(count).toBe(1);
    });
  },
);

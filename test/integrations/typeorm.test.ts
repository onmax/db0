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
  typeormAdapter,
  type DataSource,
  type Repository,
  type TypeORMAdapterResult,
  type EntitySchema,
} from "../../src/integrations/typeorm";

// ============================================================================
// Mock Tests
// ============================================================================

interface UserEntity {
  id: number;
  name: string;
  email: string | null;
  age: number | null;
}

// Mock repository factory
function createMockRepository(): Repository<UserEntity> & {
  _data: UserEntity[];
  _reset: () => void;
} {
  const data: UserEntity[] = [];
  let nextId = 1;

  const metadata = {
    name: "User",
    tableName: "users",
    columns: [
      {
        propertyName: "id",
        databaseName: "id",
        type: "integer",
        isPrimary: true,
        isGenerated: true,
        isNullable: false,
      },
      {
        propertyName: "name",
        databaseName: "name",
        type: "varchar",
        isPrimary: false,
        isGenerated: false,
        isNullable: false,
      },
      {
        propertyName: "email",
        databaseName: "email",
        type: "varchar",
        isPrimary: false,
        isGenerated: false,
        isNullable: true,
      },
      {
        propertyName: "age",
        databaseName: "age",
        type: "integer",
        isPrimary: false,
        isGenerated: false,
        isNullable: true,
      },
    ],
    primaryColumns: [
      {
        propertyName: "id",
        databaseName: "id",
        type: "integer",
        isPrimary: true,
        isGenerated: true,
        isNullable: false,
      },
    ],
  };

  const createQueryBuilder = () => {
    let _whereConditions: Array<{ field: string; op: string; value: any }> = [];
    const _orderBy: Array<{ field: string; direction: string }> = [];
    let _take: number | undefined;
    let _skip: number | undefined;
    let _selectedFields: string[] | null = null;

    const parseCondition = (where: string, params: Record<string, any>) => {
      const match = where.match(
        /(\w+)\.(\w+)\s*(>=|<=|!=|>|<|=|LIKE|IS NULL|IS NOT NULL|IN)\s*(?::\.\.\.?)?:?(\w+)?/i,
      );
      if (match) {
        const field = match[2];
        const op = match[3];
        const param = match[4];
        let value = param ? params[param] : null;
        if (op.toUpperCase() === "IS NULL") value = null;
        if (op.toUpperCase() === "IS NOT NULL") value = "__NOT_NULL__";
        return { field, op: op.toUpperCase(), value };
      }
      return null;
    };

    const qb = {
      where: (where: string, params?: any) => {
        _whereConditions = [];
        const cond = parseCondition(where, params || {});
        if (cond) _whereConditions.push(cond);
        return qb;
      },
      andWhere: (where: string, params?: any) => {
        const cond = parseCondition(where, params || {});
        if (cond) _whereConditions.push(cond);
        return qb;
      },
      orWhere: vi.fn(() => qb),
      orderBy: (field: string, direction: string) => {
        const f = field.split(".").pop()!;
        _orderBy.push({ field: f, direction });
        return qb;
      },
      addOrderBy: (field: string, direction: string) => {
        const f = field.split(".").pop()!;
        _orderBy.push({ field: f, direction });
        return qb;
      },
      take: (n: number) => {
        _take = n;
        return qb;
      },
      skip: (n: number) => {
        _skip = n;
        return qb;
      },
      select: (fields: string[]) => {
        _selectedFields = fields.map((f) => f.split(".").pop()!);
        return qb;
      },
      getMany: async () => {
        let result = [...data];

        for (const { field, op, value } of _whereConditions) {
          result = result.filter((r) => {
            const fieldValue = (r as any)[field];
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
              case "LIKE": {
                return String(fieldValue).includes(
                  String(value).replace(/%/g, ""),
                );
              }
              case "IN": {
                return (value as any[]).includes(fieldValue);
              }
              case "IS NULL": {
                return fieldValue === null;
              }
              case "IS NOT NULL": {
                return fieldValue !== null;
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
            if (direction === "ASC") return av > bv ? 1 : -1;
            return av < bv ? 1 : -1;
          });
        }

        if (_skip !== undefined) result = result.slice(_skip);
        if (_take !== undefined) result = result.slice(0, _take);

        if (_selectedFields) {
          result = result.map((r) => {
            const obj: any = {};
            for (const f of _selectedFields!) {
              obj[f] = (r as any)[f];
            }
            return obj;
          });
        }

        return result;
      },
      getOne: async () => {
        const results = await qb.getMany();
        return results[0] ?? null;
      },
      getCount: async () => {
        let result = [...data];
        for (const { field, op, value } of _whereConditions) {
          result = result.filter((r) => {
            const fieldValue = (r as any)[field];
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
              default: {
                return true;
              }
            }
          });
        }
        return result.length;
      },
    };

    return qb;
  };

  return {
    metadata,
    find: vi.fn(async () => data),
    findOne: vi.fn(async () => data[0] ?? null),
    findOneBy: vi.fn(
      async (where: any) => data.find((d) => d.id === where.id) ?? null,
    ),
    save: vi.fn(async <T>(entity: T) => {
      const e = entity as any;
      if (!e.id) e.id = nextId++;
      const idx = data.findIndex((d) => d.id === e.id);
      if (idx === -1) {
        data.push(e);
      } else {
        data[idx] = e;
      }
      return e;
    }),
    insert: vi.fn(async (entities: any | any[]) => {
      const arr = Array.isArray(entities) ? entities : [entities];
      const identifiers: any[] = [];
      for (const e of arr) {
        e.id = nextId++;
        data.push(e);
        identifiers.push({ id: e.id });
      }
      return { identifiers, generatedMaps: identifiers, raw: null };
    }),
    update: vi.fn(async (where: any, partial: any) => {
      const idx = data.findIndex((d) => d.id === where.id);
      if (idx !== -1) {
        data[idx] = { ...data[idx], ...partial };
      }
      return { affected: idx === -1 ? 0 : 1, raw: null, generatedMaps: [] };
    }),
    delete: vi.fn(async (where: any) => {
      const idx = data.findIndex((d) => d.id === where.id);
      if (idx !== -1) {
        data.splice(idx, 1);
        return { affected: 1, raw: null };
      }
      return { affected: 0, raw: null };
    }),
    count: vi.fn(async () => data.length),
    createQueryBuilder: vi.fn(() => createQueryBuilder()),
    _data: data,
    _reset: () => {
      data.length = 0;
      nextId = 1;
    },
  } as any;
}

// Mock DataSource factory
function createMockDataSource(): DataSource & {
  _repo: ReturnType<typeof createMockRepository>;
} {
  const repo = createMockRepository();

  return {
    isInitialized: true,
    options: { type: "postgres", entities: [] },
    initialize: vi.fn(async () => this as any),
    destroy: vi.fn(async () => {}),
    getRepository: vi.fn(() => repo),
    transaction: vi.fn(async (fn) => fn({ getRepository: () => repo })),
    createQueryRunner: vi.fn(() => ({
      connect: vi.fn(async () => {}),
      startTransaction: vi.fn(async () => {}),
      commitTransaction: vi.fn(async () => {}),
      rollbackTransaction: vi.fn(async () => {}),
      release: vi.fn(async () => {}),
      manager: { getRepository: () => repo },
    })),
    entityMetadatas: [repo.metadata as any],
    _repo: repo,
  } as any;
}

class UserClass {
  id!: number;
  name!: string;
  email!: string | null;
  age!: number | null;
}

describe("integrations: typeormAdapter", () => {
  let mockDataSource: DataSource & {
    _repo: ReturnType<typeof createMockRepository>;
  };
  let adapter: TypeORMAdapterResult<{ User: typeof UserClass }>;

  beforeEach(() => {
    mockDataSource = createMockDataSource();
    mockDataSource._repo._reset();
    adapter = typeormAdapter(mockDataSource, { entities: { User: UserClass } });
  });

  describe("basic setup", () => {
    it("extracts entity definitions", () => {
      expect(adapter.entities.User).toBeDefined();
      expect(adapter.entities.User.name).toBe("User");
    });

    it("exposes native DataSource via db.native", () => {
      expect(adapter.native).toBe(mockDataSource);
    });

    it("detects dialect from DataSource options", () => {
      expect(adapter.dialect).toBe("postgresql");
    });

    it("sets capabilities based on dialect", () => {
      expect(adapter.capabilities.supportsJSON).toBe(true);
      expect(adapter.capabilities.supportsTransactions).toBe(true);
      expect(adapter.capabilities.supportsArrays).toBe(true);
    });

    it("allows manual dialect override", () => {
      const mysqlAdapter = typeormAdapter(mockDataSource, {
        entities: { User: UserClass },
        dialect: "mysql",
      });
      expect(mysqlAdapter.dialect).toBe("mysql");
      expect(mysqlAdapter.capabilities.supportsArrays).toBe(false);
    });
  });

  describe("model.findOne", () => {
    beforeEach(async () => {
      await adapter
        .model("User")
        .create({ name: "Alice", email: "alice@example.com", age: 30 });
      await adapter
        .model("User")
        .create({ name: "Bob", email: "bob@example.com", age: 25 });
    });

    it("returns single object when found", async () => {
      const user = await adapter.model("User").findOne({ where: { id: 1 } });

      expect(user).not.toBeNull();
      expect(user?.name).toBe("Alice");
    });

    it("returns null when not found", async () => {
      const user = await adapter.model("User").findOne({ where: { id: 999 } });

      expect(user).toBeNull();
    });
  });

  describe("model.findMany", () => {
    beforeEach(async () => {
      await adapter
        .model("User")
        .create({ name: "Alice", email: "alice@example.com", age: 30 });
      await adapter
        .model("User")
        .create({ name: "Bob", email: "bob@example.com", age: 25 });
      await adapter
        .model("User")
        .create({ name: "Charlie", email: "charlie@example.com", age: 35 });
    });

    it("returns array of objects", async () => {
      const users = await adapter.model("User").findMany();

      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBe(3);
    });

    it("supports where clause", async () => {
      const users = await adapter
        .model("User")
        .findMany({ where: { age: { gt: 26 } } });

      expect(users.length).toBe(2);
    });

    it("supports limit", async () => {
      const users = await adapter.model("User").findMany({ limit: 2 });

      expect(users.length).toBe(2);
    });

    it("supports offset", async () => {
      const users = await adapter.model("User").findMany({ offset: 1 });

      expect(users.length).toBe(2);
    });

    it("supports orderBy", async () => {
      const users = await adapter
        .model("User")
        .findMany({ orderBy: { age: "desc" } });

      expect(users[0].name).toBe("Charlie");
      expect(users[2].name).toBe("Bob");
    });
  });

  describe("model.create", () => {
    it("creates and returns new record", async () => {
      const user = await adapter
        .model("User")
        .create({ name: "Diana", email: "diana@example.com", age: 28 });

      expect(user.name).toBe("Diana");
      expect(user.id).toBe(1);
    });
  });

  describe("model.createMany", () => {
    it("creates multiple records and returns count", async () => {
      const result = await adapter.model("User").createMany([
        { name: "Alice", email: "alice@example.com" },
        { name: "Bob", email: "bob@example.com" },
      ]);

      expect(result.count).toBe(2);
    });
  });

  describe("model.update", () => {
    beforeEach(async () => {
      await adapter
        .model("User")
        .create({ name: "Alice", email: "alice@example.com", age: 30 });
    });

    it("updates and returns modified record", async () => {
      const updated = await adapter
        .model("User")
        .update({ where: { id: 1 }, data: { age: 31 } });

      expect(updated?.age).toBe(31);
      expect(updated?.name).toBe("Alice");
    });

    it("returns null when no match", async () => {
      const updated = await adapter
        .model("User")
        .update({ where: { id: 999 }, data: { age: 31 } });

      expect(updated).toBeNull();
    });
  });

  describe("model.delete", () => {
    beforeEach(async () => {
      await adapter
        .model("User")
        .create({ name: "Alice", email: "alice@example.com", age: 30 });
    });

    it("deletes and returns deleted record", async () => {
      const deleted = await adapter.model("User").delete({ where: { id: 1 } });

      expect(deleted?.name).toBe("Alice");
    });

    it("throws when where clause is empty", async () => {
      await expect(adapter.model("User").delete({ where: {} })).rejects.toThrow(
        "delete() requires a where clause",
      );
    });
  });

  describe("model.deleteMany", () => {
    beforeEach(async () => {
      await adapter
        .model("User")
        .create({ name: "Alice", email: "alice@example.com", age: 30 });
      await adapter
        .model("User")
        .create({ name: "Bob", email: "bob@example.com", age: 25 });
    });

    it("deletes multiple records and returns count", async () => {
      const result = await adapter
        .model("User")
        .deleteMany({ where: { age: { lte: 30 } } });

      expect(result.count).toBe(2);
    });

    it("throws when where clause is empty", async () => {
      await expect(
        adapter.model("User").deleteMany({ where: {} }),
      ).rejects.toThrow("deleteMany() requires a where clause");
    });
  });

  describe("model.count", () => {
    beforeEach(async () => {
      await adapter
        .model("User")
        .create({ name: "Alice", email: "alice@example.com", age: 30 });
      await adapter
        .model("User")
        .create({ name: "Bob", email: "bob@example.com", age: 25 });
    });

    it("returns count of all records", async () => {
      const count = await adapter.model("User").count();

      expect(count).toBe(2);
    });

    it("returns count with where clause", async () => {
      const count = await adapter.model("User").count({ where: { age: 30 } });

      expect(count).toBe(1);
    });
  });

  describe("transactions", () => {
    it("executes operations within transaction", async () => {
      const result = await adapter.transaction(async (tx) => {
        const user = await tx
          .model("User")
          .create({ name: "TxUser", email: "tx@example.com" });
        return user;
      });

      expect(result.name).toBe("TxUser");
    });

    it("provides native manager in transaction", async () => {
      await adapter.transaction(async (tx) => {
        expect(tx.native).toBeDefined();
      });
    });
  });

  describe("dispose", () => {
    it("calls destroy on DataSource", async () => {
      await adapter.dispose();

      expect(mockDataSource.destroy).toHaveBeenCalled();
    });
  });
});

describe("integrations: typeormAdapter: dialect detection", () => {
  const createDataSourceWithType = (type: string) =>
    ({
      isInitialized: true,
      options: { type, entities: [] },
      initialize: vi.fn(),
      destroy: vi.fn(),
      getRepository: vi.fn(),
      transaction: vi.fn(),
      createQueryRunner: vi.fn(),
      entityMetadatas: [],
    }) as unknown as DataSource;

  it("detects postgresql from type", () => {
    const adapter = typeormAdapter(createDataSourceWithType("postgres"), {
      entities: {},
    });
    expect(adapter.dialect).toBe("postgresql");
  });

  it("detects mysql from type", () => {
    const adapter = typeormAdapter(createDataSourceWithType("mysql"), {
      entities: {},
    });
    expect(adapter.dialect).toBe("mysql");
  });

  it("detects sqlite from type", () => {
    const adapter = typeormAdapter(createDataSourceWithType("sqlite"), {
      entities: {},
    });
    expect(adapter.dialect).toBe("sqlite");
  });

  it("detects better-sqlite3 from type", () => {
    const adapter = typeormAdapter(createDataSourceWithType("better-sqlite3"), {
      entities: {},
    });
    expect(adapter.dialect).toBe("sqlite");
  });

  it("detects mariadb as mysql", () => {
    const adapter = typeormAdapter(createDataSourceWithType("mariadb"), {
      entities: {},
    });
    expect(adapter.dialect).toBe("mysql");
  });
});

describe("integrations: typeormAdapter: capabilities", () => {
  const createDataSourceWithType = (type: string) =>
    ({
      isInitialized: true,
      options: { type, entities: [] },
      entityMetadatas: [],
    }) as unknown as DataSource;

  it("postgresql has full capabilities", () => {
    const adapter = typeormAdapter(createDataSourceWithType("postgres"), {
      entities: {},
    });

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
    const adapter = typeormAdapter(createDataSourceWithType("mysql"), {
      entities: {},
    });

    expect(adapter.capabilities.supportsArrays).toBe(false);
    expect(adapter.capabilities.supportsUUIDs).toBe(false);
  });

  it("sqlite has most limited capabilities", () => {
    const adapter = typeormAdapter(createDataSourceWithType("sqlite"), {
      entities: {},
    });

    expect(adapter.capabilities.supportsBooleans).toBe(false);
    expect(adapter.capabilities.supportsArrays).toBe(false);
    expect(adapter.capabilities.supportsDates).toBe(false);
    expect(adapter.capabilities.supportsUUIDs).toBe(false);
  });
});

// ============================================================================
// Real Database Tests
// ============================================================================

describe("integrations: typeormAdapter: real DB: sqlite", async () => {
  let dataSource: any;
  let adapter: TypeORMAdapterResult<{ User: any }>;
  let UserEntitySchema: any;

  beforeAll(async () => {
    const typeorm = await import("typeorm");

    UserEntitySchema = new typeorm.EntitySchema({
      name: "User",
      tableName: "typeorm_test_users",
      columns: {
        id: { type: Number, primary: true, generated: true },
        name: { type: String },
        email: { type: String, nullable: true },
        age: { type: Number, nullable: true },
      },
    });

    dataSource = new typeorm.DataSource({
      type: "better-sqlite3",
      database: ":memory:",
      entities: [UserEntitySchema],
      synchronize: true,
    });

    await dataSource.initialize();
    adapter = typeormAdapter(dataSource, {
      entities: { User: UserEntitySchema },
    });
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    await dataSource.getRepository(UserEntitySchema).clear();
  });

  it("detects sqlite dialect", () => {
    expect(adapter.dialect).toBe("sqlite");
  });

  it("create and findOne", async () => {
    const created = await adapter
      .model("User")
      .create({ name: "Alice", email: "alice@test.com", age: 30 });

    expect(created.name).toBe("Alice");
    expect(created.id).toBeDefined();

    const found = await adapter
      .model("User")
      .findOne({ where: { id: created.id } });

    expect(found?.name).toBe("Alice");
    expect(found?.email).toBe("alice@test.com");
  });

  it("findMany with where and orderBy", async () => {
    await adapter.model("User").create({ name: "Alice", age: 30 });
    await adapter.model("User").create({ name: "Bob", age: 25 });
    await adapter.model("User").create({ name: "Charlie", age: 35 });

    const users = await adapter.model("User").findMany({
      where: { age: { gt: 24 } },
      orderBy: { age: "desc" },
    });

    expect(users.length).toBe(3);
    expect(users[0].name).toBe("Charlie");
    expect(users[2].name).toBe("Bob");
  });

  it("update", async () => {
    const created = await adapter
      .model("User")
      .create({ name: "Alice", age: 30 });

    const updated = await adapter.model("User").update({
      where: { id: created.id },
      data: { age: 31 },
    });

    expect(updated?.age).toBe(31);
  });

  it("delete", async () => {
    const created = await adapter
      .model("User")
      .create({ name: "Alice", age: 30 });

    const deleted = await adapter
      .model("User")
      .delete({ where: { id: created.id } });

    expect(deleted?.name).toBe("Alice");

    const found = await adapter
      .model("User")
      .findOne({ where: { id: created.id } });
    expect(found).toBeNull();
  });

  it("count", async () => {
    await adapter.model("User").create({ name: "Alice", age: 30 });
    await adapter.model("User").create({ name: "Bob", age: 25 });

    const total = await adapter.model("User").count();
    expect(total).toBe(2);

    const filtered = await adapter
      .model("User")
      .count({ where: { age: { gte: 30 } } });
    expect(filtered).toBe(1);
  });

  it("transaction commits on success", async () => {
    await adapter.transaction(async (tx) => {
      await tx.model("User").create({ name: "TxUser", email: "tx@test.com" });
    });

    const found = await adapter
      .model("User")
      .findOne({ where: { name: "TxUser" } });
    expect(found).not.toBeNull();
  });

  it("transaction rolls back on error", async () => {
    try {
      await adapter.transaction(async (tx) => {
        await tx.model("User").create({ name: "RollbackUser" });
        throw new Error("Test rollback");
      });
    } catch {
      // Expected
    }

    const found = await adapter
      .model("User")
      .findOne({ where: { name: "RollbackUser" } });
    expect(found).toBeNull();
  });
});

describe.runIf(process.env.POSTGRESQL_URL)(
  "integrations: typeormAdapter: real DB: postgresql",
  async () => {
    let dataSource: any;
    let adapter: TypeORMAdapterResult<{ User: any }>;
    let UserEntitySchema: any;

    beforeAll(async () => {
      const typeorm = await import("typeorm");

      UserEntitySchema = new typeorm.EntitySchema({
        name: "User",
        tableName: "typeorm_pg_test_users",
        columns: {
          id: { type: Number, primary: true, generated: true },
          name: { type: String },
          email: { type: String, nullable: true },
          age: { type: Number, nullable: true },
        },
      });

      dataSource = new typeorm.DataSource({
        type: "postgres",
        url: process.env.POSTGRESQL_URL,
        entities: [UserEntitySchema],
        synchronize: true,
      });

      await dataSource.initialize();
      adapter = typeormAdapter(dataSource, {
        entities: { User: UserEntitySchema },
      });
    });

    afterAll(async () => {
      if (dataSource?.isInitialized) {
        // Drop the test table
        await dataSource.query("DROP TABLE IF EXISTS typeorm_pg_test_users");
        await dataSource.destroy();
      }
    });

    beforeEach(async () => {
      await dataSource.query("DELETE FROM typeorm_pg_test_users");
    });

    it("detects postgresql dialect", () => {
      expect(adapter.dialect).toBe("postgresql");
    });

    it("create and findOne", async () => {
      const created = await adapter
        .model("User")
        .create({ name: "Alice", email: "alice@test.com", age: 30 });

      expect(created.name).toBe("Alice");
      expect(created.id).toBeDefined();

      const found = await adapter
        .model("User")
        .findOne({ where: { id: created.id } });

      expect(found?.name).toBe("Alice");
    });

    it("findMany with operators", async () => {
      await adapter.model("User").create({ name: "Alice", age: 30 });
      await adapter.model("User").create({ name: "Bob", age: 25 });
      await adapter.model("User").create({ name: "Charlie", age: 35 });

      const users = await adapter.model("User").findMany({
        where: { age: { in: [25, 35] } },
        orderBy: { name: "asc" },
      });

      expect(users.length).toBe(2);
      expect(users[0].name).toBe("Bob");
      expect(users[1].name).toBe("Charlie");
    });

    it("updateMany", async () => {
      await adapter.model("User").create({ name: "Alice", age: 30 });
      await adapter.model("User").create({ name: "Bob", age: 30 });

      const updated = await adapter.model("User").updateMany({
        where: { age: 30 },
        data: { age: 31 },
      });

      expect(updated.length).toBe(2);
      expect(updated[0].age).toBe(31);
    });

    it("deleteMany", async () => {
      await adapter.model("User").create({ name: "Alice", age: 30 });
      await adapter.model("User").create({ name: "Bob", age: 25 });

      const result = await adapter.model("User").deleteMany({
        where: { age: { lte: 30 } },
      });

      expect(result.count).toBe(2);
    });

    it("transaction", async () => {
      await adapter.transaction(async (tx) => {
        await tx.model("User").create({ name: "TxUser" });
        const count = await tx.model("User").count();
        expect(count).toBe(1);
      });

      const found = await adapter
        .model("User")
        .findOne({ where: { name: "TxUser" } });
      expect(found).not.toBeNull();
    });
  },
);

describe.runIf(process.env.MYSQL_URL)(
  "integrations: typeormAdapter: real DB: mysql",
  async () => {
    let dataSource: any;
    let adapter: TypeORMAdapterResult<{ User: any }>;
    let UserEntitySchema: any;

    beforeAll(async () => {
      const typeorm = await import("typeorm");

      UserEntitySchema = new typeorm.EntitySchema({
        name: "User",
        tableName: "typeorm_mysql_test_users",
        columns: {
          id: { type: Number, primary: true, generated: true },
          name: { type: String, length: 255 },
          email: { type: String, length: 255, nullable: true },
          age: { type: Number, nullable: true },
        },
      });

      dataSource = new typeorm.DataSource({
        type: "mysql",
        url: process.env.MYSQL_URL,
        entities: [UserEntitySchema],
        synchronize: true,
      });

      await dataSource.initialize();
      adapter = typeormAdapter(dataSource, {
        entities: { User: UserEntitySchema },
      });
    });

    afterAll(async () => {
      if (dataSource?.isInitialized) {
        await dataSource.query("DROP TABLE IF EXISTS typeorm_mysql_test_users");
        await dataSource.destroy();
      }
    });

    beforeEach(async () => {
      await dataSource.query("DELETE FROM typeorm_mysql_test_users");
    });

    it("detects mysql dialect", () => {
      expect(adapter.dialect).toBe("mysql");
    });

    it("create and findOne", async () => {
      const created = await adapter
        .model("User")
        .create({ name: "Alice", email: "alice@test.com", age: 30 });

      expect(created.name).toBe("Alice");

      const found = await adapter
        .model("User")
        .findOne({ where: { name: "Alice" } });
      expect(found?.email).toBe("alice@test.com");
    });

    it("findMany with limit and offset", async () => {
      await adapter.model("User").create({ name: "Alice", age: 30 });
      await adapter.model("User").create({ name: "Bob", age: 25 });
      await adapter.model("User").create({ name: "Charlie", age: 35 });

      const users = await adapter.model("User").findMany({
        orderBy: { age: "asc" },
        limit: 2,
        offset: 1,
      });

      expect(users.length).toBe(2);
      expect(users[0].name).toBe("Alice");
      expect(users[1].name).toBe("Charlie");
    });

    it("count with where", async () => {
      await adapter.model("User").create({ name: "Alice", age: 30 });
      await adapter.model("User").create({ name: "Bob", age: 25 });

      const count = await adapter
        .model("User")
        .count({ where: { age: { gt: 26 } } });

      expect(count).toBe(1);
    });
  },
);

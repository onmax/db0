import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createDatabase } from "../../src";

// Mock the global sqlitePlugin
function createMockSqlitePlugin() {
  const mockData: Map<string, unknown[]> = new Map();

  const createResultSet = (rows: unknown[]) => ({
    insertId: 1,
    rowsAffected: 1,
    rows: {
      length: rows.length,
      item: (index: number) => rows[index],
    },
  });

  const mockTransaction = {
    executeSql: vi.fn(
      (
        sql: string,
        params: unknown[],
        successCallback?: (tx: unknown, resultSet: unknown) => void,
        _errorCallback?: (tx: unknown, error: Error) => boolean,
      ) => {
        const tableName =
          sql.match(/FROM\s+(\w+)/i)?.[1] || sql.match(/INTO\s+(\w+)/i)?.[1];

        if (sql.toLowerCase().includes("select") && tableName) {
          const rows = mockData.get(tableName) || [];
          successCallback?.(mockTransaction, createResultSet(rows));
        } else if (sql.toLowerCase().includes("insert") && tableName) {
          const existing = mockData.get(tableName) || [];
          mockData.set(tableName, [
            ...existing,
            { id: params?.[0], name: params?.[1] },
          ]);
          successCallback?.(mockTransaction, createResultSet([]));
        } else {
          successCallback?.(mockTransaction, createResultSet([]));
        }
      },
    ),
  };

  const mockDb = {
    transaction: vi.fn(
      (
        fn: (tx: unknown) => void,
        errorCallback?: (error: Error) => void,
        _successCallback?: () => void,
      ) => {
        try {
          fn(mockTransaction);
        } catch (error) {
          errorCallback?.(error as Error);
        }
      },
    ),
    executeSql: vi.fn(
      (
        sql: string,
        params: unknown[],
        successCallback?: (resultSet: unknown) => void,
        _errorCallback?: (error: Error) => void,
      ) => {
        const tableName =
          sql.match(/FROM\s+(\w+)/i)?.[1] || sql.match(/INTO\s+(\w+)/i)?.[1];

        if (sql.toLowerCase().includes("select") && tableName) {
          const rows = mockData.get(tableName) || [];
          successCallback?.(createResultSet(rows));
        } else if (sql.toLowerCase().includes("insert") && tableName) {
          const existing = mockData.get(tableName) || [];
          mockData.set(tableName, [
            ...existing,
            { id: params?.[0], name: params?.[1] },
          ]);
          successCallback?.(createResultSet([]));
        } else {
          successCallback?.(createResultSet([]));
        }
      },
    ),
    close: vi.fn(
      (
        successCallback?: () => void,
        _errorCallback?: (error: Error) => void,
      ) => {
        successCallback?.();
      },
    ),
    _mockData: mockData,
    _mockTransaction: mockTransaction,
  };

  return {
    openDatabase: vi.fn(() => mockDb),
    _mockDb: mockDb,
    _mockData: mockData,
  };
}

describe("connectors: cordova-sqlite (mocked)", () => {
  let mockPlugin: ReturnType<typeof createMockSqlitePlugin>;

  beforeEach(() => {
    mockPlugin = createMockSqlitePlugin();
    // @ts-expect-error - Setting global for test
    globalThis.sqlitePlugin = mockPlugin;
  });

  afterEach(() => {
    // @ts-expect-error - Cleaning up global
    delete globalThis.sqlitePlugin;
  });

  it("creates database with correct dialect", async () => {
    // Dynamic import to pick up the global
    const { default: connector } = await import(
      "../../src/connectors/cordova-sqlite"
    );
    const db = createDatabase(connector({ name: "test.db" }));
    expect(db.dialect).toBe("sqlite");
  });

  it("has correct capabilities", async () => {
    const { default: connector } = await import(
      "../../src/connectors/cordova-sqlite"
    );
    const db = createDatabase(connector({ name: "test.db" }));
    expect(db.capabilities).toEqual({
      supportsJSON: false,
      supportsBooleans: false,
      supportsArrays: false,
      supportsDates: false,
      supportsUUIDs: false,
      supportsTransactions: true,
      supportsBatch: true,
    });
  });

  it("openDatabase called with correct options", async () => {
    const { default: connector } = await import(
      "../../src/connectors/cordova-sqlite"
    );
    const db = createDatabase(
      connector({ name: "mydb.db", location: "Library" }),
    );
    await db.getInstance();
    expect(mockPlugin.openDatabase).toHaveBeenCalledWith({
      name: "mydb.db",
      location: "Library",
      iosDatabaseLocation: undefined,
      androidDatabaseProvider: undefined,
    });
  });

  it("prepare().all() returns rows", async () => {
    const { default: connector } = await import(
      "../../src/connectors/cordova-sqlite"
    );
    const db = createDatabase(connector({ name: "test.db" }));
    mockPlugin._mockData.set("users", [
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
    ]);

    const result = await db.prepare("SELECT * FROM users").all();
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: "1", name: "Alice" });
  });

  it("prepare().get() returns first row", async () => {
    const { default: connector } = await import(
      "../../src/connectors/cordova-sqlite"
    );
    const db = createDatabase(connector({ name: "test.db" }));
    mockPlugin._mockData.set("users", [{ id: "1", name: "Alice" }]);

    const result = await db
      .prepare("SELECT * FROM users WHERE id = ?")
      .get("1");
    expect(result).toEqual({ id: "1", name: "Alice" });
  });

  it("prepare().run() executes statement", async () => {
    const { default: connector } = await import(
      "../../src/connectors/cordova-sqlite"
    );
    const db = createDatabase(connector({ name: "test.db" }));

    const result = await db
      .prepare("INSERT INTO users (id, name) VALUES (?, ?)")
      .run("1", "Bob");
    expect(result.success).toBe(true);
    expect(mockPlugin._mockDb.executeSql).toHaveBeenCalled();
  });

  it("dispose closes the database", async () => {
    const { default: connector } = await import(
      "../../src/connectors/cordova-sqlite"
    );
    const db = createDatabase(connector({ name: "test.db" }));
    await db.getInstance(); // Initialize
    await db.dispose();
    expect(mockPlugin._mockDb.close).toHaveBeenCalled();
  });

  describe("transactions", () => {
    it("beginTransaction starts a transaction", async () => {
      const { default: connector } = await import(
        "../../src/connectors/cordova-sqlite"
      );
      const db = createDatabase(connector({ name: "test.db" }));
      const tx = await db.beginTransaction();
      expect(mockPlugin._mockDb.transaction).toHaveBeenCalled();
      expect(tx).toBeDefined();
      expect(tx.commit).toBeDefined();
      expect(tx.rollback).toBeDefined();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import connector from "../../src/connectors/capacitor-sqlite";
import { createDatabase } from "../../src";

// Mock SQLiteDBConnection interface
function createMockConnection() {
  const data: Map<string, unknown[]> = new Map();

  return {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      // Simple mock: return stored data for SELECT
      const tableName = sql.match(/FROM\s+(\w+)/i)?.[1];
      if (tableName && data.has(tableName)) {
        return { values: data.get(tableName) };
      }
      return { values: [] };
    }),
    run: vi.fn(async (sql: string, params?: unknown[]) => {
      // Simple mock: track INSERT/UPDATE/DELETE
      const tableName =
        sql.match(/INTO\s+(\w+)/i)?.[1] || sql.match(/UPDATE\s+(\w+)/i)?.[1];
      if (tableName && sql.toLowerCase().includes("insert")) {
        const existing = data.get(tableName) || [];
        data.set(tableName, [
          ...existing,
          { id: params?.[0], name: params?.[1] },
        ]);
      }
      return { changes: { changes: 1, lastId: 1 } };
    }),
    execute: vi.fn(async () => ({ changes: { changes: 0 } })),
    close: vi.fn(async () => {}),
    // Store reference for test assertions
    _mockData: data,
  };
}

describe("connectors: capacitor-sqlite (mocked)", () => {
  let mockConnection: ReturnType<typeof createMockConnection>;

  beforeEach(() => {
    mockConnection = createMockConnection();
  });

  it("creates database with correct dialect", () => {
    const db = createDatabase(connector({ connection: mockConnection as any }));
    expect(db.dialect).toBe("sqlite");
  });

  it("has correct capabilities", () => {
    const db = createDatabase(connector({ connection: mockConnection as any }));
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

  it("getInstance returns the connection", async () => {
    const db = createDatabase(connector({ connection: mockConnection as any }));
    const instance = await db.getInstance();
    expect(instance).toBe(mockConnection);
  });

  it("exec calls query", async () => {
    const db = createDatabase(connector({ connection: mockConnection as any }));
    await db.exec("CREATE TABLE test (id TEXT)");
    expect(mockConnection.run).toHaveBeenCalled();
  });

  it("prepare().all() calls query for SELECT", async () => {
    const db = createDatabase(connector({ connection: mockConnection as any }));
    mockConnection._mockData.set("users", [{ id: "1", name: "Alice" }]);

    const result = await db.prepare("SELECT * FROM users").all();
    expect(mockConnection.query).toHaveBeenCalled();
    expect(result).toEqual([{ id: "1", name: "Alice" }]);
  });

  it("prepare().run() calls run for INSERT", async () => {
    const db = createDatabase(connector({ connection: mockConnection as any }));
    const result = await db
      .prepare("INSERT INTO users (id, name) VALUES (?, ?)")
      .run("1", "Bob");
    expect(mockConnection.run).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it("prepare().get() returns first row", async () => {
    const db = createDatabase(connector({ connection: mockConnection as any }));
    mockConnection._mockData.set("users", [
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
    ]);

    const result = await db
      .prepare("SELECT * FROM users WHERE id = ?")
      .get("1");
    expect(result).toEqual({ id: "1", name: "Alice" });
  });

  it("dispose closes the connection", async () => {
    const db = createDatabase(connector({ connection: mockConnection as any }));
    await db.dispose();
    expect(mockConnection.close).toHaveBeenCalled();
  });

  describe("transactions", () => {
    it("beginTransaction executes BEGIN", async () => {
      const db = createDatabase(
        connector({ connection: mockConnection as any }),
      );
      await db.beginTransaction();
      expect(mockConnection.execute).toHaveBeenCalledWith("BEGIN TRANSACTION");
    });

    it("commit executes COMMIT", async () => {
      const db = createDatabase(
        connector({ connection: mockConnection as any }),
      );
      const tx = await db.beginTransaction();
      await tx.commit();
      expect(mockConnection.execute).toHaveBeenCalledWith("COMMIT");
    });

    it("rollback executes ROLLBACK", async () => {
      const db = createDatabase(
        connector({ connection: mockConnection as any }),
      );
      const tx = await db.beginTransaction();
      await tx.rollback();
      expect(mockConnection.execute).toHaveBeenCalledWith("ROLLBACK");
    });
  });
});

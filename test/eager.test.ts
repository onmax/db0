import { describe, expect, it } from "vitest";
import { createDatabase } from "../src";
import type { Connector } from "../src";

function createSyncConnector(): Connector<{ value: string }> {
  let instance: { value: string } | undefined;
  return {
    name: "sync-test",
    dialect: "sqlite",
    capabilities: {
      supportsBooleans: false,
      supportsDates: false,
      supportsJSON: false,
      supportsArrays: false,
      supportsUUIDs: false,
      supportsTransactions: true,
      supportsBatch: false,
    },
    getInstance: () => {
      if (!instance) instance = { value: "sync-instance" };
      return instance;
    },
    exec: () => ({}),
    prepare: () => ({
      bind: () => ({
        all: async () => [],
        run: async () => ({ success: true }),
        get: async () => undefined,
      }),
      all: async () => [],
      run: async () => ({ success: true }),
      get: async () => undefined,
    }),
  };
}

function createAsyncConnector(): Connector<{ value: string }> {
  let instance: { value: string } | undefined;
  let connectionPromise: Promise<{ value: string }> | undefined;
  return {
    name: "async-test",
    dialect: "postgresql",
    capabilities: {
      supportsBooleans: true,
      supportsDates: true,
      supportsJSON: true,
      supportsArrays: true,
      supportsUUIDs: true,
      supportsTransactions: true,
      supportsBatch: true,
    },
    getInstance: () => {
      if (instance) return instance;
      if (!connectionPromise) {
        connectionPromise = new Promise((resolve) => {
          setTimeout(() => {
            instance = { value: "async-instance" };
            resolve(instance);
          }, 10);
        });
      }
      return connectionPromise;
    },
    exec: () => ({}),
    prepare: () => ({
      bind: () => ({
        all: async () => [],
        run: async () => ({ success: true }),
        get: async () => undefined,
      }),
      all: async () => [],
      run: async () => ({ success: true }),
      get: async () => undefined,
    }),
  };
}

describe("eager initialization", () => {
  describe("without eager option (default behavior)", () => {
    it("getInstance returns Promise for sync connector", async () => {
      const db = createDatabase(createSyncConnector());
      const result = db.getInstance();
      expect(result).toBeInstanceOf(Promise);
      expect(await result).toEqual({ value: "sync-instance" });
    });

    it("getInstance returns Promise for async connector", async () => {
      const db = createDatabase(createAsyncConnector());
      const result = db.getInstance();
      expect(result).toBeInstanceOf(Promise);
      expect(await result).toEqual({ value: "async-instance" });
    });

    it("ready() resolves immediately", async () => {
      const db = createDatabase(createSyncConnector());
      const start = Date.now();
      await db.ready();
      expect(Date.now() - start).toBeLessThan(5);
    });
  });

  describe("with eager: true", () => {
    it("sync connector: getInstance returns sync after creation", async () => {
      const db = createDatabase(createSyncConnector(), { eager: true });
      await db.ready();
      const result = db.getInstance();
      // Should not be a Promise
      expect(result).not.toBeInstanceOf(Promise);
      expect(result).toEqual({ value: "sync-instance" });
    });

    it("async connector: getInstance returns sync after ready()", async () => {
      const db = createDatabase(createAsyncConnector(), { eager: true });
      // Before ready, connection is being established
      await db.ready();
      // After ready, getInstance should return sync
      const result = db.getInstance();
      expect(result).not.toBeInstanceOf(Promise);
      expect(result).toEqual({ value: "async-instance" });
    });

    it("async connector: ready() waits for connection", async () => {
      const db = createDatabase(createAsyncConnector(), { eager: true });
      const start = Date.now();
      await db.ready();
      // Should have waited for the async connection (10ms timeout)
      expect(Date.now() - start).toBeGreaterThanOrEqual(8);
    });

    it("ready() can be called multiple times", async () => {
      const db = createDatabase(createAsyncConnector(), { eager: true });
      await db.ready();
      await db.ready();
      await db.ready();
      const result = db.getInstance();
      expect(result).toEqual({ value: "async-instance" });
    });
  });

  describe("backward compatibility", () => {
    it("createDatabase without options works as before", async () => {
      const db = createDatabase(createSyncConnector());
      expect(await db.getInstance()).toEqual({ value: "sync-instance" });
    });

    it("createDatabase with empty options works as before", async () => {
      const db = createDatabase(createSyncConnector(), {});
      expect(await db.getInstance()).toEqual({ value: "sync-instance" });
    });

    it("createDatabase with eager: false works as before", async () => {
      const db = createDatabase(createSyncConnector(), { eager: false });
      const result = db.getInstance();
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe("disposal", () => {
    it("ready() throws after dispose", async () => {
      const db = createDatabase(createSyncConnector(), { eager: true });
      await db.dispose();
      let err: Error | undefined;
      try {
        db.ready();
      } catch (error_) {
        err = error_ as Error;
      }
      expect(err?.message).toContain("disposed");
    });

    it("getInstance() throws after dispose", async () => {
      const db = createDatabase(createSyncConnector(), { eager: true });
      await db.ready();
      await db.dispose();
      expect(() => db.getInstance()).toThrow("disposed");
    });
  });
});

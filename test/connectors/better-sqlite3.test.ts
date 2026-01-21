import { describe, it, expect } from "vitest";
import connector from "../../src/connectors/better-sqlite3";
import { createDatabase } from "../../src";
import { testConnector } from "./_tests";

describe("connectors: better-sqlite3", () => {
  testConnector({
    dialect: "sqlite",
    connector: connector({
      name: ":memory:",
    }),
  });

  describe("eager initialization", () => {
    it("getInstance returns sync after ready() with eager: true", async () => {
      const db = createDatabase(connector({ name: ":memory:" }), {
        eager: true,
      });
      await db.ready();
      const instance = db.getInstance();
      expect(instance).not.toBeInstanceOf(Promise);
      expect(instance).toBeDefined();
      await db.dispose();
    });

    it("ready() resolves immediately for sync connector", async () => {
      const db = createDatabase(connector({ name: ":memory:" }), {
        eager: true,
      });
      const start = Date.now();
      await db.ready();
      expect(Date.now() - start).toBeLessThan(50);
      await db.dispose();
    });

    it("backward compatible - works without eager option", async () => {
      const db = createDatabase(connector({ name: ":memory:" }));
      const instance = db.getInstance();
      expect(instance).toBeInstanceOf(Promise);
      expect(await instance).toBeDefined();
      await db.dispose();
    });
  });
});

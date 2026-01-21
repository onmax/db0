import { getPlatformProxy, type PlatformProxy } from "wrangler";
import { afterAll, beforeAll, describe, it, expect } from "vitest";
import cloudflareD1 from "../../../src/connectors/cloudflare-d1";
import { createDatabase } from "../../../src";
import { testConnector } from "../_tests";
import { fileURLToPath } from "node:url";

describe("connectors: cloudflare-d1", () => {
  let platformProxy: PlatformProxy;

  beforeAll(async () => {
    platformProxy = await getPlatformProxy({
      configPath: fileURLToPath(new URL("wrangler-d1.toml", import.meta.url)),
    });
    (globalThis as any).__env__ = platformProxy.env;
  });

  afterAll(async () => {
    await platformProxy?.dispose();
    (globalThis as any).__env__ = undefined;
  });

  testConnector({
    dialect: "sqlite",
    connector: cloudflareD1({
      bindingName: "test",
    }),
    skipTransactions: true, // D1 uses batch API for transactions, not raw BEGIN/COMMIT
  });

  describe("eager initialization", () => {
    it("getInstance returns sync after ready() with eager: true", async () => {
      const db = createDatabase(cloudflareD1({ bindingName: "test" }), {
        eager: true,
      });
      await db.ready();
      const instance = db.getInstance();
      expect(instance).not.toBeInstanceOf(Promise);
      expect(instance).toBeDefined();
    });

    it("ready() resolves immediately for sync connector", async () => {
      const db = createDatabase(cloudflareD1({ bindingName: "test" }), {
        eager: true,
      });
      const start = Date.now();
      await db.ready();
      expect(Date.now() - start).toBeLessThan(50);
    });

    it("backward compatible - works without eager option", async () => {
      const db = createDatabase(cloudflareD1({ bindingName: "test" }));
      const instance = db.getInstance();
      expect(instance).toBeInstanceOf(Promise);
      expect(await instance).toBeDefined();
    });
  });
});

import type { Connector, Primitive, SQLDialect } from "db0";
import { BoundableStatement } from "./_internal/statement.ts";

export interface ConnectorOptions {
  url: string;
  headers?: Record<string, string>;
  dialect?: SQLDialect;
}

interface DatabaseResponse {
  rows?: unknown[];
  success: boolean;
  lastInsertRowid?: number;
  changes?: number;
  error?: string;
}

type InternalQuery = (
  sql: string,
  params?: Primitive[],
  method?: "GET" | "POST",
) => Promise<DatabaseResponse>;

export default function httpConnector(
  opts: ConnectorOptions,
): Connector<undefined> {
  const baseUrl = opts.url.replace(/\/$/, "");
  const headers = { "Content-Type": "application/json", ...opts.headers };

  const query: InternalQuery = async (sql, params = [], method) => {
    const useGet = method === "GET" || (!method && isSelectQuery(sql));

    if (useGet) {
      const url = new URL(baseUrl);
      url.searchParams.set("sql", sql);
      if (params.length > 0) {
        url.searchParams.set("params", JSON.stringify(params));
      }

      const response = await fetch(url.toString(), { method: "GET", headers });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json() as Promise<DatabaseResponse>;
    }

    const response = await fetch(baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ sql, params }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json() as Promise<DatabaseResponse>;
  };

  return {
    name: "http",
    dialect: opts.dialect || "sqlite",
    capabilities: {
      supportsJSON: true,
      supportsBooleans: false,
      supportsArrays: false,
      supportsDates: false,
      supportsUUIDs: false,
      supportsTransactions: false,
      supportsBatch: false,
    },
    getInstance: () => undefined,
    exec: async (sql) => {
      const result = await query(sql, [], "POST");
      if (!result.success && result.error) {
        throw new Error(result.error);
      }
      return result;
    },
    prepare: (sql) => new StatementWrapper(sql, query),
  };
}

function isSelectQuery(sql: string): boolean {
  const trimmed = sql.trim().toUpperCase();
  return (
    trimmed.startsWith("SELECT") ||
    trimmed.startsWith("WITH") ||
    trimmed.startsWith("EXPLAIN")
  );
}

class StatementWrapper extends BoundableStatement<void> {
  #query: InternalQuery;
  #sql: string;

  constructor(sql: string, query: InternalQuery) {
    super();
    this.#sql = sql;
    this.#query = query;
  }

  async all(...params: Primitive[]) {
    const result = await this.#query(this.#sql, params);
    if (!result.success && result.error) {
      throw new Error(result.error);
    }
    return result.rows || [];
  }

  async run(...params: Primitive[]) {
    const result = await this.#query(this.#sql, params, "POST");
    if (!result.success && result.error) {
      throw new Error(result.error);
    }
    return {
      success: result.success,
      lastInsertRowid: result.lastInsertRowid,
      changes: result.changes,
    };
  }

  async get(...params: Primitive[]) {
    const result = await this.#query(this.#sql, params);
    if (!result.success && result.error) {
      throw new Error(result.error);
    }
    return result.rows?.[0];
  }
}

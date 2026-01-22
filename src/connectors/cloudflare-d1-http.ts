import type { Connector, Primitive } from "db0";
import { BoundableStatement } from "./_internal/statement.ts";

export interface ConnectorOptions {
  accountId: string;
  databaseId: string;
  apiToken: string;
}

interface D1HttpResponse {
  result: Array<{
    results: unknown[];
    success: boolean;
    meta?: {
      duration?: number;
      changes?: number;
      last_row_id?: number;
      served_by?: string;
    };
  }>;
  success: boolean;
  errors: Array<{ message: string; code: number }>;
  messages: string[];
}

type InternalQuery = (
  sql: string,
  params?: Primitive[],
) => Promise<{
  results: unknown[];
  meta?: D1HttpResponse["result"][0]["meta"];
}>;

export interface D1HttpInstance {
  accountId: string;
  databaseId: string;
}

export default function cloudflareD1HttpConnector(
  opts: ConnectorOptions,
): Connector<D1HttpInstance> {
  const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${opts.accountId}/d1/database/${opts.databaseId}/query`;

  const instance: D1HttpInstance = {
    accountId: opts.accountId,
    databaseId: opts.databaseId,
  };

  const query: InternalQuery = async (sql, params) => {
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params: params || [] }),
    });

    const data = (await response.json()) as D1HttpResponse;

    if (!response.ok || !data.success) {
      const errorMsg =
        data.errors?.map((e) => e.message).join(", ") ||
        `HTTP ${response.status}`;
      throw new Error(`[db0] [cloudflare-d1-http] ${errorMsg}`);
    }

    const result = data.result[0];
    if (!result?.success) {
      throw new Error(`[db0] [cloudflare-d1-http] Query failed`);
    }

    return { results: result.results || [], meta: result.meta };
  };

  return {
    name: "cloudflare-d1-http",
    dialect: "sqlite",
    capabilities: {
      supportsJSON: true,
      supportsBooleans: false,
      supportsArrays: false,
      supportsDates: false,
      supportsUUIDs: false,
      supportsTransactions: false,
      supportsBatch: true,
    },
    getInstance: () => instance,
    exec: (sql) => query(sql),
    prepare: (sql) => new StatementWrapper(sql, query),
  };
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
    const res = await this.#query(this.#sql, params);
    return res.results;
  }

  async run(...params: Primitive[]) {
    const res = await this.#query(this.#sql, params);
    return { success: true, meta: res.meta };
  }

  async get(...params: Primitive[]) {
    const res = await this.#query(this.#sql, params);
    return res.results[0];
  }
}

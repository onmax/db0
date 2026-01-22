import postgres, { type Sql, type Options } from "postgres";
import type { Connector, Primitive } from "db0";
import { BoundableStatement } from "../_internal/statement.ts";
import { normalizeParams, pgCapabilities } from "./_utils.ts";

export type ConnectorOptions =
  | ({ url: string } & Options<Record<string, never>>)
  | Options<Record<string, never>>;

type InternalQuery = (
  sql: string,
  params?: Primitive[],
) => Promise<postgres.RowList<postgres.Row[]>>;

/**
 * PostgreSQL pool connector using postgres.js with connection pooling.
 * Similar to the default postgres connector but with explicit pool configuration.
 */
export default function postgresqlPoolConnector(
  opts: ConnectorOptions,
): Connector<Sql> {
  let _sql: Sql | undefined;

  const getSql = () => {
    if (_sql) return _sql;
    const poolOpts = { max: 10, idle_timeout: 20, ...opts };
    if ("url" in poolOpts) {
      const { url, ...rest } = poolOpts;
      _sql = postgres(url, rest);
    } else {
      _sql = postgres(poolOpts);
    }
    return _sql;
  };

  const query: InternalQuery = async (sql, params) => {
    const client = getSql();
    return client.unsafe(normalizeParams(sql), params as any);
  };

  return {
    name: "postgresql-pool",
    dialect: "postgresql",
    capabilities: { ...pgCapabilities, supportsTransactions: false },
    getInstance: () => getSql(),
    exec: (sql) => query(sql),
    prepare: (sql) => new StatementWrapper(sql, query),
    dispose: async () => {
      if (_sql) {
        await _sql.end();
        _sql = undefined;
      }
    },
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
    return [...res];
  }

  async run(...params: Primitive[]) {
    const res = await this.#query(this.#sql, params);
    return { success: true, rows: [...res], count: res.count };
  }

  async get(...params: Primitive[]) {
    const res = await this.#query(this.#sql, params);
    return res[0];
  }
}

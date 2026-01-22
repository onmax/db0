import type { Pool, PoolClient, PoolConfig, QueryResult } from "pg";
import type {
  Connector,
  ConnectorTransaction,
  Primitive,
  TransactionOptions,
} from "db0";
import { BoundableStatement } from "../_internal/statement.ts";
import { normalizeParams, pgCapabilities } from "./_utils.ts";

export type ConnectorOptions = PoolConfig;

type InternalQuery = (
  sql: string,
  params?: Primitive[],
) => Promise<QueryResult>;

export default function postgresqlPgConnector(
  opts: ConnectorOptions,
): Connector<Pool> {
  let _pool: Pool | undefined;

  const getPool = async () => {
    if (_pool) return _pool;
    const { Pool } = await import("pg");
    _pool = new Pool(opts);
    return _pool;
  };

  const query: InternalQuery = async (sql, params) => {
    const pool = await getPool();
    return pool.query(normalizeParams(sql), params);
  };

  return {
    name: "postgresql-pg",
    dialect: "postgresql",
    capabilities: pgCapabilities,
    getInstance: () => getPool(),
    exec: (sql) => query(sql),
    prepare: (sql) => new StatementWrapper(sql, query),
    dispose: async () => {
      if (_pool) {
        await _pool.end();
        _pool = undefined;
      }
    },
    beginTransaction: async (
      _opts?: TransactionOptions,
    ): Promise<ConnectorTransaction> => {
      const pool = await getPool();
      const client: PoolClient = await pool.connect();
      await client.query("BEGIN");

      const txQuery: InternalQuery = async (sql, params) => {
        return client.query(normalizeParams(sql), params);
      };

      return {
        exec: (sql) => txQuery(sql),
        prepare: (sql) => new StatementWrapper(sql, txQuery),
        commit: async () => {
          try {
            await client.query("COMMIT");
          } finally {
            client.release();
          }
        },
        rollback: async () => {
          try {
            await client.query("ROLLBACK");
          } finally {
            client.release();
          }
        },
      };
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
    return res.rows;
  }

  async run(...params: Primitive[]) {
    const res = await this.#query(this.#sql, params);
    return { success: true, rows: res.rows, rowCount: res.rowCount };
  }

  async get(...params: Primitive[]) {
    const res = await this.#query(this.#sql, params);
    return res.rows[0];
  }
}

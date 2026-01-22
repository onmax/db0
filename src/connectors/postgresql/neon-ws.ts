import {
  Pool,
  neonConfig,
  type NeonQueryPromise,
} from "@neondatabase/serverless";
import type {
  Connector,
  ConnectorTransaction,
  Primitive,
  TransactionOptions,
} from "db0";
import { BoundableStatement } from "../_internal/statement.ts";
import { normalizeParams, pgCapabilities } from "./_utils.ts";

export interface ConnectorOptions {
  url: string;
  /** Configure WebSocket library (required for Node.js) */
  webSocketConstructor?: typeof WebSocket;
  /** Pool options */
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

type InternalQuery = (
  sql: string,
  params?: Primitive[],
) => Promise<{ rows: unknown[]; rowCount: number | null }>;

export default function postgresqlNeonWsConnector(
  opts: ConnectorOptions,
): Connector<Pool> {
  let _pool: Pool | undefined;

  const getPool = () => {
    if (_pool) return _pool;
    if (opts.webSocketConstructor) {
      neonConfig.webSocketConstructor = opts.webSocketConstructor;
    }
    _pool = new Pool({
      connectionString: opts.url,
      max: opts.max,
      idleTimeoutMillis: opts.idleTimeoutMillis,
      connectionTimeoutMillis: opts.connectionTimeoutMillis,
    });
    return _pool;
  };

  const query: InternalQuery = async (sql, params) => {
    const pool = getPool();
    return pool.query(normalizeParams(sql), params);
  };

  return {
    name: "postgresql-neon-ws",
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
      const pool = getPool();
      const client = await pool.connect();
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

import mysql from "mysql2/promise";
import type {
  Connector,
  ConnectorTransaction,
  Primitive,
  TransactionOptions,
} from "db0";
import { BoundableStatement } from "../_internal/statement.ts";
import { mysqlCapabilities } from "./_utils.ts";

export type ConnectorOptions = mysql.PoolOptions;

type InternalQuery = (
  sql: string,
  params?: unknown[],
) => Promise<mysql.QueryResult>;

export default function mysqlPoolConnector(
  opts: ConnectorOptions,
): Connector<mysql.Pool> {
  let _pool: mysql.Pool | undefined;

  const getPool = () => {
    if (_pool) return _pool;
    _pool = mysql.createPool(opts);
    return _pool;
  };

  const query: InternalQuery = async (sql, params) => {
    const pool = getPool();
    const res = await pool.query(sql, params);
    return res[0];
  };

  return {
    name: "mysql-pool",
    dialect: "mysql",
    capabilities: mysqlCapabilities,
    getInstance: () => getPool(),
    exec: (sql) => query(sql),
    prepare: (sql) => new StatementWrapper(sql, query),
    dispose: async () => {
      await _pool?.end?.();
      _pool = undefined;
    },
    beginTransaction: async (
      _opts?: TransactionOptions,
    ): Promise<ConnectorTransaction> => {
      const pool = getPool();
      const connection = await pool.getConnection();
      await connection.beginTransaction();

      const txQuery: InternalQuery = async (sql, params) => {
        const res = await connection.query(sql, params);
        return res[0];
      };

      return {
        exec: (sql) => txQuery(sql),
        prepare: (sql) => new StatementWrapper(sql, txQuery),
        commit: async () => {
          try {
            await connection.commit();
          } finally {
            connection.release();
          }
        },
        rollback: async () => {
          try {
            await connection.rollback();
          } finally {
            connection.release();
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
    const res = (await this.#query(this.#sql, params)) as mysql.RowDataPacket[];
    return res;
  }

  async run(...params: Primitive[]) {
    const res = (await this.#query(this.#sql, params)) as mysql.RowDataPacket[];
    return { success: true, ...res };
  }

  async get(...params: Primitive[]) {
    const res = (await this.#query(this.#sql, params)) as mysql.RowDataPacket[];
    return res[0];
  }
}

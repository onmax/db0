import type { ConnectionPool, config as MssqlConfig, IResult } from "mssql";
import type {
  Connector,
  ConnectorTransaction,
  Primitive,
  TransactionOptions,
} from "db0";
import { BoundableStatement } from "./_internal/statement.ts";

export type ConnectorOptions = MssqlConfig;

type InternalQuery = (
  sql: string,
  params?: Primitive[],
) => Promise<IResult<unknown>>;

export default function mssqlConnector(
  opts: ConnectorOptions,
): Connector<ConnectionPool> {
  let _pool: ConnectionPool | Promise<ConnectionPool> | undefined;

  const getPool = async () => {
    if (_pool) return _pool;
    const mssql = await import("mssql");
    _pool = new mssql.default.ConnectionPool(opts)
      .connect()
      .then((pool) => (_pool = pool));
    return _pool;
  };

  const query: InternalQuery = async (sql, params) => {
    const pool = await getPool();
    const request = pool.request();
    if (params) {
      for (const [i, param] of params.entries()) {
        request.input(`p${i + 1}`, param);
      }
    }
    return request.query(normalizeParams(sql));
  };

  return {
    name: "mssql",
    dialect: "mssql",
    capabilities: {
      supportsJSON: true,
      supportsBooleans: true,
      supportsArrays: false,
      supportsDates: true,
      supportsUUIDs: true,
      supportsTransactions: true,
      supportsBatch: true,
    },
    getInstance: () => getPool(),
    exec: (sql) => query(sql),
    prepare: (sql) => new StatementWrapper(sql, query),
    dispose: async () => {
      const pool = await _pool;
      await pool?.close?.();
      _pool = undefined;
    },
    beginTransaction: async (
      _opts?: TransactionOptions,
    ): Promise<ConnectorTransaction> => {
      const pool = await getPool();
      const mssql = await import("mssql");
      const transaction = new mssql.default.Transaction(pool);
      await transaction.begin();

      const txQuery: InternalQuery = async (sql, params) => {
        const request = new mssql.default.Request(transaction);
        if (params) {
          for (const [i, param] of params.entries()) {
            request.input(`p${i + 1}`, param);
          }
        }
        return request.query(normalizeParams(sql));
      };

      return {
        exec: (sql) => txQuery(sql),
        prepare: (sql) => new StatementWrapper(sql, txQuery),
        commit: () => transaction.commit(),
        rollback: () => transaction.rollback(),
      };
    },
  };
}

/** Convert `?` placeholders to MSSQL's `@p1, @p2, ...` format */
function normalizeParams(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `@p${++i}`);
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
    return res.recordset;
  }

  async run(...params: Primitive[]) {
    const res = await this.#query(this.#sql, params);
    return {
      success: true,
      rows: res.recordset,
      rowsAffected: res.rowsAffected,
    };
  }

  async get(...params: Primitive[]) {
    const res = await this.#query(this.#sql, params);
    return res.recordset[0];
  }
}

import type {
  Connection,
  ConnectionConfig,
  PoolConnection,
  Pool,
  PoolConfig,
} from "mariadb";
import type {
  Connector,
  ConnectorTransaction,
  Primitive,
  TransactionOptions,
} from "db0";
import { BoundableStatement } from "../_internal/statement.ts";
import { mysqlCapabilities } from "./_utils.ts";

export type ConnectorOptions = (ConnectionConfig | PoolConfig) & {
  pool?: boolean;
};

type InternalQuery = (sql: string, params?: unknown[]) => Promise<unknown[]>;

export default function mysqlMariadbConnector(
  opts: ConnectorOptions,
): Connector<Connection | Pool> {
  const usePool = opts.pool ?? false;
  let _connection: Connection | Pool | Promise<Connection | Pool> | undefined;

  const getConnection = async () => {
    if (_connection) return _connection;
    const mariadb = await import("mariadb");
    _connection = usePool
      ? mariadb.createPool(opts as PoolConfig)
      : await mariadb.createConnection(opts as ConnectionConfig);
    return _connection;
  };

  const query: InternalQuery = async (sql, params) => {
    const conn = await getConnection();
    return conn.query(sql, params);
  };

  return {
    name: "mysql-mariadb",
    dialect: "mysql",
    capabilities: mysqlCapabilities,
    getInstance: () => getConnection(),
    exec: (sql) => query(sql),
    prepare: (sql) => new StatementWrapper(sql, query),
    dispose: async () => {
      const conn = await _connection;
      await (usePool ? (conn as Pool)?.end?.() : (conn as Connection)?.end?.());
      _connection = undefined;
    },
    beginTransaction: async (
      _opts?: TransactionOptions,
    ): Promise<ConnectorTransaction> => {
      const conn = await getConnection();
      const txConn: Connection | PoolConnection = usePool
        ? await (conn as Pool).getConnection()
        : (conn as Connection);

      await txConn.beginTransaction();

      const txQuery: InternalQuery = async (sql, params) => {
        return txConn.query(sql, params);
      };

      return {
        exec: (sql) => txQuery(sql),
        prepare: (sql) => new StatementWrapper(sql, txQuery),
        commit: async () => {
          try {
            await txConn.commit();
          } finally {
            if (usePool) {
              (txConn as PoolConnection).release();
            }
          }
        },
        rollback: async () => {
          try {
            await txConn.rollback();
          } finally {
            if (usePool) {
              (txConn as PoolConnection).release();
            }
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
    return res as unknown[];
  }

  async run(...params: Primitive[]) {
    const res = await this.#query(this.#sql, params);
    return { success: true, rows: res };
  }

  async get(...params: Primitive[]) {
    const res = (await this.#query(this.#sql, params)) as unknown[];
    return res[0];
  }
}

import mysql from "mysql2/promise";
import type { Connector, Primitive } from "db0";
import { BoundableStatement } from "./_internal/statement.ts";

export type ConnectorOptions = mysql.ConnectionOptions;

type InternalQuery = (
  sql: string,
  params?: unknown[],
) => Promise<mysql.QueryResult>;

export default function mysqlConnector(
  opts: ConnectorOptions,
): Connector<mysql.Connection> {
  let _connection: mysql.Connection | Promise<mysql.Connection> | undefined;

  const getConnection = () => {
    if (_connection) return _connection;
    return (_connection = mysql
      .createConnection(opts)
      .then((conn) => (_connection = conn)));
  };

  const query: InternalQuery = async (sql, params) => {
    const connection = await getConnection();
    const res = await connection.query(sql, params);
    return res[0];
  };

  return {
    name: "mysql",
    dialect: "mysql",
    getInstance: () => getConnection(),
    exec: (sql) => query(sql),
    prepare: (sql) => new StatementWrapper(sql, query),
    dispose: async () => {
      await (await _connection)?.end?.();
      _connection = undefined;
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
    return {
      success: true,
      ...res,
    };
  }

  async get(...params: Primitive[]) {
    const res = (await this.#query(this.#sql, params)) as mysql.RowDataPacket[];
    return res[0];
  }
}

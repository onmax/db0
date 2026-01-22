import { Client, type ExecutedQuery, type Config } from "@planetscale/database";
import type { Connector, Primitive } from "db0";
import { BoundableStatement } from "../_internal/statement.ts";
import { mysqlCapabilities } from "./_utils.ts";

export type ConnectorOptions = Config;

type InternalQuery = (
  sql: string,
  params?: unknown[],
) => Promise<ExecutedQuery>;

export default function mysqlPlanetscaleConnector(
  opts: ConnectorOptions,
): Connector<Client> {
  let _client: undefined | Client;

  function getClient() {
    if (_client) return _client;
    const client = new Client(opts);
    _client = client;
    return client;
  }

  const query: InternalQuery = (sql, params) =>
    getClient().execute(sql, params);

  return {
    name: "mysql-planetscale",
    dialect: "mysql",
    capabilities: { ...mysqlCapabilities, supportsTransactions: false },
    getInstance: () => getClient(),
    exec: (sql) => query(sql),
    prepare: (sql) => new StatementWrapper(sql, query),
    dispose: () => {
      _client = undefined;
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
    return { success: true, ...res };
  }

  async get(...params: Primitive[]) {
    const res = await this.#query(this.#sql, params);
    return res.rows[0];
  }
}

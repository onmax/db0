import type {
  Client,
  InStatement,
  Transaction as LibsqlTransaction,
} from "@libsql/client";
import type {
  Connector,
  ConnectorTransaction,
  Primitive,
  TransactionOptions,
} from "db0";
import { BoundableStatement } from "../_internal/statement.ts";

export type ConnectorOptions = {
  getClient: () => Client;
  name?: string;
};

type InternalQuery = (sql: InStatement) => Promise<any>;

export default function libSqlCoreConnector(
  opts: ConnectorOptions,
): Connector<Client> {
  const query: InternalQuery = (sql) => opts.getClient().execute(sql);

  return {
    name: opts.name || "libsql-core",
    dialect: "libsql",
    capabilities: {
      supportsJSON: true,
      supportsBooleans: false,
      supportsArrays: false,
      supportsDates: false,
      supportsUUIDs: false,
      supportsTransactions: true,
      supportsBatch: true,
    },
    getInstance: () => opts.getClient(),
    exec: (sql) => query(sql),
    prepare: (sql) => new StatementWrapper(sql, query),
    dispose: () => {
      opts.getClient()?.close?.();
    },
    beginTransaction: async (
      _opts?: TransactionOptions,
    ): Promise<ConnectorTransaction> => {
      const tx: LibsqlTransaction = await opts.getClient().transaction("write");

      const txQuery: InternalQuery = (sql) => tx.execute(sql);

      return {
        exec: (sql) => txQuery(sql),
        prepare: (sql) => new StatementWrapper(sql, txQuery),
        commit: () => tx.commit(),
        rollback: () => tx.rollback(),
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
    const res = await this.#query({
      sql: this.#sql,
      args: params as Exclude<Primitive, undefined>[],
    });
    return res.rows;
  }

  async run(...params: Primitive[]) {
    const res = await this.#query({
      sql: this.#sql,
      args: params as Exclude<Primitive, undefined>[],
    });
    return {
      success: true,
      ...res,
    };
  }

  async get(...params: Primitive[]) {
    const res = await this.#query({
      sql: this.#sql,
      args: params as Exclude<Primitive, undefined>[],
    });
    return res.rows[0];
  }
}

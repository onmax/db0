import type { SQLiteDBConnection } from "@capacitor-community/sqlite";
import type {
  Connector,
  ConnectorTransaction,
  Primitive,
  TransactionOptions,
} from "db0";
import { BoundableStatement } from "./_internal/statement.ts";

export interface ConnectorOptions {
  /** Pre-initialized SQLite database connection */
  connection: SQLiteDBConnection;
}

type QueryResult = {
  values?: unknown[];
  changes?: { changes?: number; lastId?: number };
};
type InternalQuery = (
  sql: string,
  params?: Primitive[],
) => Promise<QueryResult>;

export default function capacitorSqliteConnector(
  opts: ConnectorOptions,
): Connector<SQLiteDBConnection> {
  const db = opts.connection;

  const query: InternalQuery = async (sql, params) => {
    const isSelect = sql.trim().toLowerCase().startsWith("select");
    if (isSelect) {
      const result = await db.query(sql, params as unknown[]);
      return { values: result.values };
    }
    const result = await db.run(sql, params as unknown[]);
    return { changes: result.changes };
  };

  return {
    name: "capacitor-sqlite",
    dialect: "sqlite",
    capabilities: {
      supportsJSON: false,
      supportsBooleans: false,
      supportsArrays: false,
      supportsDates: false,
      supportsUUIDs: false,
      supportsTransactions: true,
      supportsBatch: true,
    },
    getInstance: () => db,
    exec: (sql) => query(sql),
    prepare: (sql) => new StatementWrapper(sql, query),
    dispose: async () => {
      await db.close();
    },
    beginTransaction: async (
      _opts?: TransactionOptions,
    ): Promise<ConnectorTransaction> => {
      await db.execute("BEGIN TRANSACTION");

      return {
        exec: (sql) => query(sql),
        prepare: (sql) => new StatementWrapper(sql, query),
        commit: async () => {
          await db.execute("COMMIT");
        },
        rollback: async () => {
          await db.execute("ROLLBACK");
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
    return res.values ?? [];
  }

  async run(...params: Primitive[]) {
    const res = await this.#query(this.#sql, params);
    return { success: true, changes: res.changes };
  }

  async get(...params: Primitive[]) {
    const res = await this.#query(this.#sql, params);
    return res.values?.[0];
  }
}

import type {
  Connector,
  ConnectorTransaction,
  Primitive,
  TransactionOptions,
} from "db0";
import { BoundableStatement } from "./_internal/statement.ts";

interface SQLiteDatabase {
  transaction(
    fn: (tx: SQLiteTransaction) => void,
    errorCallback?: (error: Error) => void,
    successCallback?: () => void,
  ): void;
  executeSql(
    sql: string,
    params?: unknown[],
    successCallback?: (resultSet: SQLiteResultSet) => void,
    errorCallback?: (error: Error) => void,
  ): void;
  close(
    successCallback?: () => void,
    errorCallback?: (error: Error) => void,
  ): void;
}

interface SQLiteTransaction {
  executeSql(
    sql: string,
    params?: unknown[],
    successCallback?: (
      tx: SQLiteTransaction,
      resultSet: SQLiteResultSet,
    ) => void,
    errorCallback?: (tx: SQLiteTransaction, error: Error) => boolean,
  ): void;
}

interface SQLiteResultSet {
  insertId?: number;
  rowsAffected: number;
  rows: { length: number; item(index: number): unknown };
}

interface SqlitePlugin {
  openDatabase(options: {
    name: string;
    location?: string;
    iosDatabaseLocation?: string;
    androidDatabaseProvider?: string;
  }): SQLiteDatabase;
}

export interface ConnectorOptions {
  /** Database name */
  name: string;
  /** Database location: "default", "Library", "Documents" */
  location?: string;
  /** iOS specific database location */
  iosDatabaseLocation?: string;
  /** Android database provider */
  androidDatabaseProvider?: string;
}

declare const sqlitePlugin: SqlitePlugin;

type InternalQuery = (
  sql: string,
  params?: Primitive[],
) => Promise<{ rows: unknown[]; rowsAffected: number; insertId?: number }>;

export default function cordovaSqliteConnector(
  opts: ConnectorOptions,
): Connector<SQLiteDatabase> {
  let _db: SQLiteDatabase | undefined;

  const getDb = () => {
    if (_db) return _db;
    _db = sqlitePlugin.openDatabase({
      name: opts.name,
      location: opts.location ?? "default",
      iosDatabaseLocation: opts.iosDatabaseLocation,
      androidDatabaseProvider: opts.androidDatabaseProvider,
    });
    return _db;
  };

  const query: InternalQuery = (sql, params) => {
    return new Promise((resolve, reject) => {
      const db = getDb();
      db.executeSql(
        sql,
        params as unknown[],
        (resultSet) => {
          const rows: unknown[] = [];
          for (let i = 0; i < resultSet.rows.length; i++) {
            rows.push(resultSet.rows.item(i));
          }
          resolve({
            rows,
            rowsAffected: resultSet.rowsAffected,
            insertId: resultSet.insertId,
          });
        },
        reject,
      );
    });
  };

  return {
    name: "cordova-sqlite",
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
    getInstance: () => getDb(),
    exec: (sql) => query(sql),
    prepare: (sql) => new StatementWrapper(sql, query),
    dispose: () => {
      return new Promise<void>((resolve, reject) => {
        if (_db) {
          _db.close(() => {
            _db = undefined;
            resolve();
          }, reject);
        } else {
          resolve();
        }
      });
    },
    beginTransaction: (
      _opts?: TransactionOptions,
    ): Promise<ConnectorTransaction> => {
      return new Promise((resolve, reject) => {
        const db = getDb();

        db.transaction((tx) => {
          const txQuery: InternalQuery = (sql, params) => {
            return new Promise((res, rej) => {
              tx.executeSql(
                sql,
                params as unknown[],
                (_tx, resultSet) => {
                  const rows: unknown[] = [];
                  for (let i = 0; i < resultSet.rows.length; i++) {
                    rows.push(resultSet.rows.item(i));
                  }
                  res({
                    rows,
                    rowsAffected: resultSet.rowsAffected,
                    insertId: resultSet.insertId,
                  });
                },
                (_tx, error) => {
                  rej(error);
                  return true;
                },
              );
            });
          };

          resolve({
            exec: (sql) => txQuery(sql),
            prepare: (sql) => new StatementWrapper(sql, txQuery),
            commit: () => Promise.resolve(),
            rollback: () => Promise.resolve(),
          });
        }, reject);
      });
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
    return {
      success: true,
      rowsAffected: res.rowsAffected,
      insertId: res.insertId,
    };
  }

  async get(...params: Primitive[]) {
    const res = await this.#query(this.#sql, params);
    return res.rows[0];
  }
}

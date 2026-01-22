/**
 * Represents primitive types that can be used in SQL operations.
 */
export type Primitive = string | number | boolean | undefined | null;

export type SQLDialect = "mysql" | "postgresql" | "sqlite" | "libsql" | "mssql";

/** Alias for backwards compatibility */
export type ConnectorCapabilities = DatabaseCapabilities;

/**
 * Database capability flags indicating what features the connector supports.
 * All flags are readonly and set at connector initialization.
 */
export interface DatabaseCapabilities {
  /** Whether the database supports native JSON columns/operations */
  readonly supportsJSON: boolean;
  /** Whether the database supports native boolean type (vs integer 0/1) */
  readonly supportsBooleans: boolean;
  /** Whether the database supports array columns */
  readonly supportsArrays: boolean;
  /** Whether the database supports native date/timestamp columns */
  readonly supportsDates: boolean;
  /** Whether the database supports native UUID type */
  readonly supportsUUIDs: boolean;
  /** Whether the database supports transactions */
  readonly supportsTransactions: boolean;
  /** Whether the database supports batch operations */
  readonly supportsBatch: boolean;
}

export type Statement = {
  /**
   * Binds parameters to the statement.
   * @param {...Primitive[]} params - Parameters to bind to the SQL statement.
   * @returns {PreparedStatement} The instance of the statement with bound parameters.
   */
  bind(...params: Primitive[]): PreparedStatement;

  /**
   * Executes the statement and returns all resulting rows as an array.
   * @param {...Primitive[]} params - Parameters to bind to the SQL statement.
   * @returns {Promise<unknown[]>} A promise that resolves to an array of rows.
   */
  all(...params: Primitive[]): Promise<unknown[]>;

  /**
   * Executes the statement as an action (e.g. insert, update, delete).
   * @param {...Primitive[]} params - Parameters to bind to the SQL statement.
   * @returns {Promise<{ success: boolean }>} A promise that resolves to the success state of the action.
   */
  run(...params: Primitive[]): Promise<{ success: boolean }>;

  /**
   * Executes the statement and returns a single row.
   * @param {...Primitive[]} params - Parameters to bind to the SQL statement.
   * @returns {Promise<unknown>} A promise that resolves to the first row in the result set.
   */
  get(...params: Primitive[]): Promise<unknown>;
};

export type PreparedStatement = {
  /**
   * Binds parameters to the statement.
   * @param {...Primitive[]} params - Parameters to bind to the SQL statement.
   * @returns {PreparedStatement} The instance of the statement with bound parameters.
   */
  bind(...params: Primitive[]): PreparedStatement;

  /**
   * Executes the statement and returns all resulting rows as an array.
   * @returns {Promise<unknown[]>} A promise that resolves to an array of rows.
   */
  all(): Promise<unknown[]>;

  /**
   * Executes the statement as an action (e.g. insert, update, delete).
   * @returns {Promise<{ success: boolean }>} A promise that resolves to the success state of the action.
   */
  run(): Promise<{ success: boolean }>;

  /**
   * Executes the statement and returns a single row.
   * @returns {Promise<unknown>} A promise that resolves to the first row in the result set.
   */
  get(): Promise<unknown>;
};

/**
 * Represents the result of a database execution.
 */
export type ExecResult = unknown;

/**
 * A database transaction that provides methods for executing queries within a transaction context.
 */
export interface Transaction<TConnector extends Connector = Connector> {
  /**
   * Executes a raw SQL string within the transaction.
   */
  exec: (sql: string) => Promise<ExecResult>;

  /**
   * Prepares an SQL statement within the transaction.
   */
  prepare: (sql: string) => Statement;

  /**
   * Executes SQL queries using tagged template literals within the transaction.
   */
  sql: <T = DefaultSQLResult>(
    strings: TemplateStringsArray,
    ...values: Primitive[]
  ) => Promise<T>;

  /**
   * Commits the transaction.
   */
  commit: () => Promise<void>;

  /**
   * Rolls back the transaction.
   */
  rollback: () => Promise<void>;
}

/**
 * Options for transaction behavior.
 */
export interface TransactionOptions {
  /**
   * When true, uses SAVEPOINT for nested transaction semantics.
   * @default true for databases that support it
   */
  nested?: boolean;
}

/**
 * Defines a database connector for executing SQL queries and preparing statements.
 */
export type Connector<TInstance = unknown> = {
  /**
   * The name of the connector.
   */
  name: string;

  /**
   * The SQL dialect used by the connector.
   */
  dialect: SQLDialect;

  /**
   * Database capability flags indicating supported features.
   */
  capabilities: DatabaseCapabilities;

  /**
   * The client instance used internally.
   */
  getInstance: () => TInstance | Promise<TInstance>;

  /**
   * Executes an SQL query directly and returns the result.
   * @param {string} sql - The SQL string to execute.
   * @returns {ExecResult | Promise<ExecResult>} The result of the execution.
   */
  exec: (sql: string) => ExecResult | Promise<ExecResult>;

  /**
   * Prepares an SQL statement for execution.
   * @param {string} sql - The SQL string to prepare.
   * @returns {statement} The prepared SQL statement.
   */
  prepare: (sql: string) => Statement;

  /**
   * Closes the database connection and cleans up resources.
   * @returns {void | Promise<void>} A promise that resolves when the connection is closed.
   */
  dispose?: () => void | Promise<void>;

  /**
   * Begins a transaction. Returns a connector-specific transaction context.
   * If not implemented, the database layer will use raw SQL commands.
   */
  beginTransaction?: (
    opts?: TransactionOptions,
  ) => Promise<ConnectorTransaction>;
};

/**
 * Connector-level transaction context returned by beginTransaction.
 */
export interface ConnectorTransaction {
  exec: (sql: string) => ExecResult | Promise<ExecResult>;
  prepare: (sql: string) => Statement;
  commit: () => void | Promise<void>;
  rollback: () => void | Promise<void>;
}

/**
 * Represents default SQL results, including any error messages, row changes and rows returned.
 */
type DefaultSQLResult = {
  lastInsertRowid?: number;
  changes?: number;
  error?: string;
  rows?: { id?: string | number; [key: string]: unknown }[];
  success?: boolean;
};

/**
 * Options for automatic type transformations.
 */
export interface TypeTransformerOptions {
  /** Transform booleans to/from integers (for SQLite/D1). Default: true when database doesn't support booleans */
  booleans?: boolean;
  /** Transform dates to/from ISO strings. Default: true when database doesn't support native dates */
  dates?: boolean;
  /** Transform JSON objects to/from text strings. Default: true when database doesn't support native JSON */
  json?: boolean;
  /** Completely disable all type transformations. Default: false */
  disabled?: boolean;
}

/**
 * Options for creating a database instance.
 */
export type DatabaseOptions = {
  /**
   * When true, the connection is established immediately at creation time.
   * Use `ready()` to wait for initialization to complete.
   * After `ready()` resolves, `getInstance()` returns synchronously.
   * @default false
   */
  eager?: boolean;
  /**
   * Configure automatic type transformations based on database capabilities.
   * By default, transformations are enabled for types not natively supported.
   */
  transformers?: TypeTransformerOptions;
};

import type { DatabaseSchema } from "./schema.ts";

export interface Database<TConnector extends Connector = Connector>
  extends AsyncDisposable {
  readonly dialect: SQLDialect;

  /**
   * Database capability flags indicating supported features.
   */
  readonly capabilities: DatabaseCapabilities;

  /**
   * Indicates whether the database instance has been disposed/closed.
   * @returns {boolean} True if the database has been disposed, false otherwise.
   */
  readonly disposed: boolean;

  /**
   * Returns a promise that resolves when the database is ready.
   * When eager mode is enabled, this resolves once the connection is established.
   * When eager mode is disabled, this resolves immediately.
   * @returns {Promise<void>} A promise that resolves when the database is ready.
   */
  ready: () => Promise<void>;

  /**
   * The client instance used internally.
   * After `ready()` resolves (when eager mode is enabled), returns the instance synchronously.
   * @returns {Promise<TInstance> | TInstance} The client instance or a promise that resolves with it.
   */
  getInstance: () =>
    | Awaited<ReturnType<TConnector["getInstance"]>>
    | Promise<Awaited<ReturnType<TConnector["getInstance"]>>>;

  /**
   * Executes a raw SQL string.
   * @param {string} sql - The SQL string to execute.
   * @returns {Promise<ExecResult>} A promise that resolves with the execution result.
   */
  exec: (sql: string) => Promise<ExecResult>;

  /**
   * Prepares an SQL statement from a raw SQL string.
   * @param {string} sql - The SQL string to prepare.
   * @returns {statement} The prepared SQL statement.
   */
  prepare: (sql: string) => Statement;

  /**
   * Executes SQL queries using tagged template literals.
   * @template T The expected type of query result.
   * @param {TemplateStringsArray} strings - The segments of the SQL string.
   * @param {...Primitive[]} values - The values to interpolate into the SQL string.
   * @returns {Promise<T>} A promise that resolves with the typed result of the query.
   */
  sql: <T = DefaultSQLResult>(
    strings: TemplateStringsArray,
    ...values: Primitive[]
  ) => Promise<T>;

  /**
   * Closes the database connection and cleans up resources.
   * @returns {Promise<void>} A promise that resolves when the connection is closed.
   */
  dispose: () => Promise<void>;

  /**
   * AsyncDisposable implementation for using syntax support.
   * @returns {Promise<void>} A promise that resolves when the connection is disposed.
   */
  [Symbol.asyncDispose]: () => Promise<void>;

  /**
   * Executes a callback within a transaction. Auto-commits on success, auto-rollbacks on error.
   * @param fn The callback function receiving a transaction context.
   * @param opts Transaction options.
   * @returns The result of the callback function.
   */
  transaction: <T>(
    fn: (tx: Transaction<TConnector>) => Promise<T>,
    opts?: TransactionOptions,
  ) => Promise<T>;

  /**
   * Begins a manual transaction. Caller is responsible for commit/rollback.
   * @param opts Transaction options.
   * @returns A transaction object with commit() and rollback() methods.
   */
  beginTransaction: (
    opts?: TransactionOptions,
  ) => Promise<Transaction<TConnector>>;

  /**
   * Retrieves the database schema including all tables and their columns.
   * @returns A promise that resolves to the database schema.
   */
  getSchema: () => Promise<DatabaseSchema>;
}

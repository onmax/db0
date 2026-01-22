import { sqlTemplate } from "./template.ts";
import type {
  Connector,
  ConnectorTransaction,
  Database,
  DatabaseOptions,
  SQLDialect,
  Transaction,
  TransactionOptions,
  TypeTransformerOptions,
} from "./types.ts";
import type { Primitive } from "./types.ts";
import {
  resolveTransformers,
  transformInputParams,
  transformOutputRows,
} from "./transformers.ts";
import {
  ConnectionError,
  TransactionError,
  wrapError,
  wrapTransactionError,
} from "./errors.ts";
import { getSchema } from "./schema.ts";

const SQL_SELECT_RE = /^select/i;
const SQL_RETURNING_RE = /[\s]returning[\s]/i;
const DIALECTS_WITH_RET: Set<SQLDialect> = new Set(["postgresql", "sqlite"]);

const DISPOSED_MSG =
  "This database instance has been disposed and cannot be used.";

/**
 * Creates and returns a database interface using the specified connector.
 * This interface allows you to execute raw SQL queries, prepare SQL statements,
 * and execute SQL queries with parameters using tagged template literals.
 *
 * @param {Connector} connector - The database connector used to execute and prepare SQL statements. See {@link Connector}.
 * @param {DatabaseOptions} options - Optional configuration options.
 * @returns {Database} The database interface that allows SQL operations. See {@link Database}.
 */
export function createDatabase<TConnector extends Connector = Connector>(
  connector: TConnector,
  options?: DatabaseOptions,
): Database<TConnector> {
  let _disposed = false;
  let _eagerInstance:
    | Awaited<ReturnType<TConnector["getInstance"]>>
    | undefined;
  let _readyPromise: Promise<void> | undefined;

  // Resolve type transformers based on capabilities and options
  const _transformers = resolveTransformers(
    connector.capabilities,
    options?.transformers,
  );

  const checkDisposed = () => {
    if (_disposed) {
      const err = new ConnectionError(DISPOSED_MSG, "CONNECTION_CLOSED");
      Error.captureStackTrace?.(err, checkDisposed);
      throw err;
    }
  };

  if (options?.eager) {
    const instance = connector.getInstance();
    if (instance instanceof Promise) {
      _readyPromise = instance.then((resolved) => {
        _eagerInstance = resolved;
      });
    } else {
      _eagerInstance = instance as Awaited<
        ReturnType<TConnector["getInstance"]>
      >;
      _readyPromise = Promise.resolve();
    }
  }

  return <Database<TConnector>>{
    get dialect() {
      return connector.dialect;
    },

    get capabilities() {
      return connector.capabilities;
    },

    get disposed() {
      return _disposed;
    },

    ready: () => {
      checkDisposed();
      return _readyPromise ?? Promise.resolve();
    },

    getInstance() {
      checkDisposed();
      if (_eagerInstance !== undefined) {
        return _eagerInstance;
      }
      return Promise.resolve(connector.getInstance());
    },

    exec: (sql: string) => {
      checkDisposed();
      return Promise.resolve(connector.exec(sql));
    },

    prepare: (sql: string) => {
      checkDisposed();
      return connector.prepare(sql);
    },

    sql: async (strings: TemplateStringsArray, ...values: Primitive[]) => {
      checkDisposed();
      const [sql, params] = sqlTemplate(strings, ...values);
      // Transform input params (booleans → int, dates → ISO, objects → JSON)
      const transformedParams = transformInputParams(
        params,
        _transformers,
      ) as Primitive[];
      if (
        SQL_SELECT_RE.test(sql) /* select */ ||
        // prettier-ignore
        (DIALECTS_WITH_RET.has(connector.dialect) && SQL_RETURNING_RE.test(sql)) /* returning */
      ) {
        const rows = await connector.prepare(sql).all(...transformedParams);
        // Transform output rows (ISO → dates, JSON strings → objects)
        const transformedRows = transformOutputRows(
          rows as Record<string, unknown>[],
          _transformers,
        );
        return {
          rows: transformedRows,
          success: true,
        };
      } else {
        const res = await connector.prepare(sql).run(...transformedParams);
        return res;
      }
    },

    dispose: () => {
      if (_disposed) {
        return Promise.resolve();
      }
      _disposed = true;
      _eagerInstance = undefined;
      _readyPromise = undefined;
      try {
        return Promise.resolve(connector.dispose?.());
      } catch (error) {
        return Promise.reject(error);
      }
    },

    [Symbol.asyncDispose]() {
      return this.dispose();
    },

    async beginTransaction(
      opts?: TransactionOptions,
    ): Promise<Transaction<TConnector>> {
      checkDisposed();
      return createTransaction(connector, _transformers, opts);
    },

    async transaction<T>(
      fn: (tx: Transaction<TConnector>) => Promise<T>,
      opts?: TransactionOptions,
    ): Promise<T> {
      checkDisposed();
      const tx = await createTransaction<TConnector>(
        connector,
        _transformers,
        opts,
      );
      try {
        const result = await fn(tx);
        await tx.commit();
        return result;
      } catch (error) {
        await tx.rollback();
        throw wrapTransactionError(error);
      }
    },

    getSchema: () => {
      checkDisposed();
      return getSchema(connector.dialect, connector.prepare.bind(connector));
    },
  };
}

const _savepointCounter = 0;

async function createTransaction<TConnector extends Connector>(
  connector: TConnector,
  transformers: Required<TypeTransformerOptions>,
  opts?: TransactionOptions,
): Promise<Transaction<TConnector>> {
  let _committed = false;
  let _rolledBack = false;
  let _connectorTx: ConnectorTransaction | undefined;

  const checkState = () => {
    if (_committed)
      throw new TransactionError(
        "Transaction already committed",
        "TRANSACTION_ALREADY_COMMITTED",
      );
    if (_rolledBack)
      throw new TransactionError(
        "Transaction already rolled back",
        "TRANSACTION_ALREADY_ROLLED_BACK",
      );
  };

  // Use connector's native transaction if available
  if (connector.beginTransaction) {
    _connectorTx = await connector.beginTransaction(opts);
  } else {
    // Fallback to raw SQL
    await connector.exec("BEGIN");
  }

  const txExec = (sql: string) => {
    checkState();
    return Promise.resolve(
      _connectorTx ? _connectorTx.exec(sql) : connector.exec(sql),
    );
  };

  const txPrepare = (sql: string) => {
    checkState();
    return _connectorTx ? _connectorTx.prepare(sql) : connector.prepare(sql);
  };

  return {
    exec: txExec,
    prepare: txPrepare,

    sql: async <T>(
      strings: TemplateStringsArray,
      ...values: Primitive[]
    ): Promise<T> => {
      checkState();
      const [sql, params] = sqlTemplate(strings, ...values);
      const transformedParams = transformInputParams(
        params,
        transformers,
      ) as Primitive[];
      if (
        SQL_SELECT_RE.test(sql) ||
        (DIALECTS_WITH_RET.has(connector.dialect) && SQL_RETURNING_RE.test(sql))
      ) {
        const rows = await txPrepare(sql).all(...transformedParams);
        const transformedRows = transformOutputRows(
          rows as Record<string, unknown>[],
          transformers,
        );
        return { rows: transformedRows, success: true } as T;
      } else {
        return txPrepare(sql).run(...transformedParams) as Promise<T> as T;
      }
    },

    async commit() {
      checkState();
      _committed = true;
      await (_connectorTx ? _connectorTx.commit() : connector.exec("COMMIT"));
    },

    async rollback() {
      checkState();
      _rolledBack = true;
      await (_connectorTx
        ? _connectorTx.rollback()
        : connector.exec("ROLLBACK"));
    },
  };
}

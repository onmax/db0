import type {
  PGliteOptions,
  PGliteInterfaceExtensions,
  Results as PGLiteQueryResults,
  Transaction as PGliteTransaction,
} from "@electric-sql/pglite";
import { PGlite } from "@electric-sql/pglite";
import type {
  Connector,
  ConnectorTransaction,
  Primitive,
  TransactionOptions,
} from "db0";
import { BoundableStatement } from "../_internal/statement.ts";
import { normalizeParams, pgCapabilities } from "./_utils.ts";

export type ConnectorOptions = PGliteOptions;

type InternalQuery = (
  sql: string,
  params?: Primitive[],
) => Promise<PGLiteQueryResults<unknown>>;

export default function postgresqlPgliteConnector<
  TOptions extends ConnectorOptions,
>(
  opts?: TOptions,
): Connector<PGlite & PGliteInterfaceExtensions<TOptions["extensions"]>> {
  type PGLiteInstance = PGlite &
    PGliteInterfaceExtensions<TOptions["extensions"]>;

  let _client: PGLiteInstance | Promise<PGLiteInstance> | undefined;

  const getClient = () =>
    (_client ||= PGlite.create(opts).then((res) => (_client = res)));

  const query: InternalQuery = async (sql, params) => {
    const client = await getClient();
    const normalizedSql = normalizeParams(sql);
    const result = await client.query(normalizedSql, params);
    return result;
  };

  return <Connector<PGLiteInstance>>{
    name: "postgresql-pglite",
    dialect: "postgresql",
    capabilities: pgCapabilities,
    getInstance: () => getClient(),
    exec: (sql) => query(sql),
    prepare: (sql) => new StatementWrapper(sql, query),
    dispose: async () => {
      await (await _client)?.close?.();
      _client = undefined;
    },
    beginTransaction: async (
      _opts?: TransactionOptions,
    ): Promise<ConnectorTransaction> => {
      const client = await getClient();
      return new Promise((resolve, reject) => {
        client
          .transaction(async (tx: PGliteTransaction) => {
            const txQuery: InternalQuery = async (sql, params) => {
              const normalizedSql = normalizeParams(sql);
              return tx.query(normalizedSql, params);
            };

            let commitFn: () => void;
            let rollbackFn: (err: Error) => void;
            const completionPromise = new Promise<void>((res, rej) => {
              commitFn = res;
              rollbackFn = rej;
            });

            resolve({
              exec: (sql) => txQuery(sql),
              prepare: (sql) => new StatementWrapper(sql, txQuery),
              commit: () => {
                commitFn();
                return completionPromise;
              },
              rollback: () => {
                rollbackFn(new Error("ROLLBACK"));
                return completionPromise.catch(() => {});
              },
            });

            return completionPromise;
          })
          .catch((error_: Error) => {
            if (error_?.message === "ROLLBACK") return;
            reject(error_);
          });
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
    const result = await this.#query(this.#sql, params);
    return result.rows;
  }

  async run(...params: Primitive[]) {
    const result = await this.#query(this.#sql, params);
    return { success: true, ...result };
  }

  async get(...params: Primitive[]) {
    const result = await this.#query(this.#sql, params);
    return result.rows[0];
  }
}

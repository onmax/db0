import postgres, { type Sql, type Options } from "postgres";
import type {
  Connector,
  ConnectorTransaction,
  Primitive,
  TransactionOptions,
} from "db0";
import { BoundableStatement } from "../_internal/statement.ts";
import { normalizeParams, pgCapabilities } from "./_utils.ts";

export type ConnectorOptions =
  | ({ url: string } & Options<Record<string, never>>)
  | Options<Record<string, never>>;

type InternalQuery = (
  sql: string,
  params?: Primitive[],
) => Promise<postgres.RowList<postgres.Row[]>>;

export default function postgresqlPostgresConnector(
  opts: ConnectorOptions,
): Connector<Sql> {
  let _sql: Sql | undefined;

  const getSql = () => {
    if (_sql) return _sql;
    if ("url" in opts) {
      const { url, ...rest } = opts;
      _sql = postgres(url, rest);
    } else {
      _sql = postgres(opts);
    }
    return _sql;
  };

  const query: InternalQuery = async (sql, params) => {
    const client = getSql();
    return client.unsafe(normalizeParams(sql), params as any);
  };

  return {
    name: "postgresql-postgres",
    dialect: "postgresql",
    capabilities: pgCapabilities,
    getInstance: () => getSql(),
    exec: (sql) => query(sql),
    prepare: (sql) => new StatementWrapper(sql, query),
    dispose: async () => {
      if (_sql) {
        await _sql.end();
        _sql = undefined;
      }
    },
    beginTransaction: (
      _opts?: TransactionOptions,
    ): Promise<ConnectorTransaction> => {
      return new Promise((resolve, reject) => {
        const client = getSql();
        client
          .begin(async (txSql) => {
            const txQuery: InternalQuery = async (sql, params) => {
              return txSql.unsafe(normalizeParams(sql), params as any);
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
          .catch((error_) => {
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
    const res = await this.#query(this.#sql, params);
    return [...res];
  }

  async run(...params: Primitive[]) {
    const res = await this.#query(this.#sql, params);
    return { success: true, rows: [...res], count: res.count };
  }

  async get(...params: Primitive[]) {
    const res = await this.#query(this.#sql, params);
    return res[0];
  }
}

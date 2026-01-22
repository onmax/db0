import postgres, { type Sql, type Options } from "postgres";
import type { Connector, Primitive } from "db0";
import { BoundableStatement } from "./_internal/statement.ts";
import { getHyperdrive } from "./_internal/cloudflare.ts";
import { normalizeParams, pgCapabilities } from "./postgresql/_utils.ts";

type OmitPostgresConfig = Omit<
  Options<Record<string, never>>,
  "user" | "database" | "password" | "port" | "host"
>;

export type ConnectorOptions = { bindingName: string } & OmitPostgresConfig;

type InternalQuery = (
  sql: string,
  params?: Primitive[],
) => Promise<postgres.RowList<postgres.Row[]>>;

export default function cloudflareHyperdrivePostgresqlConnector(
  opts: ConnectorOptions,
): Connector<Sql> {
  let _sql: Sql | undefined;

  async function getSql() {
    if (_sql) return _sql;
    const hyperdrive = await getHyperdrive(opts.bindingName);
    const { bindingName: _, ...postgresOpts } = opts;
    _sql = postgres(hyperdrive.connectionString, postgresOpts);
    return _sql;
  }

  const query: InternalQuery = async (sql, params) => {
    const client = await getSql();
    return client.unsafe(normalizeParams(sql), params as any);
  };

  return {
    name: "cloudflare-hyperdrive-postgresql",
    dialect: "postgresql",
    capabilities: { ...pgCapabilities, supportsTransactions: false },
    getInstance: () => getSql(),
    exec: (sql) => query(sql),
    prepare: (sql) => new StatementWrapper(sql, query),
    dispose: async () => {
      if (_sql) {
        await _sql.end();
        _sql = undefined;
      }
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
    return {
      success: true,
      rows: [...res],
      count: res.count,
    };
  }

  async get(...params: Primitive[]) {
    const res = await this.#query(this.#sql, params);
    return res[0];
  }
}

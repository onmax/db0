import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { Connector, Primitive } from "db0";
import { BoundableStatement } from "../_internal/statement.ts";
import { normalizeParams, pgCapabilities } from "./_utils.ts";

export interface ConnectorOptions {
  url: string;
}

type InternalQuery = (
  sql: string,
  params?: Primitive[],
) => Promise<Record<string, unknown>[]>;

export default function postgresqlNeonHttpConnector(
  opts: ConnectorOptions,
): Connector<NeonQueryFunction<false, false>> {
  let _sql: NeonQueryFunction<false, false> | undefined;

  const getSql = () => {
    if (_sql) return _sql;
    _sql = neon(opts.url);
    return _sql;
  };

  const query: InternalQuery = async (sqlQuery, params) => {
    const sql = getSql();
    const normalizedSql = normalizeParams(sqlQuery);
    const templateStrings = createTemplateStringsArray(normalizedSql, params);
    return sql(templateStrings, ...(params || [])) as Promise<
      Record<string, unknown>[]
    >;
  };

  return {
    name: "postgresql-neon-http",
    dialect: "postgresql",
    capabilities: { ...pgCapabilities, supportsTransactions: false },
    getInstance: () => getSql(),
    exec: (sqlQuery) => query(sqlQuery),
    prepare: (sqlQuery) => new StatementWrapper(sqlQuery, query),
  };
}

function createTemplateStringsArray(
  sql: string,
  _params?: Primitive[],
): TemplateStringsArray {
  const parts = sql.split(/\$\d+/);
  return Object.assign(parts, { raw: parts }) as TemplateStringsArray;
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
    return this.#query(this.#sql, params);
  }

  async run(...params: Primitive[]) {
    const rows = await this.#query(this.#sql, params);
    return { success: true, rows };
  }

  async get(...params: Primitive[]) {
    const rows = await this.#query(this.#sql, params);
    return rows[0];
  }
}

import type { DatabaseCapabilities, Primitive } from "../../types.ts";
import { BoundableStatement } from "../_internal/statement.ts";

export const pgCapabilities: DatabaseCapabilities = {
  supportsJSON: true,
  supportsBooleans: true,
  supportsArrays: true,
  supportsDates: true,
  supportsUUIDs: true,
  supportsTransactions: true,
  supportsBatch: true,
};

/** Convert `?` placeholders to PostgreSQL's `$1, $2, ...` format */
export function normalizeParams(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

export type InternalQuery<T> = (
  sql: string,
  params?: Primitive[],
) => Promise<T>;

export abstract class PgStatementWrapper<T> extends BoundableStatement<void> {
  protected query: InternalQuery<T>;
  protected sql: string;

  constructor(sql: string, query: InternalQuery<T>) {
    super();
    this.sql = sql;
    this.query = query;
  }
}

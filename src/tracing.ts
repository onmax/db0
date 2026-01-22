import type {
  Database,
  Connector,
  Statement,
  Primitive,
  SQLDialect,
} from "./types.ts";
import { sqlTemplate } from "./template.ts";

export type TracedMethod =
  | "exec"
  | "sql"
  | "prepare.all"
  | "prepare.run"
  | "prepare.get";

export interface TraceContext {
  query: string;
  method: TracedMethod;
  dialect: SQLDialect;
  params?: Primitive[];
  result?: unknown;
  error?: Error;
}

type TracingChannel = {
  tracePromise: <T>(
    fn: () => Promise<T>,
    context: Omit<TraceContext, "result" | "error">,
  ) => Promise<T>;
};

/**
 * Wraps a database instance with tracing support using Node.js diagnostics_channel.
 * Traces all database operations (exec, sql, prepare) via the "db0.query" channel.
 *
 * @example
 * ```ts
 * import { tracingChannel } from "node:diagnostics_channel";
 * import { createDatabase, withTracing } from "db0";
 *
 * const db = withTracing(createDatabase(...));
 *
 * // Subscribe to trace events
 * tracingChannel("db0.query").subscribe({
 *   start: (ctx) => console.log("Query started:", ctx.query),
 *   asyncEnd: (ctx) => console.log("Query completed:", ctx.result),
 *   error: (ctx) => console.log("Query failed:", ctx.error),
 * });
 * ```
 */
export function withTracing<TConnector extends Connector>(
  db: Database<TConnector>,
): Database<TConnector> {
  // Get tracingChannel from Node.js built-in module (Node 19.9+)
  const diagnosticsChannel = globalThis.process?.getBuiltinModule?.(
    "node:diagnostics_channel",
  ) as { tracingChannel: (name: string) => TracingChannel } | undefined;

  if (!diagnosticsChannel?.tracingChannel) {
    // Tracing not available, return original db
    return db;
  }

  const channel = diagnosticsChannel.tracingChannel("db0.query");

  const traced = Object.create(db) as Database<TConnector>;

  // Wrap exec
  traced.exec = (sql: string) =>
    channel.tracePromise(() => db.exec(sql), {
      query: sql,
      method: "exec",
      dialect: db.dialect,
    });

  // Wrap sql tagged template
  traced.sql = (strings: TemplateStringsArray, ...values: Primitive[]) => {
    const [query, params] = sqlTemplate(strings, ...values);
    return channel.tracePromise(() => db.sql(strings, ...values), {
      query,
      method: "sql",
      dialect: db.dialect,
      params,
    });
  };

  // Wrap prepare to return traced statements
  traced.prepare = (sql: string): Statement => {
    const stmt = db.prepare(sql);
    return new TracedStatement(stmt, sql, db.dialect, channel);
  };

  return traced;
}

class TracedStatement implements Statement {
  constructor(
    private stmt: Statement,
    private query: string,
    private dialect: SQLDialect,
    private channel: TracingChannel,
  ) {}

  bind(...params: Primitive[]): TracedStatement {
    return new TracedStatement(
      this.stmt.bind(...params),
      this.query,
      this.dialect,
      this.channel,
    );
  }

  all(...params: Primitive[]): Promise<unknown[]> {
    return this.channel.tracePromise(() => this.stmt.all(...params), {
      query: this.query,
      method: "prepare.all",
      dialect: this.dialect,
      params,
    });
  }

  run(...params: Primitive[]): Promise<{ success: boolean }> {
    return this.channel.tracePromise(() => this.stmt.run(...params), {
      query: this.query,
      method: "prepare.run",
      dialect: this.dialect,
      params,
    });
  }

  get(...params: Primitive[]): Promise<unknown> {
    return this.channel.tracePromise(() => this.stmt.get(...params), {
      query: this.query,
      method: "prepare.get",
      dialect: this.dialect,
      params,
    });
  }
}

import type { Sequelize, Options as SequelizeOptions } from "sequelize";
import type { Connector, ConnectorTransaction, DatabaseCapabilities, Primitive, SQLDialect, TransactionOptions } from "db0";
import { BoundableStatement } from "./_internal/statement.ts";

export interface ConnectorOptions extends SequelizeOptions {
  /** Existing Sequelize instance to use instead of creating a new one */
  instance?: Sequelize;
}

type InternalQuery = (sql: string, params?: Primitive[]) => Promise<unknown[]>;

export default function sequelizeConnector(opts: ConnectorOptions): Connector<Sequelize> {
  let _sequelize: Sequelize | Promise<Sequelize> | undefined;

  // Determine dialect from options or instance at construction time
  const dialect = mapDialect(opts.instance?.getDialect() ?? opts.dialect ?? "sqlite");
  const capabilities = getCapabilities(dialect);

  const getSequelize = async (): Promise<Sequelize> => {
    if (_sequelize) return _sequelize;
    if (opts.instance) {
      _sequelize = opts.instance;
      return _sequelize;
    }
    const { Sequelize } = await import("sequelize");
    _sequelize = new Sequelize(opts);
    return _sequelize;
  };

  const query: InternalQuery = async (sql, params) => {
    const sequelize = await getSequelize();
    const [results, metadata] = await sequelize.query(sql, { replacements: params });
    // Handle INSERT...RETURNING: SQLite returns results in first element
    if (Array.isArray(results) && results.length > 0) return results;
    // For INSERT without RETURNING, metadata might contain the result
    if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
      const rows = (metadata as any).rows ?? (metadata as any);
      if (Array.isArray(rows)) return rows;
    }
    return [];
  };

  const exec = async (sql: string) => {
    const sequelize = await getSequelize();
    return sequelize.query(sql);
  };

  return {
    name: "sequelize",
    dialect,
    capabilities,
    getInstance: () => getSequelize(),
    exec,
    prepare: (sql) => new StatementWrapper(sql, query),
    dispose: async () => {
      const sequelize = await _sequelize;
      await sequelize?.close?.();
      _sequelize = undefined;
    },
    beginTransaction: async (_opts?: TransactionOptions): Promise<ConnectorTransaction> => {
      const sequelize = await getSequelize();
      const transaction = await sequelize.transaction();

      const txQuery: InternalQuery = async (sql, params) => {
        const [results, metadata] = await sequelize.query(sql, { replacements: params, transaction });
        if (Array.isArray(results) && results.length > 0) return results;
        if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
          const rows = (metadata as any).rows ?? (metadata as any);
          if (Array.isArray(rows)) return rows;
        }
        return [];
      };

      const txExec = async (sql: string) => {
        return sequelize.query(sql, { transaction });
      };

      return {
        exec: txExec,
        prepare: (sql) => new StatementWrapper(sql, txQuery),
        commit: () => transaction.commit(),
        rollback: () => transaction.rollback(),
      };
    },
  };
}

function mapDialect(dialectName: string): SQLDialect {
  switch (dialectName) {
    case "mysql": case "mariadb": return "mysql";
    case "postgres": return "postgresql";
    case "sqlite": return "sqlite";
    case "mssql": return "mssql";
    default: return "sqlite";
  }
}

function getCapabilities(dialect: SQLDialect): DatabaseCapabilities {
  switch (dialect) {
    case "postgresql":
      return { supportsJSON: true, supportsBooleans: true, supportsArrays: true, supportsDates: true, supportsUUIDs: true, supportsTransactions: true, supportsBatch: true };
    case "mysql":
      return { supportsJSON: true, supportsBooleans: true, supportsArrays: false, supportsDates: true, supportsUUIDs: false, supportsTransactions: true, supportsBatch: true };
    case "mssql":
      return { supportsJSON: true, supportsBooleans: true, supportsArrays: false, supportsDates: true, supportsUUIDs: true, supportsTransactions: true, supportsBatch: true };
    case "sqlite": default:
      return { supportsJSON: true, supportsBooleans: false, supportsArrays: false, supportsDates: false, supportsUUIDs: false, supportsTransactions: true, supportsBatch: true };
  }
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
    const results = await this.#query(this.#sql, params);
    return { success: true, rows: results };
  }

  async get(...params: Primitive[]) {
    const results = await this.#query(this.#sql, params);
    return results[0];
  }
}

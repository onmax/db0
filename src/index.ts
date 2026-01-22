export { createDatabase } from "./database.ts";

export { connectors } from "./_connectors.ts";

export type {
  Connector,
  ConnectorCapabilities,
  ConnectorTransaction,
  Database,
  DatabaseCapabilities,
  DatabaseOptions,
  ExecResult,
  Primitive,
  SQLDialect,
  Statement,
  PreparedStatement,
  Transaction,
  TransactionOptions,
  TypeTransformerOptions,
} from "./types.ts";

export {
  resolveTransformers,
  transformInput,
  transformOutput,
  transformInputParams,
  transformOutputRows,
} from "./transformers.ts";

export {
  DatabaseError,
  ConnectionError,
  TransactionError,
  ValidationError,
  wrapError,
  wrapConnectionError,
  wrapTransactionError,
} from "./errors.ts";

export type { DatabaseErrorCode } from "./errors.ts";

export type { ConnectorName, ConnectorOptions } from "./_connectors.ts";

export type {
  DatabaseSchema,
  SchemaColumn,
  SchemaColumnType,
  SchemaTable,
} from "./schema.ts";

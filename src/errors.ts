/**
 * Error codes for database operations
 */
export type DatabaseErrorCode =
  | "CONNECTION_FAILED"
  | "CONNECTION_CLOSED"
  | "CONNECTION_TIMEOUT"
  | "TRANSACTION_FAILED"
  | "TRANSACTION_ALREADY_COMMITTED"
  | "TRANSACTION_ALREADY_ROLLED_BACK"
  | "VALIDATION_FAILED"
  | "TYPE_MISMATCH"
  | "SCHEMA_MISMATCH"
  | "QUERY_FAILED"
  | "UNKNOWN";

/**
 * Base error class for all database operations.
 * Provides consistent error handling with code, message, and original cause.
 */
export class DatabaseError extends Error {
  readonly code: DatabaseErrorCode;
  override readonly cause?: Error;

  constructor(
    message: string,
    code: DatabaseErrorCode = "UNKNOWN",
    cause?: Error,
  ) {
    super(message);
    this.name = "DatabaseError";
    this.code = code;
    this.cause = cause;
    if (cause?.stack) this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
  }
}

/**
 * Error thrown when a database connection fails.
 */
export class ConnectionError extends DatabaseError {
  constructor(
    message: string,
    code: DatabaseErrorCode = "CONNECTION_FAILED",
    cause?: Error,
  ) {
    super(message, code, cause);
    this.name = "ConnectionError";
  }
}

/**
 * Error thrown when a transaction operation fails.
 */
export class TransactionError extends DatabaseError {
  constructor(
    message: string,
    code: DatabaseErrorCode = "TRANSACTION_FAILED",
    cause?: Error,
  ) {
    super(message, code, cause);
    this.name = "TransactionError";
  }
}

/**
 * Error thrown when data validation fails (schema/type mismatches).
 */
export class ValidationError extends DatabaseError {
  constructor(
    message: string,
    code: DatabaseErrorCode = "VALIDATION_FAILED",
    cause?: Error,
  ) {
    super(message, code, cause);
    this.name = "ValidationError";
  }
}

/**
 * Wraps an unknown error into a DatabaseError, preserving the original cause.
 */
export function wrapError(
  error: unknown,
  message?: string,
  code?: DatabaseErrorCode,
): DatabaseError {
  if (error instanceof DatabaseError) return error;
  const cause = error instanceof Error ? error : new Error(String(error));
  return new DatabaseError(message ?? cause.message, code ?? "UNKNOWN", cause);
}

/**
 * Wraps an unknown error into a ConnectionError.
 */
export function wrapConnectionError(
  error: unknown,
  message?: string,
): ConnectionError {
  if (error instanceof ConnectionError) return error;
  const cause = error instanceof Error ? error : new Error(String(error));
  return new ConnectionError(
    message ?? cause.message,
    "CONNECTION_FAILED",
    cause,
  );
}

/**
 * Wraps an unknown error into a TransactionError.
 */
export function wrapTransactionError(
  error: unknown,
  message?: string,
): TransactionError {
  if (error instanceof TransactionError) return error;
  const cause = error instanceof Error ? error : new Error(String(error));
  return new TransactionError(
    message ?? cause.message,
    "TRANSACTION_FAILED",
    cause,
  );
}

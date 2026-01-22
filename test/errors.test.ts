import { describe, it, expect } from "vitest";
import {
  DatabaseError,
  ConnectionError,
  TransactionError,
  ValidationError,
  wrapError,
  wrapConnectionError,
  wrapTransactionError,
} from "../src/errors";

describe("error classes", () => {
  describe("DatabaseError", () => {
    it("creates error with message and code", () => {
      const error = new DatabaseError("test message", "QUERY_FAILED");
      expect(error.message).toBe("test message");
      expect(error.code).toBe("QUERY_FAILED");
      expect(error.name).toBe("DatabaseError");
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DatabaseError);
    });

    it("defaults code to UNKNOWN", () => {
      const error = new DatabaseError("test");
      expect(error.code).toBe("UNKNOWN");
    });

    it("preserves cause and appends stack", () => {
      const cause = new Error("original error");
      const error = new DatabaseError("wrapped", "UNKNOWN", cause);
      expect(error.cause).toBe(cause);
      expect(error.stack).toContain("Caused by:");
      expect(error.stack).toContain("original error");
    });

    it("handles cause without stack", () => {
      const cause = new Error("no stack");
      delete (cause as any).stack;
      const error = new DatabaseError("wrapped", "UNKNOWN", cause);
      expect(error.cause).toBe(cause);
    });

    it("supports all error codes", () => {
      const codes = [
        "CONNECTION_FAILED",
        "CONNECTION_CLOSED",
        "CONNECTION_TIMEOUT",
        "TRANSACTION_FAILED",
        "TRANSACTION_ALREADY_COMMITTED",
        "TRANSACTION_ALREADY_ROLLED_BACK",
        "VALIDATION_FAILED",
        "TYPE_MISMATCH",
        "SCHEMA_MISMATCH",
        "QUERY_FAILED",
        "UNKNOWN",
      ] as const;

      for (const code of codes) {
        const error = new DatabaseError("test", code);
        expect(error.code).toBe(code);
      }
    });
  });

  describe("ConnectionError", () => {
    it("creates error with correct name", () => {
      const error = new ConnectionError("connection failed");
      expect(error.name).toBe("ConnectionError");
      expect(error.code).toBe("CONNECTION_FAILED");
      expect(error).toBeInstanceOf(DatabaseError);
      expect(error).toBeInstanceOf(ConnectionError);
    });

    it("accepts custom code", () => {
      const error = new ConnectionError("timeout", "CONNECTION_TIMEOUT");
      expect(error.code).toBe("CONNECTION_TIMEOUT");
    });

    it("preserves cause", () => {
      const cause = new Error("ECONNREFUSED");
      const error = new ConnectionError(
        "cannot connect",
        "CONNECTION_FAILED",
        cause,
      );
      expect(error.cause).toBe(cause);
    });
  });

  describe("TransactionError", () => {
    it("creates error with correct name", () => {
      const error = new TransactionError("tx failed");
      expect(error.name).toBe("TransactionError");
      expect(error.code).toBe("TRANSACTION_FAILED");
      expect(error).toBeInstanceOf(DatabaseError);
      expect(error).toBeInstanceOf(TransactionError);
    });

    it("accepts custom code", () => {
      const error = new TransactionError(
        "already committed",
        "TRANSACTION_ALREADY_COMMITTED",
      );
      expect(error.code).toBe("TRANSACTION_ALREADY_COMMITTED");
    });

    it("preserves cause", () => {
      const cause = new Error("deadlock detected");
      const error = new TransactionError(
        "rollback",
        "TRANSACTION_FAILED",
        cause,
      );
      expect(error.cause).toBe(cause);
    });
  });

  describe("ValidationError", () => {
    it("creates error with correct name", () => {
      const error = new ValidationError("invalid data");
      expect(error.name).toBe("ValidationError");
      expect(error.code).toBe("VALIDATION_FAILED");
      expect(error).toBeInstanceOf(DatabaseError);
      expect(error).toBeInstanceOf(ValidationError);
    });

    it("accepts custom code", () => {
      const error = new ValidationError("wrong type", "TYPE_MISMATCH");
      expect(error.code).toBe("TYPE_MISMATCH");
    });

    it("preserves cause", () => {
      const cause = new Error("expected string got number");
      const error = new ValidationError("type error", "TYPE_MISMATCH", cause);
      expect(error.cause).toBe(cause);
    });
  });
});

describe("error wrapper functions", () => {
  describe("wrapError", () => {
    it("returns DatabaseError unchanged", () => {
      const original = new DatabaseError("test", "QUERY_FAILED");
      expect(wrapError(original)).toBe(original);
    });

    it("returns subclass errors unchanged", () => {
      const connection = new ConnectionError("test");
      const transaction = new TransactionError("test");
      const validation = new ValidationError("test");
      expect(wrapError(connection)).toBe(connection);
      expect(wrapError(transaction)).toBe(transaction);
      expect(wrapError(validation)).toBe(validation);
    });

    it("wraps Error instance", () => {
      const original = new Error("original");
      const wrapped = wrapError(original);
      expect(wrapped).toBeInstanceOf(DatabaseError);
      expect(wrapped.message).toBe("original");
      expect(wrapped.cause).toBe(original);
    });

    it("wraps string error", () => {
      const wrapped = wrapError("string error");
      expect(wrapped).toBeInstanceOf(DatabaseError);
      expect(wrapped.cause?.message).toBe("string error");
    });

    it("wraps non-Error objects", () => {
      const wrapped = wrapError({ foo: "bar" });
      expect(wrapped).toBeInstanceOf(DatabaseError);
      expect(wrapped.cause?.message).toBe("[object Object]");
    });

    it("uses custom message when provided", () => {
      const original = new Error("original");
      const wrapped = wrapError(original, "custom message");
      expect(wrapped.message).toBe("custom message");
    });

    it("uses custom code when provided", () => {
      const original = new Error("error");
      const wrapped = wrapError(original, "message", "QUERY_FAILED");
      expect(wrapped.code).toBe("QUERY_FAILED");
    });
  });

  describe("wrapConnectionError", () => {
    it("returns ConnectionError unchanged", () => {
      const original = new ConnectionError("test");
      expect(wrapConnectionError(original)).toBe(original);
    });

    it("wraps Error into ConnectionError", () => {
      const original = new Error("ECONNREFUSED");
      const wrapped = wrapConnectionError(original);
      expect(wrapped).toBeInstanceOf(ConnectionError);
      expect(wrapped.code).toBe("CONNECTION_FAILED");
      expect(wrapped.cause).toBe(original);
    });

    it("wraps string error", () => {
      const wrapped = wrapConnectionError("timeout");
      expect(wrapped).toBeInstanceOf(ConnectionError);
      expect(wrapped.cause?.message).toBe("timeout");
    });

    it("uses custom message when provided", () => {
      const original = new Error("original");
      const wrapped = wrapConnectionError(original, "failed to connect");
      expect(wrapped.message).toBe("failed to connect");
    });
  });

  describe("wrapTransactionError", () => {
    it("returns TransactionError unchanged", () => {
      const original = new TransactionError("test");
      expect(wrapTransactionError(original)).toBe(original);
    });

    it("wraps Error into TransactionError", () => {
      const original = new Error("deadlock");
      const wrapped = wrapTransactionError(original);
      expect(wrapped).toBeInstanceOf(TransactionError);
      expect(wrapped.code).toBe("TRANSACTION_FAILED");
      expect(wrapped.cause).toBe(original);
    });

    it("wraps string error", () => {
      const wrapped = wrapTransactionError("rollback failed");
      expect(wrapped).toBeInstanceOf(TransactionError);
      expect(wrapped.cause?.message).toBe("rollback failed");
    });

    it("uses custom message when provided", () => {
      const original = new Error("original");
      const wrapped = wrapTransactionError(original, "transaction aborted");
      expect(wrapped.message).toBe("transaction aborted");
    });
  });
});

describe("error inheritance chain", () => {
  it("ConnectionError inherits from DatabaseError", () => {
    const error = new ConnectionError("test");
    expect(error instanceof Error).toBe(true);
    expect(error instanceof DatabaseError).toBe(true);
    expect(error instanceof ConnectionError).toBe(true);
    expect(error instanceof TransactionError).toBe(false);
    expect(error instanceof ValidationError).toBe(false);
  });

  it("TransactionError inherits from DatabaseError", () => {
    const error = new TransactionError("test");
    expect(error instanceof Error).toBe(true);
    expect(error instanceof DatabaseError).toBe(true);
    expect(error instanceof TransactionError).toBe(true);
    expect(error instanceof ConnectionError).toBe(false);
    expect(error instanceof ValidationError).toBe(false);
  });

  it("ValidationError inherits from DatabaseError", () => {
    const error = new ValidationError("test");
    expect(error instanceof Error).toBe(true);
    expect(error instanceof DatabaseError).toBe(true);
    expect(error instanceof ValidationError).toBe(true);
    expect(error instanceof ConnectionError).toBe(false);
    expect(error instanceof TransactionError).toBe(false);
  });

  it("allows catching all database errors", () => {
    const errors = [
      new DatabaseError("db"),
      new ConnectionError("conn"),
      new TransactionError("tx"),
      new ValidationError("val"),
    ];

    for (const error of errors) {
      expect(error instanceof DatabaseError).toBe(true);
    }
  });
});

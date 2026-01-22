import type { DatabaseCapabilities, TypeTransformerOptions } from "./types.ts";
export type { TypeTransformerOptions } from "./types.ts";

/**
 * Resolves transformer options based on database capabilities.
 * Returns which transformations should be applied.
 */
export function resolveTransformers(
  capabilities: DatabaseCapabilities,
  options?: TypeTransformerOptions,
): Required<TypeTransformerOptions> {
  if (options?.disabled) {
    return { booleans: false, dates: false, json: false, disabled: true };
  }

  return {
    booleans: options?.booleans ?? !capabilities.supportsBooleans,
    dates: options?.dates ?? !capabilities.supportsDates,
    json: options?.json ?? !capabilities.supportsJSON,
    disabled: false,
  };
}

/**
 * Transform a single value from JS types to database-compatible types (for input parameters).
 */
export function transformInput(
  value: unknown,
  transformers: Required<TypeTransformerOptions>,
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  // Boolean → Integer (for SQLite/D1)
  if (transformers.booleans && typeof value === "boolean") {
    return value ? 1 : 0;
  }

  // Date → ISO String
  if (transformers.dates && value instanceof Date) {
    return value.toISOString();
  }

  // JSON object/array → String
  if (
    transformers.json &&
    typeof value === "object" &&
    !(value instanceof Date)
  ) {
    return JSON.stringify(value);
  }

  return value;
}

/**
 * Transform input parameters array.
 */
export function transformInputParams(
  params: unknown[],
  transformers: Required<TypeTransformerOptions>,
): unknown[] {
  if (transformers.disabled) {
    return params;
  }
  return params.map((p) => transformInput(p, transformers));
}

/**
 * Check if a string looks like an ISO date string.
 */
function isISODateString(value: string): boolean {
  // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ or YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/.test(value)) {
    return false;
  }
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

/**
 * Check if a string looks like JSON.
 */
function isJSONString(value: string): boolean {
  if (value.length < 2) return false;
  const first = value[0];
  const last = value.at(-1);
  // Check for object or array
  if ((first === "{" && last === "}") || (first === "[" && last === "]")) {
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Transform a single value from database types back to JS types (for output rows).
 */
export function transformOutput(
  value: unknown,
  transformers: Required<TypeTransformerOptions>,
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  // Integer → Boolean (for SQLite/D1)
  // Note: We can't automatically detect this since integers and booleans-as-integers are indistinguishable
  // This transformation is only applied when explicitly known to be a boolean field

  // ISO String → Date
  if (
    transformers.dates &&
    typeof value === "string" &&
    isISODateString(value)
  ) {
    return new Date(value);
  }

  // JSON String → Object/Array
  if (transformers.json && typeof value === "string" && isJSONString(value)) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return value;
}

/**
 * Transform a single row from database output.
 */
export function transformRow(
  row: Record<string, unknown>,
  transformers: Required<TypeTransformerOptions>,
): Record<string, unknown> {
  if (transformers.disabled) {
    return row;
  }

  const result: Record<string, unknown> = {};
  for (const key of Object.keys(row)) {
    result[key] = transformOutput(row[key], transformers);
  }
  return result;
}

/**
 * Transform output rows array.
 */
export function transformOutputRows<T>(
  rows: T[],
  transformers: Required<TypeTransformerOptions>,
): T[] {
  if (transformers.disabled) {
    return rows;
  }

  // Handle array-like results (objects with numeric keys + columns metadata)
  // These come from certain drivers like libsql
  if (rows.length > 0 && rows[0] && typeof rows[0] === "object") {
    return rows.map((row) => {
      if (row && typeof row === "object") {
        return transformRow(row as Record<string, unknown>, transformers) as T;
      }
      return row;
    });
  }

  return rows;
}

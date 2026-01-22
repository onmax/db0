import type { DatabaseCapabilities } from "../../types.ts";

export const mysqlCapabilities: DatabaseCapabilities = {
  supportsJSON: true,
  supportsBooleans: false,
  supportsArrays: false,
  supportsDates: true,
  supportsUUIDs: false,
  supportsTransactions: true,
  supportsBatch: true,
};

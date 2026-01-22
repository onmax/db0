---
icon: i-simple-icons-shield
---

# better-auth

> Integrate DB0 with better-auth authentication library

:read-more{to="https://www.better-auth.com"}

## Overview

The `betterAuthAdapter` provides a drop-in compatible database adapter for better-auth using db0's universal database layer. This allows you to use any db0-supported database with better-auth.

## Quick Start

```ts [auth.ts]
import { createDatabase } from "db0";
import sqlite from "db0/connectors/better-sqlite3";
import { betterAuthAdapter } from "db0/integrations/better-auth";
import { betterAuth } from "better-auth";

// Create db0 database instance
const db = createDatabase(sqlite({ name: "auth.sqlite" }));

// Create better-auth compatible adapter
const adapter = betterAuthAdapter(db);

// Use with better-auth
export const auth = betterAuth({
  database: adapter,
  // ... other options
});
```

## Supported Databases

The adapter works with all db0 connectors:

- **SQLite**: better-sqlite3, bun:sqlite, node:sqlite
- **PostgreSQL**: pg, @neondatabase/serverless, @electric-sql/pglite
- **MySQL**: mysql2, @planetscale/database
- **Edge/Serverless**: Cloudflare D1, Turso/LibSQL

## Method Signatures

The adapter implements better-auth's `DBAdapter` interface:

| Method | Description |
|--------|-------------|
| `create` | Insert a new record |
| `findOne` | Find single record by conditions |
| `findMany` | Find multiple records with pagination |
| `update` | Update single record |
| `updateMany` | Update multiple records |
| `delete` | Delete single record |
| `deleteMany` | Delete multiple records |
| `count` | Count records matching conditions |
| `transaction` | Execute operations in a transaction |

## Where Clause Operators

The adapter supports all better-auth where operators:

```ts
// Equality (default)
{ field: "id", value: "123" }
{ field: "id", operator: "eq", value: "123" }

// Inequality
{ field: "status", operator: "ne", value: "inactive" }

// Comparison
{ field: "createdAt", operator: "gt", value: "2024-01-01" }
{ field: "createdAt", operator: "gte", value: "2024-01-01" }
{ field: "age", operator: "lt", value: 18 }
{ field: "age", operator: "lte", value: 65 }

// Array operations
{ field: "role", operator: "in", value: ["admin", "moderator"] }
{ field: "status", operator: "not_in", value: ["banned", "suspended"] }

// String matching
{ field: "email", operator: "contains", value: "@example.com" }
{ field: "name", operator: "starts_with", value: "John" }
{ field: "domain", operator: "ends_with", value: ".com" }
```

Combine conditions with connectors:

```ts
const user = await adapter.findOne({
  model: "user",
  where: [
    { field: "email", value: "john@example.com" },
    { field: "emailVerified", value: true, connector: "AND" },
  ],
});
```

## Configuration

```ts
const adapter = betterAuthAdapter(db, {
  // Adapter identification
  adapterId: "my-db0-adapter",
  adapterName: "My DB0 Adapter",

  // Table naming
  usePlural: false, // true: "users", false: "user"

  // Capability flags (auto-detected from db capabilities)
  supportsJSON: true,
  supportsBooleans: true,
  supportsDates: true,
  supportsArrays: false,
  supportsUUIDs: false,

  // ID generation
  disableIdGeneration: false,
  customIdGenerator: ({ model }) => `${model}-${crypto.randomUUID()}`,

  // Field mapping (for custom column names)
  mapKeysTransformInput: { id: "_id" },
  mapKeysTransformOutput: { id: "_id" },

  // Custom transformations
  customTransformInput: ({ data, field, model }) => data,
  customTransformOutput: ({ data, field, model }) => data,
});
```

## Capability Flags

Access resolved capabilities via `adapter.capabilities`:

```ts
const adapter = betterAuthAdapter(db);

console.log(adapter.capabilities);
// {
//   supportsJSON: false,      // SQLite doesn't have native JSON
//   supportsBooleans: false,  // SQLite stores as 0/1
//   supportsDates: false,     // SQLite stores as ISO strings
//   supportsArrays: false,
//   supportsUUIDs: false,
//   supportsTransactions: true,
//   supportsBatch: true,
//   supportsNumericIds: true,
// }
```

## Type Transformations

The adapter automatically handles type transformations based on database capabilities:

| JS Type | SQLite/D1 | PostgreSQL | MySQL |
|---------|-----------|------------|-------|
| `boolean` | 0/1 | native | native |
| `Date` | ISO string | native | native |
| `object` (JSON) | JSON string | native JSONB | native JSON |
| `array` | JSON string | native | JSON string |

## Transactions

```ts
await adapter.transaction(async (tx) => {
  const user = await tx.create({
    model: "user",
    data: { name: "John", email: "john@example.com" },
  });

  await tx.create({
    model: "session",
    data: { userId: user.id, token: "..." },
  });
});
// Auto-commits on success, auto-rollbacks on error
```

## Migration from better-auth Adapters

If migrating from a native better-auth adapter (like `drizzleAdapter` or `prismaAdapter`):

### Before (better-auth drizzle adapter)

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./drizzle";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "sqlite" }),
});
```

### After (db0 adapter)

```ts
import { betterAuth } from "better-auth";
import { createDatabase } from "db0";
import sqlite from "db0/connectors/better-sqlite3";
import { betterAuthAdapter } from "db0/integrations/better-auth";

const db = createDatabase(sqlite({ name: "auth.sqlite" }));

export const auth = betterAuth({
  database: betterAuthAdapter(db),
});
```

### Key Differences

1. **No provider specification needed** - db0 auto-detects the dialect
2. **Unified connector interface** - Same API regardless of database
3. **Automatic type transformations** - Based on database capabilities
4. **Built-in transaction support** - Uses db0's transaction API

## PostgreSQL Example

```ts
import { createDatabase } from "db0";
import postgresql from "db0/connectors/postgresql";
import { betterAuthAdapter } from "db0/integrations/better-auth";

const db = createDatabase(postgresql({
  url: process.env.DATABASE_URL,
}));

const adapter = betterAuthAdapter(db);
```

## Cloudflare D1 Example

```ts
import { createDatabase } from "db0";
import cloudflareD1 from "db0/connectors/cloudflare-d1";
import { betterAuthAdapter } from "db0/integrations/better-auth";

export default {
  async fetch(request: Request, env: Env) {
    const db = createDatabase(cloudflareD1({ binding: env.DB }));
    const adapter = betterAuthAdapter(db);

    // Use adapter with better-auth...
  },
};
```

## Turso/LibSQL Example

```ts
import { createDatabase } from "db0";
import libsql from "db0/connectors/libsql/web";
import { betterAuthAdapter } from "db0/integrations/better-auth";

const db = createDatabase(libsql({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
}));

const adapter = betterAuthAdapter(db);
```

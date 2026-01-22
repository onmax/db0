---
icon: simple-icons:drizzle
---

# Drizzle

> Integrate DB0 with Drizzle ORM

:read-more{to="https://orm.drizzle.team"}

DB0 provides two ways to use Drizzle:

1. **`drizzle()`** - Full Drizzle instance for native Drizzle queries
2. **`drizzleAdapter()`** - Model API for simplified CRUD operations

## Quick Start with drizzle()

Define your schema:

```ts [schema.ts]
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  fullName: text('full_name').notNull(),
  email: text('email').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

Initialize and use:

```ts [database.ts]
import { createDatabase } from "db0";
import sqlite from "db0/connectors/better-sqlite3";
import { drizzle } from "db0/integrations/drizzle";
import * as schema from "./schema";

const db0 = createDatabase(sqlite({ name: 'database.sqlite' }));
export const db = drizzle(db0, { schema });

// Use Drizzle's native query API
const allUsers = await db.select().from(schema.users);
const johnDoe = await db.select()
  .from(schema.users)
  .where(eq(schema.users.email, 'john@example.com'));
```

## Drizzle Adapter (Model API)

The `drizzleAdapter()` provides a simplified Model API for common CRUD operations:

```ts
import { createDatabase } from "db0";
import sqlite from "db0/connectors/better-sqlite3";
import { drizzleAdapter } from "db0/integrations/drizzle";
import * as schema from "./schema";

const db0 = createDatabase(sqlite({}));
const { native, model } = drizzleAdapter(db0, schema);

// native = full Drizzle instance
// model() = simplified Model API
```

### Model API Methods

```ts
const users = model('users');

// Find one record
const user = await users.findOne({
  where: { id: 1 }
});

// Find many with filtering, sorting, pagination
const activeUsers = await users.findMany({
  where: { active: true },
  orderBy: { createdAt: 'desc' },
  limit: 10,
  offset: 0
});

// Select specific fields
const emails = await users.findMany({
  select: ['id', 'email']
});

// Create
const newUser = await users.create({
  data: { fullName: 'John Doe', email: 'john@example.com' }
});

// Create many
const newUsers = await users.createMany({
  data: [
    { fullName: 'Jane', email: 'jane@example.com' },
    { fullName: 'Bob', email: 'bob@example.com' }
  ]
});

// Update (returns first matching record)
const updated = await users.update({
  where: { id: 1 },
  data: { fullName: 'John Updated' }
});

// Update many
const updatedUsers = await users.updateMany({
  where: { active: false },
  data: { active: true }
});

// Delete (requires where clause)
const deleted = await users.delete({
  where: { id: 1 }
});

// Delete many
const deletedUsers = await users.deleteMany({
  where: { active: false }
});

// Count
const total = await users.count();
const activeCount = await users.count({ where: { active: true } });
```

### Where Operators

```ts
// Direct value (equals)
await users.findMany({ where: { id: 1 } });

// Operators
await users.findMany({
  where: {
    age: { gt: 18 },        // greater than
    age: { gte: 18 },       // greater than or equal
    age: { lt: 65 },        // less than
    age: { lte: 65 },       // less than or equal
    name: { ne: 'Admin' },  // not equal
    email: { like: '%@gmail.com' },  // LIKE pattern
    role: { in: ['admin', 'moderator'] }  // IN array
  }
});
```

### Accessing Native Drizzle

The adapter exposes the full Drizzle instance for complex queries:

```ts
const { native, model } = drizzleAdapter(db0, schema);

// Use Model API for simple operations
const user = await model('users').findOne({ where: { id: 1 } });

// Use native Drizzle for complex operations
const result = await native
  .select()
  .from(schema.users)
  .leftJoin(schema.posts, eq(schema.users.id, schema.posts.authorId))
  .where(eq(schema.users.active, true));
```

## Configuration

### Drizzle Config

Create a `drizzle.config.ts` for migrations:

```ts [drizzle.config.ts]
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './schema.ts',
  out: './migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: './database.sqlite'
  }
});
```

### Migration Commands

```bash
# Generate migration from schema
npx drizzle-kit generate

# Apply migrations
npx drizzle-kit migrate

# Push schema directly (development)
npx drizzle-kit push
```

## PostgreSQL Example

```ts [schema.ts]
import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});
```

```ts [database.ts]
import { createDatabase } from "db0";
import postgresql from "db0/connectors/postgresql";
import { drizzleAdapter } from "db0/integrations/drizzle";
import * as schema from "./schema";

const db0 = createDatabase(postgresql({
  url: process.env.DATABASE_URL
}));

const { model } = drizzleAdapter(db0, schema);

const users = model('users');
await users.create({ data: { email: 'user@example.com', name: 'User' } });
```

## MySQL Example

```ts [schema.ts]
import { mysqlTable, serial, varchar, boolean, timestamp } from "drizzle-orm/mysql-core";

export const users = mysqlTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});
```

```ts [database.ts]
import { createDatabase } from "db0";
import mysql from "db0/connectors/mysql2";
import { drizzleAdapter } from "db0/integrations/drizzle";
import * as schema from "./schema";

const db0 = createDatabase(mysql({
  url: process.env.DATABASE_URL
}));

const { model } = drizzleAdapter(db0, schema);
```

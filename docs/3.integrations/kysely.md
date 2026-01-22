---
icon: mynaui:letter-k
---

# Kysely

> Integrate DB0 with Kysely

:read-more{to="https://kysely.dev"}

The `kyselyAdapter()` wraps an existing Kysely instance to provide a unified Model API compatible with DB0's other integrations.

## Quick Start

```ts
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { kyselyAdapter } from "db0/integrations/kysely";

// Define your database types
interface Database {
  users: {
    id: Generated<number>;
    email: string;
    name: string;
    active: boolean;
    created_at: Generated<Date>;
  };
  posts: {
    id: Generated<number>;
    title: string;
    content: string | null;
    author_id: number;
  };
}

// Create Kysely instance
const kysely = new Kysely<Database>({
  dialect: new PostgresDialect({
    pool: new Pool({ connectionString: process.env.DATABASE_URL })
  })
});

// Create adapter
const adapter = kyselyAdapter(kysely, {
  tableNames: ['users', 'posts']  // optional: list table names
});

// Use Model API
const users = adapter.model('users');
const user = await users.findOne({ where: { id: 1 } });
```

## Adapter Properties

```ts
const adapter = kyselyAdapter(kysely);

adapter.native       // Original Kysely instance
adapter.dialect      // 'postgresql' | 'mysql' | 'sqlite'
adapter.capabilities // Database capability flags
adapter.tables       // Table definitions
```

## Model API

### findOne

Find a single record:

```ts
const user = await users.findOne({
  where: { id: 1 },
  select: ['id', 'email']  // optional field selection
});
```

### findMany

Find multiple records with filtering, sorting, and pagination:

```ts
const activeUsers = await users.findMany({
  where: { active: true },
  orderBy: { created_at: 'desc' },
  limit: 10,
  offset: 0,
  select: ['id', 'email', 'name']
});
```

### create

Create a new record (returns the created row):

```ts
const user = await users.create({
  email: 'user@example.com',
  name: 'New User',
  active: true
});
```

### createMany

Create multiple records:

```ts
const result = await users.createMany([
  { email: 'user1@example.com', name: 'User 1', active: true },
  { email: 'user2@example.com', name: 'User 2', active: true }
]);
// result: { count: 2 }
```

### update

Update a single record:

```ts
const updated = await users.update({
  where: { id: 1 },
  data: { name: 'Updated Name' }
});
```

### updateMany

Update multiple records:

```ts
const updated = await users.updateMany({
  where: { active: false },
  data: { active: true }
});
// Returns array of updated rows
```

### delete

Delete a single record (requires where clause):

```ts
const deleted = await users.delete({
  where: { id: 1 }
});
```

### deleteMany

Delete multiple records (requires where clause):

```ts
const result = await users.deleteMany({
  where: { active: false }
});
// result: { count: number }
```

### count

Count records:

```ts
const total = await users.count();
const active = await users.count({ where: { active: true } });
```

## Where Operators

```ts
await users.findMany({
  where: {
    // Direct value (equals)
    id: 1,

    // Comparison operators
    age: { gt: 18 },      // greater than
    age: { gte: 18 },     // greater than or equal
    age: { lt: 65 },      // less than
    age: { lte: 65 },     // less than or equal
    name: { ne: 'Admin' }, // not equal

    // String operators
    email: { like: '%@gmail.com' },

    // Array operators
    role: { in: ['admin', 'moderator'] },

    // Null checks
    deletedAt: { isNull: true },
    email: { isNotNull: true }
  }
});
```

## Transactions

Execute multiple operations atomically:

```ts
const result = await adapter.transaction(async (tx) => {
  const user = await tx.model('users').create({
    email: 'new@example.com',
    name: 'New User',
    active: true
  });

  await tx.model('posts').create({
    title: 'First Post',
    content: 'Hello!',
    author_id: user.id
  });

  return user;
});
```

## Accessing Native Kysely

For complex queries not covered by the Model API:

```ts
const { native, model } = kyselyAdapter(kysely);

// Use Model API for simple CRUD
const user = await model('users').findOne({ where: { id: 1 } });

// Use native Kysely for complex queries
const usersWithPosts = await native
  .selectFrom('users')
  .leftJoin('posts', 'posts.author_id', 'users.id')
  .select(['users.id', 'users.name', 'posts.title'])
  .where('users.active', '=', true)
  .execute();

// Subqueries
const usersWithPostCount = await native
  .selectFrom('users')
  .select((eb) => [
    'users.id',
    'users.name',
    eb.selectFrom('posts')
      .whereRef('posts.author_id', '=', 'users.id')
      .select(eb.fn.countAll().as('count'))
      .as('post_count')
  ])
  .execute();
```

## Cleanup

Destroy connection pool when done:

```ts
await adapter.dispose();
// Calls kysely.destroy()
```

## Configuration

```ts
const adapter = kyselyAdapter(kysely, {
  dialect: 'postgresql',      // optional: override dialect detection
  tableNames: ['users', 'posts']  // optional: pre-register table names
});
```

## Setup Example

1. Install dependencies:

```bash
pnpm add kysely pg db0
```

2. Define types:

```ts [types.ts]
import { Generated, ColumnType } from "kysely";

export interface Database {
  users: UsersTable;
  posts: PostsTable;
}

interface UsersTable {
  id: Generated<number>;
  email: string;
  name: string;
  active: boolean;
  created_at: Generated<Date>;
}

interface PostsTable {
  id: Generated<number>;
  title: string;
  content: string | null;
  published: boolean;
  author_id: number;
  created_at: Generated<Date>;
}
```

3. Create database:

```ts [database.ts]
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { kyselyAdapter } from "db0/integrations/kysely";
import type { Database } from "./types";

const kysely = new Kysely<Database>({
  dialect: new PostgresDialect({
    pool: new Pool({ connectionString: process.env.DATABASE_URL })
  })
});

export const adapter = kyselyAdapter(kysely, {
  tableNames: ['users', 'posts']
});

export const users = adapter.model('users');
export const posts = adapter.model('posts');
```

4. Use in your app:

```ts
import { users, posts } from "./database";

// Create user
const user = await users.create({
  email: 'john@example.com',
  name: 'John Doe',
  active: true
});

// Create post
await posts.create({
  title: 'My First Post',
  content: 'Hello World!',
  published: true,
  author_id: user.id
});

// Query
const activeUsers = await users.findMany({
  where: { active: true },
  orderBy: { created_at: 'desc' }
});
```

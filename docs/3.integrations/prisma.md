---
icon: simple-icons:prisma
---

# Prisma

> Integrate DB0 with Prisma ORM

:read-more{to="https://www.prisma.io"}

The `prismaAdapter()` wraps an existing Prisma client to provide a unified Model API compatible with DB0's other integrations.

## Quick Start

```ts
import { PrismaClient } from "@prisma/client";
import { prismaAdapter } from "db0/integrations/prisma";

const prisma = new PrismaClient();
const adapter = prismaAdapter(prisma);

// Access models through the adapter
const users = adapter.model('user');

// Find records
const user = await users.findOne({ where: { id: 1 } });
const allUsers = await users.findMany();

// Create
const newUser = await users.create({ email: 'john@example.com', name: 'John' });

// Update
const updated = await users.update({
  where: { id: 1 },
  data: { name: 'John Updated' }
});

// Delete
const deleted = await users.delete({ where: { id: 1 } });

// Count
const total = await users.count();
```

## Adapter Properties

```ts
const adapter = prismaAdapter(prisma);

adapter.native       // Original Prisma client
adapter.dialect      // 'postgresql' | 'mysql' | 'sqlite'
adapter.capabilities // Database capability flags
adapter.tables       // Model definitions
```

## Model API

### findOne

Find a single record by unique identifier:

```ts
const user = await users.findOne({
  where: { id: 1 },
  select: { id: true, email: true },  // optional field selection
  include: { posts: true }             // optional relations
});
```

### findMany

Find multiple records with filtering, sorting, and pagination:

```ts
const activeUsers = await users.findMany({
  where: { active: true },
  orderBy: { createdAt: 'desc' },
  take: 10,      // limit
  skip: 0,       // offset
  select: { id: true, email: true }
});
```

### create

Create a new record:

```ts
const user = await users.create({
  email: 'user@example.com',
  name: 'New User',
  profile: {
    create: { bio: 'Hello!' }  // nested create
  }
});
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
const result = await users.updateMany({
  where: { active: false },
  data: { deletedAt: new Date() }
});
// result: { count: number }
```

### delete

Delete a single record:

```ts
const deleted = await users.delete({
  where: { id: 1 }
});
```

### deleteMany

Delete multiple records:

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

Prisma's full where syntax is supported:

```ts
await users.findMany({
  where: {
    // Direct value
    id: 1,

    // Operators
    age: { gt: 18 },
    age: { gte: 18 },
    age: { lt: 65 },
    age: { lte: 65 },
    name: { not: 'Admin' },
    email: { contains: '@gmail.com' },
    email: { startsWith: 'john' },
    email: { endsWith: '.com' },
    role: { in: ['admin', 'moderator'] },
    role: { notIn: ['guest'] },

    // Logical operators
    AND: [{ active: true }, { verified: true }],
    OR: [{ role: 'admin' }, { role: 'moderator' }],
    NOT: { banned: true }
  }
});
```

## Transactions

Execute multiple operations atomically:

```ts
const result = await adapter.transaction(async (tx) => {
  const user = await tx.model('user').create({
    email: 'new@example.com',
    name: 'New User'
  });

  await tx.model('profile').create({
    userId: user.id,
    bio: 'Welcome!'
  });

  return user;
});
```

### Transaction Options

```ts
await adapter.transaction(async (tx) => {
  // ...
}, {
  maxWait: 5000,      // max wait for transaction slot (ms)
  timeout: 10000,     // max transaction duration (ms)
  isolationLevel: 'Serializable'  // isolation level
});
```

## Accessing Native Prisma

For complex queries not covered by the Model API:

```ts
const { native, model } = prismaAdapter(prisma);

// Use Model API for simple CRUD
const user = await model('user').findOne({ where: { id: 1 } });

// Use native Prisma for complex queries
const usersWithPosts = await native.user.findMany({
  include: {
    posts: {
      where: { published: true },
      orderBy: { createdAt: 'desc' },
      take: 5
    }
  }
});

// Raw queries
const result = await native.$queryRaw`SELECT * FROM users WHERE id = ${id}`;
```

## Cleanup

Disconnect when done:

```ts
await adapter.dispose();
// Calls prisma.$disconnect()
```

## Setup Example

1. Install dependencies:

```bash
pnpm add @prisma/client db0
pnpm add -D prisma
```

2. Initialize Prisma:

```bash
npx prisma init
```

3. Define your schema:

```prisma [prisma/schema.prisma]
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  posts     Post[]
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  authorId  Int
  author    User     @relation(fields: [authorId], references: [id])
}
```

4. Generate client and migrate:

```bash
npx prisma generate
npx prisma migrate dev
```

5. Use with DB0:

```ts [database.ts]
import { PrismaClient } from "@prisma/client";
import { prismaAdapter } from "db0/integrations/prisma";

const prisma = new PrismaClient();
export const adapter = prismaAdapter(prisma);

// Use Model API
const users = adapter.model('user');
const posts = adapter.model('post');
```

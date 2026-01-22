---
icon: simple-icons:typeorm
---

# TypeORM

> Integrate DB0 with TypeORM

:read-more{to="https://typeorm.io"}

The `typeormAdapter()` wraps an existing TypeORM DataSource to provide a unified Model API compatible with DB0's other integrations.

## Quick Start

```ts
import { DataSource, EntitySchema } from "typeorm";
import { typeormAdapter } from "db0/integrations/typeorm";

// Define entity using EntitySchema
const UserEntity = new EntitySchema({
  name: "User",
  tableName: "users",
  columns: {
    id: { type: Number, primary: true, generated: true },
    email: { type: String },
    name: { type: String },
    active: { type: Boolean, default: true },
  },
});

// Create DataSource
const dataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities: [UserEntity],
  synchronize: true,
});

await dataSource.initialize();

// Create adapter
const adapter = typeormAdapter(dataSource, {
  entities: { User: UserEntity }
});

// Use Model API
const users = adapter.model('User');
const user = await users.findOne({ where: { id: 1 } });
```

## Adapter Properties

The adapter exposes several properties for accessing the underlying TypeORM instance and metadata:

```ts
const adapter = typeormAdapter(dataSource, { entities });

adapter.native       // Original DataSource
adapter.dialect      // 'postgresql' | 'mysql' | 'sqlite'
adapter.capabilities // Database capability flags
adapter.entities     // Entity definitions
```

## Entity Definitions

TypeORM supports both decorator-based entities and EntitySchema. The adapter works with both approaches.

### Using EntitySchema

EntitySchema provides a decorator-free way to define entities, which works well with DB0:

```ts
import { EntitySchema } from "typeorm";

const UserEntity = new EntitySchema({
  name: "User",
  tableName: "users",
  columns: {
    id: { type: Number, primary: true, generated: true },
    email: { type: String },
    name: { type: String },
    active: { type: Boolean, default: true },
    createdAt: { type: Date, createDate: true },
  },
});

const PostEntity = new EntitySchema({
  name: "Post",
  tableName: "posts",
  columns: {
    id: { type: Number, primary: true, generated: true },
    title: { type: String },
    content: { type: String, nullable: true },
    authorId: { type: Number },
  },
});
```

### Using Decorator Classes

You can also use TypeORM's decorator-based entities:

```ts
import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("users")
class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  email: string;

  @Column()
  name: string;

  @Column({ default: true })
  active: boolean;
}

// Pass class to adapter
const adapter = typeormAdapter(dataSource, {
  entities: { User }
});
```

## Model API

### findOne

Use `findOne` to retrieve a single record matching the criteria:

```ts
const user = await users.findOne({
  where: { id: 1 },
  select: ['id', 'email']  // optional field selection
});
```

### findMany

Use `findMany` to retrieve multiple records with filtering, sorting, and pagination:

```ts
const activeUsers = await users.findMany({
  where: { active: true },
  orderBy: { createdAt: 'desc' },
  limit: 10,
  offset: 0,
  select: ['id', 'email', 'name']
});
```

### create

Use `create` to insert a new record. The method returns the created row:

```ts
const user = await users.create({
  email: 'user@example.com',
  name: 'New User',
  active: true
});
```

### createMany

Use `createMany` to insert multiple records at once:

```ts
const result = await users.createMany([
  { email: 'user1@example.com', name: 'User 1', active: true },
  { email: 'user2@example.com', name: 'User 2', active: true }
]);
// result: { count: 2 }
```

### update

Use `update` to modify a single record:

```ts
const updated = await users.update({
  where: { id: 1 },
  data: { name: 'Updated Name' }
});
```

### updateMany

Use `updateMany` to modify multiple records matching the criteria:

```ts
const updated = await users.updateMany({
  where: { active: false },
  data: { active: true }
});
// Returns array of updated rows
```

### delete

Use `delete` to remove a single record. A where clause is required:

```ts
const deleted = await users.delete({
  where: { id: 1 }
});
```

### deleteMany

Use `deleteMany` to remove multiple records. A where clause is required:

```ts
const result = await users.deleteMany({
  where: { active: false }
});
// result: { count: number }
```

### count

Use `count` to get the number of records:

```ts
const total = await users.count();
const active = await users.count({ where: { active: true } });
```

## Where Operators

The where clause supports several operators for filtering:

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

Use `transaction` to execute multiple operations atomically:

```ts
const result = await adapter.transaction(async (tx) => {
  const user = await tx.model('User').create({
    email: 'new@example.com',
    name: 'New User',
    active: true
  });

  await tx.model('Post').create({
    title: 'First Post',
    content: 'Hello!',
    authorId: user.id
  });

  return user;
});
```

You can specify an isolation level for the transaction:

```ts
await adapter.transaction(async (tx) => {
  // ...
}, {
  isolationLevel: 'SERIALIZABLE'
});
```

## Accessing Native TypeORM

For complex queries not covered by the Model API, access the native DataSource:

```ts
const { native, model } = typeormAdapter(dataSource, { entities });

// Use Model API for simple CRUD
const user = await model('User').findOne({ where: { id: 1 } });

// Use native DataSource for complex queries
const userRepo = native.getRepository(UserEntity);
const usersWithPosts = await userRepo
  .createQueryBuilder('user')
  .leftJoinAndSelect('user.posts', 'posts')
  .where('user.active = :active', { active: true })
  .getMany();

// Raw SQL
const results = await native.query(`
  SELECT u.*, COUNT(p.id) as post_count
  FROM users u
  LEFT JOIN posts p ON p.author_id = u.id
  GROUP BY u.id
`);
```

## Cleanup

Call `dispose` to destroy the connection when done:

```ts
await adapter.dispose();
// Calls dataSource.destroy()
```

## Configuration

The adapter accepts a configuration object with the following options:

```ts
const adapter = typeormAdapter(dataSource, {
  dialect: 'postgresql',  // optional: override dialect detection
  entities: {             // required: map of entity names to targets
    User: UserEntity,
    Post: PostEntity
  }
});
```

## Setup Example

### Install dependencies

```bash
pnpm add typeorm pg db0
```

### Define entities

```ts [entities.ts]
import { EntitySchema } from "typeorm";

export const UserEntity = new EntitySchema({
  name: "User",
  tableName: "users",
  columns: {
    id: { type: Number, primary: true, generated: true },
    email: { type: String },
    name: { type: String },
    active: { type: Boolean, default: true },
    createdAt: { type: Date, createDate: true },
  },
});

export const PostEntity = new EntitySchema({
  name: "Post",
  tableName: "posts",
  columns: {
    id: { type: Number, primary: true, generated: true },
    title: { type: String },
    content: { type: String, nullable: true },
    published: { type: Boolean, default: false },
    authorId: { type: Number },
    createdAt: { type: Date, createDate: true },
  },
});
```

### Create database connection

```ts [database.ts]
import { DataSource } from "typeorm";
import { typeormAdapter } from "db0/integrations/typeorm";
import { UserEntity, PostEntity } from "./entities";

const dataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities: [UserEntity, PostEntity],
  synchronize: true,
});

await dataSource.initialize();

export const adapter = typeormAdapter(dataSource, {
  entities: {
    User: UserEntity,
    Post: PostEntity
  }
});

export const users = adapter.model('User');
export const posts = adapter.model('Post');
```

### Use in your app

```ts [app.ts]
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
  authorId: user.id
});

// Query
const activeUsers = await users.findMany({
  where: { active: true },
  orderBy: { createdAt: 'desc' }
});
```

## Supported Databases

The adapter auto-detects the dialect from DataSource options. TypeORM supports multiple databases:

| Database | Type String |
|----------|-------------|
| PostgreSQL | `postgres` |
| MySQL | `mysql` |
| MariaDB | `mariadb` |
| SQLite | `sqlite`, `better-sqlite3` |
| SQL Server | `mssql` |

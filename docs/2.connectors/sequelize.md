---
icon: simple-icons:sequelize
---

# Sequelize

> Multi-dialect ORM connector supporting MySQL, PostgreSQL, SQLite, and MSSQL

:read-more{to="https://sequelize.org"}

Sequelize is a popular Node.js ORM that supports multiple SQL dialects. This connector allows you to use an existing Sequelize setup with DB0's unified API.

## Usage

Install the [`sequelize`](https://www.npmjs.com/package/sequelize) dependency along with your database driver:

::code-group
```bash [SQLite]
npm install sequelize sqlite3
```
```bash [PostgreSQL]
npm install sequelize pg pg-hstore
```
```bash [MySQL]
npm install sequelize mysql2
```
```bash [MSSQL]
npm install sequelize tedious
```
::

```ts
import { createDatabase } from "db0";
import sequelize from "db0/connectors/sequelize";

const db = createDatabase(
  sequelize({
    dialect: "sqlite",
    storage: ":memory:",
  }),
);
```

## Using an Existing Instance

You can pass an existing Sequelize instance to reuse your current configuration:

```ts
import { Sequelize } from "sequelize";
import { createDatabase } from "db0";
import sequelize from "db0/connectors/sequelize";

const instance = new Sequelize({
  dialect: "postgres",
  host: "localhost",
  database: "mydb",
  username: "user",
  password: "pass",
});

const db = createDatabase(sequelize({ instance }));
```

## Options

| Option | Type | Description |
|--------|------|-------------|
| `instance` | `Sequelize` | Existing Sequelize instance to use |
| `dialect` | `string` | Database dialect: `sqlite`, `postgres`, `mysql`, `mariadb`, `mssql` |
| `storage` | `string` | SQLite database file path (`:memory:` for in-memory) |
| `host` | `string` | Database server hostname |
| `port` | `number` | Database server port |
| `database` | `string` | Database name |
| `username` | `string` | Database username |
| `password` | `string` | Database password |

All [Sequelize options](https://sequelize.org/api/v6/class/src/sequelize.js~sequelize#instance-constructor-constructor) are supported.

## Dialect Examples

### PostgreSQL

```ts
import { createDatabase } from "db0";
import sequelize from "db0/connectors/sequelize";

const db = createDatabase(
  sequelize({
    dialect: "postgres",
    host: "localhost",
    port: 5432,
    database: "mydb",
    username: "user",
    password: "pass",
  }),
);
```

### MySQL / MariaDB

```ts
import { createDatabase } from "db0";
import sequelize from "db0/connectors/sequelize";

const db = createDatabase(
  sequelize({
    dialect: "mysql", // or "mariadb"
    host: "localhost",
    port: 3306,
    database: "mydb",
    username: "root",
    password: "pass",
  }),
);
```

### MSSQL

```ts
import { createDatabase } from "db0";
import sequelize from "db0/connectors/sequelize";

const db = createDatabase(
  sequelize({
    dialect: "mssql",
    host: "localhost",
    database: "mydb",
    username: "sa",
    password: "YourPassword123",
    dialectOptions: {
      options: {
        encrypt: true,
        trustServerCertificate: true,
      },
    },
  }),
);
```

## Example

```ts
import { createDatabase } from "db0";
import sequelize from "db0/connectors/sequelize";

const db = createDatabase(
  sequelize({
    dialect: "sqlite",
    storage: "./data/app.db",
    logging: false,
  }),
);

// Create table
await db.sql`CREATE TABLE IF NOT EXISTS users ("id" INTEGER PRIMARY KEY, "name" TEXT, "email" TEXT)`;

// Insert data
await db.sql`INSERT INTO users (name, email) VALUES (${"Alice"}, ${"alice@example.com"})`;

// Query data
const { rows } = await db.sql`SELECT * FROM users`;
```

## Limitations

::warning
Sequelize's raw query execution does not support the `RETURNING` clause for SQLite. Use a separate `SELECT` query after `INSERT` statements if you need to retrieve the inserted data.
::

## References

- [Sequelize Documentation](https://sequelize.org/docs/v6/)
- [Sequelize API Reference](https://sequelize.org/api/v6/)

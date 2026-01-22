---
icon: simple-icons:mysql
---

# MySQL

> Universal MySQL support with multiple drivers

:read-more{to="https://mysql.com"}

## mysql2 (default)

The default MySQL connector uses [`mysql2`](https://www.npmjs.com/package/mysql2).

:pm-install{name="mysql2"}

```ts
import { createDatabase } from "db0";
import mysql from "db0/connectors/mysql/mysql2";

const db = createDatabase(
  mysql({
    host: "localhost",
    user: "root",
    password: "password",
    database: "mydb",
  }),
);
```

### Options

| Option | Type | Description |
|--------|------|-------------|
| `host` | `string` | Database server hostname. Default: `localhost` |
| `port` | `number` | Database server port. Default: `3306` |
| `user` | `string` | Database username |
| `password` | `string` | Database password |
| `database` | `string` | Database name to connect to |
| `uri` | `string` | Connection URI string (alternative to individual options) |

All [mysql2 connection options](https://github.com/sidorares/node-mysql2#connection-options) are supported.

## Pool Mode

Connection pooling for high-concurrency scenarios.

:pm-install{name="mysql2"}

```ts
import { createDatabase } from "db0";
import pool from "db0/connectors/mysql/pool";

const db = createDatabase(
  pool({
    host: "localhost",
    user: "root",
    password: "password",
    database: "mydb",
    connectionLimit: 10,
  }),
);
```

## MariaDB

Native MariaDB support using the [`mariadb`](https://www.npmjs.com/package/mariadb) package.

:pm-install{name="mariadb"}

```ts
import { createDatabase } from "db0";
import mariadb from "db0/connectors/mysql/mariadb";

const db = createDatabase(
  mariadb({
    host: "localhost",
    user: "root",
    password: "password",
    database: "mydb",
  }),
);
```

For connection pooling:

```ts
const db = createDatabase(
  mariadb({
    host: "localhost",
    user: "root",
    password: "password",
    database: "mydb",
    pool: true,
  }),
);
```

## PlanetScale

Serverless MySQL using [PlanetScale](https://planetscale.com)'s HTTP driver.

:pm-install{name="@planetscale/database"}

```ts
import { createDatabase } from "db0";
import planetscale from "db0/connectors/mysql/planetscale";

const db = createDatabase(
  planetscale({
    url: process.env.DATABASE_URL!,
  }),
);
```

::callout{icon="i-heroicons-exclamation-triangle" color="amber"}
PlanetScale HTTP does not support transactions.
::

## Aliases

For convenience, these aliases are available:

| Alias | Connector |
|-------|-----------|
| `mysql2` | `mysql/mysql2` |
| `planetscale` | `mysql/planetscale` |
| `mariadb` | `mysql/mariadb` |

## Example

```ts
import { createDatabase } from "db0";
import mysql from "db0/connectors/mysql/mysql2";

const db = createDatabase(
  mysql({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  }),
);

// Create table
await db.sql`CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255))`;

// Insert data
await db.sql`INSERT INTO users (name) VALUES (${"Alice"})`;

// Query data
const rows = await db.prepare("SELECT * FROM users").all();
```

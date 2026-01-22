---
icon: simple-icons:microsoftsqlserver
---

# Microsoft SQL Server

> Connect DB0 to Microsoft SQL Server

:read-more{to="https://www.microsoft.com/sql-server"}

## Usage

Install the [`mssql`](https://www.npmjs.com/package/mssql) dependency:

:pm-install{name="mssql"}

```ts
import { createDatabase } from "db0";
import mssql from "db0/connectors/mssql";

const db = createDatabase(
  mssql({
    server: "localhost",
    user: "sa",
    password: "YourPassword123",
    database: "mydb",
    options: {
      encrypt: true,
      trustServerCertificate: true,
    },
  }),
);
```

## Options

| Option | Type | Description |
|--------|------|-------------|
| `server` | `string` | Database server hostname |
| `port` | `number` | Database server port. Default: `1433` |
| `user` | `string` | Database username |
| `password` | `string` | Database password |
| `database` | `string` | Database name |
| `options.encrypt` | `boolean` | Enable encryption. Default: `true` |
| `options.trustServerCertificate` | `boolean` | Trust server certificate. Default: `false` |

All [mssql configuration options](https://github.com/tediousjs/node-mssql#configuration-1) are supported.

## Example

```ts
import { createDatabase } from "db0";
import mssql from "db0/connectors/mssql";

const db = createDatabase(
  mssql({
    server: process.env.MSSQL_SERVER,
    user: process.env.MSSQL_USER,
    password: process.env.MSSQL_PASSWORD,
    database: process.env.MSSQL_DATABASE,
  }),
);

// Create table
await db.sql`CREATE TABLE users (id INT IDENTITY PRIMARY KEY, name NVARCHAR(255))`;

// Insert data
await db.sql`INSERT INTO users (name) VALUES (${"Alice"})`;

// Query data
const rows = await db.prepare("SELECT * FROM users").all();
```

## References

- [mssql Documentation](https://github.com/tediousjs/node-mssql#readme)
- [SQL Server Documentation](https://docs.microsoft.com/sql/)

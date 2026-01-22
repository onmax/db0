---
icon: simple-icons:turso
---

# Turso

> Connect DB0 to Turso database

:read-more{to="https://turso.tech"}

Turso is a SQLite-compatible database built on libSQL. Use the [LibSQL connector](/connectors/libsql) to connect to Turso.

## Usage

Install the [`@libsql/client`](https://www.npmjs.com/package/@libsql/client) dependency:

:pm-install{name="@libsql/client"}

Use `libsql/http` connector with your Turso database URL and auth token:

```ts
import { createDatabase } from "db0";
import libSql from "db0/connectors/libsql/http";

const db = createDatabase(
  libSql({
    url: "libsql://[database]-[org].turso.io",
    authToken: process.env.TURSO_AUTH_TOKEN,
  }),
);
```

## Environment Variables

For production, set these environment variables:

| Variable | Description |
|----------|-------------|
| `TURSO_DATABASE_URL` | Your Turso database URL (e.g., `libsql://my-db-myorg.turso.io`) |
| `TURSO_AUTH_TOKEN` | Authentication token from Turso dashboard |

## Example

```ts
import { createDatabase } from "db0";
import libSql from "db0/connectors/libsql/http";

const db = createDatabase(
  libSql({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  }),
);

// Create table
await db.sql`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)`;

// Insert data
await db.sql`INSERT INTO users (name) VALUES (${"Alice"})`;

// Query data
const { rows } = await db.sql`SELECT * FROM users`;
```

## Options

See [LibSQL connector options](/connectors/libsql#options) for full configuration.

## References

- [Turso Documentation](https://docs.turso.tech)
- [Turso CLI](https://docs.turso.tech/cli/introduction)
- [LibSQL Connector](/connectors/libsql)

---
icon: radix-icons:vercel-logo
---

# Vercel Postgres

> Connect DB0 to Vercel Postgres

:read-more{to="https://vercel.com/docs/storage/vercel-postgres"}

Vercel Postgres is built on Neon serverless PostgreSQL. Use the [PostgreSQL connector](/connectors/postgresql) with the connection URL provided by Vercel.

## Usage

Install the [`postgres`](https://www.npmjs.com/package/postgres) dependency:

:pm-install{name="postgres"}

Use the `postgresql` connector with your Vercel Postgres URL:

```ts
import { createDatabase } from "db0";
import postgresql from "db0/connectors/postgresql";

const db = createDatabase(
  postgresql({
    url: process.env.POSTGRES_URL,
  }),
);
```

## Environment Variables

Vercel automatically sets these environment variables when you link a Postgres database:

| Variable | Description |
|----------|-------------|
| `POSTGRES_URL` | Full connection string (recommended) |
| `POSTGRES_URL_NON_POOLING` | Direct connection (for migrations) |
| `POSTGRES_HOST` | Database host |
| `POSTGRES_USER` | Database user |
| `POSTGRES_PASSWORD` | Database password |
| `POSTGRES_DATABASE` | Database name |

## Edge Runtime

For Vercel Edge Functions, use the connection with SSL enabled:

```ts
import { createDatabase } from "db0";
import postgresql from "db0/connectors/postgresql";

const db = createDatabase(
  postgresql({
    url: process.env.POSTGRES_URL,
    ssl: "require",
  }),
);
```

## Example

```ts
import { createDatabase } from "db0";
import postgresql from "db0/connectors/postgresql";

const db = createDatabase(
  postgresql({
    url: process.env.POSTGRES_URL,
  }),
);

// Create table
await db.sql`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT)`;

// Insert data
await db.sql`INSERT INTO users (name) VALUES (${"Alice"})`;

// Query data
const { rows } = await db.sql`SELECT * FROM users`;
```

## Options

See [PostgreSQL connector options](/connectors/postgresql#options) for full configuration.

## References

- [Vercel Postgres Documentation](https://vercel.com/docs/storage/vercel-postgres)
- [Vercel Postgres Quickstart](https://vercel.com/docs/storage/vercel-postgres/quickstart)
- [PostgreSQL Connector](/connectors/postgresql)

# db0 Examples

Runnable examples for connectors and integrations.

## Connectors

| Connector | Database | Requirements | Run |
|-----------|----------|--------------|-----|
| [better-sqlite3](./connectors/better-sqlite3/) | SQLite | None | `pnpm start` |
| [pglite](./connectors/pglite/) | PostgreSQL (embedded) | None | `pnpm start` |
| [libsql](./connectors/libsql/) | LibSQL | None | `pnpm start` |
| [mysql2](./connectors/mysql2/) | MySQL | Docker | `docker compose up -d && pnpm start` |
| [postgresql](./connectors/postgresql/) | PostgreSQL | Docker | `docker compose up -d && pnpm start` |
| [mssql](./connectors/mssql/) | SQL Server | Docker | `docker compose up -d && pnpm start` |

## Integrations

| Integration | Pattern | Run |
|-------------|---------|-----|
| [drizzle](./integrations/drizzle/) | db0 → drizzle() | `pnpm start` |
| [prisma](./integrations/prisma/) | PrismaClient → prismaAdapter() | `pnpm prisma:generate && pnpm start` |
| [kysely](./integrations/kysely/) | Kysely → kyselyAdapter() | `pnpm start` |
| [typeorm](./integrations/typeorm/) | DataSource → typeormAdapter() | `pnpm start` |
| [better-auth](./integrations/better-auth/) | db0 → betterAuthAdapter() | `pnpm start` |

## Quick Start

```bash
cd examples/<category>/<name>
pnpm install
pnpm start
```

## Common Schema

All examples use the same `users` table:

```sql
CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)
```

Operations demonstrated:
1. Create table
2. Insert record
3. Select all
4. Select with WHERE
5. Update
6. Delete
7. Transaction
8. Cleanup/dispose

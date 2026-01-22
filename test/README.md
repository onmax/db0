# db0 Test Suite

## Quick Start with Docker

The fastest way to run all connector tests is using Docker:

```bash
# Start all database containers
pnpm docker:up

# Run quick tests (SQLite + PostgreSQL + MySQL + HTTP)
pnpm test:docker:quick

# Run all Docker-based tests
pnpm test:docker

# Stop containers when done
pnpm docker:down
```

## Docker Services

The `docker-compose.test.yml` provides:

| Service       | Port  | Credentials       |
| ------------- | ----- | ----------------- |
| PostgreSQL 17 | 15432 | postgres:postgres |
| MySQL 8       | 13306 | root:root         |
| MariaDB 11    | 13307 | root:root         |
| MSSQL 2022    | 11433 | sa:Test@12345     |
| Neon Proxy    | 4444  | (uses postgres)   |

## Environment Setup

```bash
# Copy example env file
cp test/.env.example test/.env

# Or set variables directly
export POSTGRESQL_URL="postgres://postgres:postgres@localhost:15432/test"
export MYSQL_URL="mysql://root:root@localhost:13306/test"
```

## Test Matrix

### Connectors × Dialects

| Connector            | Dialect    | In-Memory | Docker | Cloud |
| -------------------- | ---------- | --------- | ------ | ----- |
| better-sqlite3       | sqlite     | ✅        | -      | -     |
| node-sqlite          | sqlite     | ✅        | -      | -     |
| sqlite3              | sqlite     | ✅        | -      | -     |
| libsql               | libsql     | ✅        | -      | -     |
| pglite               | postgresql | ✅        | -      | -     |
| postgresql/postgres  | postgresql | ❌        | ✅     | -     |
| postgresql/pg        | postgresql | ❌        | ✅     | -     |
| postgresql/pool      | postgresql | ❌        | ✅     | -     |
| postgresql/neon-http | postgresql | ❌        | ✅     | ✅    |
| postgresql/neon-ws   | postgresql | ❌        | ✅     | ✅    |
| mysql/mysql2         | mysql      | ❌        | ✅     | -     |
| mysql/pool           | mysql      | ❌        | ✅     | -     |
| mysql/mariadb        | mysql      | ❌        | ✅     | -     |
| mysql/planetscale    | mysql      | ❌        | -      | ✅    |
| mssql                | mssql      | ❌        | ✅     | -     |
| http                 | sqlite     | ✅        | -      | -     |
| cloudflare-d1        | sqlite     | ✅        | -      | -     |
| cloudflare-d1-http   | sqlite     | ❌        | -      | ✅    |

### Integrations

| Adapter     | SQLite | PostgreSQL | MySQL |
| ----------- | ------ | ---------- | ----- |
| Drizzle     | ✅     | ✅         | ✅    |
| Prisma      | ✅     | ✅         | ✅    |
| Kysely      | ✅     | ✅         | ✅    |
| better-auth | ✅     | ✅         | ✅    |

## Test Scripts

```bash
# All tests (lint + typecheck + coverage + bun)
pnpm test

# Docker-based tests
pnpm test:docker          # All Docker tests
pnpm test:docker:quick    # Quick subset
pnpm test:docker:pg       # PostgreSQL only
pnpm test:docker:mysql    # MySQL only

# Development
pnpm dev                  # Watch mode

# Run specific tests
npx vitest run test/connectors/postgresql.test.ts
npx vitest run test/integrations/drizzle.test.ts
```

## Test Files

### Core Tests

| File                   | Description                |
| ---------------------- | -------------------------- |
| `errors.test.ts`       | Error classes and wrappers |
| `transformers.test.ts` | Type transformation        |
| `transactions.test.ts` | Transaction handling       |
| `template.test.ts`     | SQL template literals      |
| `eager.test.ts`        | Eager initialization       |

### Connector Tests

| File                      | Connector                  |
| ------------------------- | -------------------------- |
| `better-sqlite3.test.ts`  | SQLite (better-sqlite3)    |
| `node-sqlite.test.ts`     | SQLite (node:sqlite)       |
| `sqlite3.test.ts`         | SQLite (sqlite3)           |
| `libsql.test.ts`          | LibSQL/Turso               |
| `pglite.test.ts`          | PGlite (WASM)              |
| `postgresql.test.ts`      | PostgreSQL (postgres.js)   |
| `pg.test.ts`              | PostgreSQL (node-postgres) |
| `postgresql-pool.test.ts` | PostgreSQL pool            |
| `neon-http.test.ts`       | Neon HTTP                  |
| `neon-ws.test.ts`         | Neon WebSocket             |
| `mysql2.test.ts`          | MySQL (mysql2)             |
| `mysql-pool.test.ts`      | MySQL pool                 |
| `mariadb.test.ts`         | MariaDB                    |
| `planetscale.test.ts`     | PlanetScale                |
| `mssql.test.ts`           | SQL Server                 |
| `http.test.ts`            | HTTP client/server         |
| `cloudflare/*.test.ts`    | D1 and Hyperdrive          |

### Integration Tests

| File                  | Description               |
| --------------------- | ------------------------- |
| `drizzle.test.ts`     | Drizzle ORM + Model API   |
| `prisma.test.ts`      | Prisma adapter            |
| `kysely.test.ts`      | Kysely adapter            |
| `better-auth.test.ts` | better-auth compatibility |

## Environment Variables

### Docker (Local)

```bash
POSTGRESQL_URL="postgres://postgres:postgres@localhost:15432/test"
MYSQL_URL="mysql://root:root@localhost:13306/test"
MARIADB_URL="mysql://root:root@localhost:13307/test"
MSSQL_HOST="localhost"
MSSQL_PORT="11433"
MSSQL_USER="sa"
MSSQL_PASSWORD="Test@12345"
NEON_HTTP_URL="postgres://postgres:postgres@localhost:4444/test"
```

### Cloud Services (Optional)

```bash
NEON_DATABASE_URL="postgres://user:pass@ep-xxx.neon.tech/db"
PLANETSCALE_URL="mysql://user:pass@psdb.cloud/db"
CF_ACCOUNT_ID="..."
D1_DATABASE_ID="..."
CF_API_TOKEN="..."
```

## Test Coverage

All connectors test:

- Instance and dialect matching
- Table creation/dropping
- CRUD operations
- Prepared statements
- Transactions (where supported)
- Edge cases (NULL, unicode, special chars)
- Dispose functionality

Integration tests additionally cover:

- Model API (findOne, findMany, create, update, delete, count)
- Where operators (eq, ne, gt, lt, like, in)
- Pagination (limit, offset, orderBy)
- Transactions
- Type inference

# PostgreSQL Connector Example

PostgreSQL database using pg driver.

## Requirements

- Node.js 18+
- Docker (for PostgreSQL server)

## Run

```bash
docker compose up -d
pnpm install
pnpm start
docker compose down
```

## What it shows

- PostgreSQL database connection
- CRUD operations with SQL template literals
- Transaction support

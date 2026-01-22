# MSSQL Connector Example

SQL Server database using mssql driver.

## Requirements

- Node.js 18+
- Docker (for SQL Server)

## Run

```bash
docker compose up -d
# Wait ~30 seconds for SQL Server to start
pnpm install
pnpm start
docker compose down
```

## What it shows

- SQL Server database connection
- CRUD operations with SQL template literals
- Transaction support

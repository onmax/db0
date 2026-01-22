# Prisma Integration Example

Using Prisma ORM with db0's prismaAdapter.

## Requirements

- Node.js 18+

## Run

```bash
pnpm install
pnpm prisma:generate
pnpm start
```

## What it shows

- Creating PrismaClient with SQLite
- Wrapping with `prismaAdapter()`
- Unified model API for CRUD operations
- Transaction support
- Auto-detected dialect and capabilities

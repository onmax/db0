# better-auth Integration Example

Using db0 with better-auth's database adapter interface.

## Requirements

- Node.js 18+

## Run

```bash
pnpm install
pnpm start
```

## What it shows

- Creating db0 database with better-sqlite3
- Wrapping with `betterAuthAdapter()`
- better-auth compatible CRUD operations
- Transaction support
- Automatic ID generation
- Capability detection (JSON, booleans, dates, etc.)

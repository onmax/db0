# PRD: db0 Multi-Dialect Migration

## Overview

Migrate db0 to fully support multiple SQL dialects (sqlite, postgresql, mysql) with consistent APIs, enabling future NuxtHub integration where db0 replaces NuxtHub's internal database code.

**Follow `/ts-library` skill for implementation patterns.**

---

## Goals

1. Extend Drizzle integration to all dialects (not SQLite-only)
2. Add eager initialization option to make `getInstance()` sync where possible
3. Keep thin abstraction - raw driver access for ORM composition
4. Real database testing with Docker (postgres, mysql, sqlite)
5. Maintain UnJS philosophy: composable, minimal, universal

---

## Non-Goals

- Full ORM adapter layer (separate library later)
- Prisma support
- Migration tooling
- NuxtHub-specific features (handled in NuxtHub itself)

---

## User Stories

### US-1: Multi-dialect Drizzle integration
**As a** developer using db0 with Drizzle  
**I want** to use any supported dialect (sqlite, postgresql, mysql)  
**So that** I can use db0's connection management with Drizzle ORM

**Acceptance:**
- `db0/integrations/drizzle` works with all dialects
- Type inference works correctly per dialect
- Example: `drizzle(db, { schema })` returns correctly typed Drizzle instance

### US-2: Eager initialization
**As a** developer  
**I want** optional eager initialization  
**So that** `getInstance()` can be sync when the connector supports it

**Acceptance:**
- New option: `{ eager: true }` in connector config
- When eager + sync connector (better-sqlite3): `getInstance()` is sync
- When eager + async connector: connection established at creation, `getInstance()` still sync after init
- Backward compatible: default behavior unchanged

### US-3: Consistent connector API
**As a** developer  
**I want** all connectors to have consistent behavior  
**So that** switching dialects requires minimal code changes

**Acceptance:**
- All connectors expose `dialect` property
- `getInstance()` typing is consistent (Promise-wrapped unless eager+sync)
- Common error handling patterns

### US-4: Real database testing
**As a** contributor  
**I want** integration tests with real databases  
**So that** we catch dialect-specific issues

**Acceptance:**
- Docker Compose for postgres + mysql
- CI runs tests against real databases
- Tests cover: basic CRUD, transactions, prepared statements, edge cases per dialect

### US-5: Raw driver access for ORM composition
**As a** developer using other ORMs (Kysely, Prisma, etc.)  
**I want** clean access to the raw driver instance  
**So that** I can compose db0 with any ORM

**Acceptance:**
- `getInstance()` returns properly typed native driver
- Documentation shows ORM composition patterns
- No db0 lock-in for ORM layer

---

## Technical Changes

### 1. Drizzle Integration Extension

```
src/integrations/drizzle/
├── index.ts          # Entry point, dialect detection
├── sqlite.ts         # Existing, refactor
├── postgresql.ts     # New
└── mysql.ts          # New
```

Pattern: detect `connector.dialect`, instantiate correct Drizzle dialect with raw instance.

### 2. Eager Initialization

```typescript
// Connector option
interface ConnectorOptions {
  eager?: boolean;  // Initialize connection immediately
}

// Type overloads for sync getInstance when eager + sync driver
type Connector<TInstance, TEager extends boolean = false> = {
  getInstance: TEager extends true 
    ? () => TInstance 
    : () => TInstance | Promise<TInstance>;
  // ...
}
```

### 3. Connector Updates

| Connector | Dialect | Sync capable | Changes needed |
|-----------|---------|--------------|----------------|
| better-sqlite3 | sqlite | ✅ | Add eager option |
| libsql | libsql | ❌ | Normalize async |
| postgresql | postgresql | ❌ | Normalize async |
| pglite | postgresql | ❌ | Normalize async |
| mysql2 | mysql | ❌ | Normalize async |
| cloudflare-d1 | sqlite | ✅ | Add eager option |
| bun-sqlite | sqlite | ✅ | Add eager option |

### 4. Testing Infrastructure

```yaml
# docker-compose.test.yml
services:
  postgres:
    image: postgres:16
    ports: ["5432:5432"]
  mysql:
    image: mysql:8
    ports: ["3306:3306"]
```

Test matrix: each connector × basic operations × dialect-specific features.

---

## Migration Path for NuxtHub

1. db0 implements this PRD
2. NuxtHub's `hub:db` uses db0 connectors internally
3. Drizzle integration uses `db0/integrations/drizzle`
4. NuxtHub removes its own connector implementations
5. `useDatabase()` returns db0's `Database` instance

---

## Open Questions

1. **Pool support?** - db0 currently single instance, NuxtHub may need pooling for postgresql
2. **Transaction API?** - Should db0 expose transaction helpers or leave to raw driver?
3. **libsql dialect** - Keep as separate dialect or treat as sqlite variant?

---

## Success Metrics

- All existing tests pass
- New tests for postgresql + mysql with Docker
- Drizzle works with all 3 dialects
- NuxtHub PR #789 can be rebased to use db0
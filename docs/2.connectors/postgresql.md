---
icon: simple-icons:postgresql
---

# PostgreSQL

> Universal PostgreSQL support with multiple drivers

:read-more{to="https://www.postgresql.org"}

## postgres.js (default)

The default PostgreSQL connector uses [`postgres`](https://www.npmjs.com/package/postgres) (postgres.js).

:pm-install{name="postgres"}

```ts
import { createDatabase } from "db0";
import postgresql from "db0/connectors/postgresql/postgres";

const db = createDatabase(
  postgresql({
    url: "postgres://user:pass@localhost:5432/dbname",
  }),
);
```

### Options

| Option | Type | Description |
|--------|------|-------------|
| `url` | `string` | Connection URL string |
| `max` | `number` | Max connections (for transaction support, use `1`) |

You can also pass any [postgres.js options](https://github.com/porsager/postgres#connection-options).

## node-postgres (pg)

Use the [`pg`](https://www.npmjs.com/package/pg) package with connection pooling.

:pm-install{name="pg @types/pg"}

```ts
import { createDatabase } from "db0";
import pg from "db0/connectors/postgresql/pg";

const db = createDatabase(
  pg({
    connectionString: "postgres://user:pass@localhost:5432/dbname",
    max: 10,
  }),
);
```

### Options

All [node-postgres Pool options](https://node-postgres.com/apis/pool) are supported.

## Pool Mode

Explicit pool configuration for high-concurrency scenarios.

:pm-install{name="postgres"}

```ts
import { createDatabase } from "db0";
import pool from "db0/connectors/postgresql/pool";

const db = createDatabase(
  pool({
    url: "postgres://user:pass@localhost:5432/dbname",
    max: 10,
    idle_timeout: 20,
  }),
);
```

## Neon HTTP

Serverless PostgreSQL using [Neon](https://neon.tech)'s HTTP driver.

:pm-install{name="@neondatabase/serverless"}

```ts
import { createDatabase } from "db0";
import neonHttp from "db0/connectors/postgresql/neon-http";

const db = createDatabase(
  neonHttp({
    url: process.env.DATABASE_URL!,
  }),
);
```

::callout{icon="i-heroicons-exclamation-triangle" color="amber"}
Neon HTTP does not support transactions. Use `neon-ws` for transaction support.
::

## Neon WebSocket

Neon with WebSocket for transaction support.

:pm-install{name="@neondatabase/serverless"}

```ts
import { createDatabase } from "db0";
import neonWs from "db0/connectors/postgresql/neon-ws";

const db = createDatabase(
  neonWs({
    url: process.env.DATABASE_URL!,
  }),
);
```

For Node.js, provide a WebSocket constructor:

```ts
import ws from "ws";

const db = createDatabase(
  neonWs({
    url: process.env.DATABASE_URL!,
    webSocketConstructor: ws,
  }),
);
```

## PGlite (WASM)

In-process PostgreSQL using [PGlite](https://github.com/electric-sql/pglite).

:pm-install{name="@electric-sql/pglite"}

```ts
import { createDatabase } from "db0";
import pglite from "db0/connectors/postgresql/pglite";

// In-memory database
const db = createDatabase(pglite());

// Persistent database
const db = createDatabase(
  pglite({
    dataDir: "./data/pglite",
  }),
);
```

## Aliases

For convenience, these aliases are available:

| Alias | Connector |
|-------|-----------|
| `postgresql` | `postgresql/postgres` |
| `pg` | `postgresql/pg` |
| `neon-http` | `postgresql/neon-http` |
| `neon` | `postgresql/neon-ws` |
| `pglite` | `postgresql/pglite` |

---
icon: devicon-plain:nodejs
---

# Node SQLite

> Connect DB0 using Node.js built-in SQLite (node:sqlite)

Requires Node.js >= 22.5 or Deno >= 2.2.

## Usage

No dependencies needed - uses built-in `node:sqlite` module:

```ts
import { createDatabase } from "db0";
import sqlite from "db0/connectors/node-sqlite";

const db = createDatabase(sqlite({
  name: "mydb"  // Creates .data/mydb.sqlite
}));

// Or in-memory
const memDb = createDatabase(sqlite({
  name: ":memory:"
}));
```

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `name` | `"db"` | Database filename (without extension) |
| `path` | `.data/{name}.sqlite` | Full path to database file |
| `cwd` | `.` | Working directory for relative paths |

## Aliases

`sqlite` is an alias for `node-sqlite`:

```ts
import sqlite from "db0/connectors/sqlite";
// Same as: import sqlite from "db0/connectors/node-sqlite";
```

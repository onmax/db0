---
icon: simple-icons:capacitor
---

# Capacitor SQLite

> SQLite for Capacitor mobile/hybrid apps

:read-more{to="https://github.com/capacitor-community/sqlite"}

## Usage

Install the [`@capacitor-community/sqlite`](https://www.npmjs.com/package/@capacitor-community/sqlite) dependency:

:pm-install{name="@capacitor-community/sqlite"}

```ts
import { createDatabase } from "db0";
import capacitorSqlite from "db0/connectors/capacitor-sqlite";
import { CapacitorSQLite, SQLiteConnection } from "@capacitor-community/sqlite";

// Initialize the SQLite connection
const sqlite = new SQLiteConnection(CapacitorSQLite);
const db0Connection = await sqlite.createConnection(
  "mydb",
  false,
  "no-encryption",
  1,
  false,
);
await db0Connection.open();

// Create db0 database
const db = createDatabase(
  capacitorSqlite({
    connection: db0Connection,
  }),
);
```

## Options

| Option | Type | Description |
|--------|------|-------------|
| `connection` | `SQLiteDBConnection` | Pre-initialized SQLite database connection |

## Platform Setup

### iOS

Add to your `Podfile`:

```ruby
pod 'CapacitorCommunitySqlite'
```

### Android

The plugin auto-installs.

### Web

For web support, install `sql.js`:

:pm-install{name="sql.js"}

```ts
import { defineCustomElements as jeepSqlite } from "jeep-sqlite/loader";
jeepSqlite(window);
```

## Example

```ts
import { createDatabase } from "db0";
import capacitorSqlite from "db0/connectors/capacitor-sqlite";
import { CapacitorSQLite, SQLiteConnection } from "@capacitor-community/sqlite";

const sqlite = new SQLiteConnection(CapacitorSQLite);

// Create and open connection
const connection = await sqlite.createConnection(
  "app-db",
  false,
  "no-encryption",
  1,
  false,
);
await connection.open();

const db = createDatabase(capacitorSqlite({ connection }));

// Create table
await db.sql`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)`;

// Insert data
await db.sql`INSERT INTO users (name) VALUES (${"Alice"})`;

// Query data
const rows = await db.prepare("SELECT * FROM users").all();

// Cleanup
await db.dispose();
```

## References

- [Capacitor SQLite Documentation](https://github.com/capacitor-community/sqlite)
- [Capacitor Documentation](https://capacitorjs.com/docs)

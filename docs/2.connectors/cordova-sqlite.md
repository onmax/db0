---
icon: simple-icons:apache
---

# Cordova SQLite

> SQLite for Cordova/PhoneGap apps

:read-more{to="https://github.com/storesafe/cordova-sqlite-storage"}

## Usage

Install the [`cordova-sqlite-storage`](https://www.npmjs.com/package/cordova-sqlite-storage) plugin:

```bash
cordova plugin add cordova-sqlite-storage
```

```ts
import { createDatabase } from "db0";
import cordovaSqlite from "db0/connectors/cordova-sqlite";

const db = createDatabase(
  cordovaSqlite({
    name: "mydb.db",
    location: "default",
  }),
);
```

## Options

| Option | Type | Description |
|--------|------|-------------|
| `name` | `string` | Database filename |
| `location` | `string` | Storage location: `default`, `Library`, `Documents` |
| `iosDatabaseLocation` | `string` | iOS-specific location |
| `androidDatabaseProvider` | `string` | Android database provider |

## Locations

- `default` - Use platform default (recommended)
- `Library` - iOS Library directory (backed up)
- `Documents` - iOS Documents directory (visible in iTunes)

## Example

```ts
import { createDatabase } from "db0";
import cordovaSqlite from "db0/connectors/cordova-sqlite";

document.addEventListener("deviceready", async () => {
  const db = createDatabase(
    cordovaSqlite({
      name: "app.db",
      location: "default",
    }),
  );

  // Create table
  await db.sql`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)`;

  // Insert data
  await db.sql`INSERT INTO users (name) VALUES (${"Alice"})`;

  // Query data
  const rows = await db.prepare("SELECT * FROM users").all();
  console.log(rows);
});
```

## References

- [cordova-sqlite-storage Documentation](https://github.com/storesafe/cordova-sqlite-storage)
- [Apache Cordova Documentation](https://cordova.apache.org/docs/)

import { createDatabase } from "db0";
import sqlite from "db0/connectors/better-sqlite3";
import { drizzle } from "db0/integrations/drizzle";
import { eq } from "drizzle-orm";
import { users } from "./schema";

async function main() {
  // Create db0 database
  const db0 = createDatabase(sqlite({ name: ":memory:" }));

  // Wrap with Drizzle ORM
  const db = drizzle(db0, { schema: { users } });

  // Create table using raw SQL
  await db0.sql`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT)`;
  console.log("✓ Created users table");

  // Insert using Drizzle
  await db.insert(users).values({ name: "Alice", email: "alice@example.com" });
  await db.insert(users).values({ name: "Bob", email: "bob@example.com" });
  console.log("✓ Inserted 2 users");

  // Select all using Drizzle
  const allUsers = await db.select().from(users);
  console.log("✓ All users:", allUsers);

  // Select with WHERE using Drizzle
  const alice = await db.select().from(users).where(eq(users.name, "Alice"));
  console.log("✓ Found Alice:", alice);

  // Update using Drizzle
  await db.update(users).set({ email: "alice@test.com" }).where(eq(users.name, "Alice"));
  const updated = await db.select().from(users).where(eq(users.name, "Alice"));
  console.log("✓ Updated Alice:", updated);

  // Delete using Drizzle
  await db.delete(users).where(eq(users.name, "Bob"));
  const remaining = await db.select().from(users);
  console.log("✓ After delete:", remaining);

  // Cleanup
  await db0.sql`DROP TABLE users`;
  db0.dispose();
  console.log("✓ Cleaned up");
}

main().catch(console.error);

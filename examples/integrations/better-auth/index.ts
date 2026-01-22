import { createDatabase } from "db0";
import sqlite from "db0/connectors/better-sqlite3";
import { betterAuthAdapter } from "db0/integrations/better-auth";

async function main() {
  // Create db0 database
  const db = createDatabase(sqlite({ name: ":memory:" }));

  // Create table (better-auth uses 'user' model name)
  await db.sql`CREATE TABLE user (id TEXT PRIMARY KEY, name TEXT, email TEXT)`;
  console.log("✓ Created user table");

  // Create better-auth adapter
  const adapter = betterAuthAdapter(db);
  console.log("✓ Created better-auth adapter");
  console.log("  Capabilities:", adapter.capabilities);

  // Create users using better-auth's interface
  const alice = await adapter.create({
    model: "user",
    data: { name: "Alice", email: "alice@example.com" },
  });
  const bob = await adapter.create({
    model: "user",
    data: { name: "Bob", email: "bob@example.com" },
  });
  console.log("✓ Created users:", [alice, bob]);

  // Find all users
  const allUsers = await adapter.findMany({ model: "user" });
  console.log("✓ All users:", allUsers);

  // Find one user
  const found = await adapter.findOne({
    model: "user",
    where: [{ field: "name", value: "Alice" }],
  });
  console.log("✓ Found Alice:", found);

  // Update user
  const updated = await adapter.update({
    model: "user",
    where: [{ field: "name", value: "Alice" }],
    update: { email: "alice@test.com" },
  });
  console.log("✓ Updated Alice:", updated);

  // Delete user
  await adapter.delete({
    model: "user",
    where: [{ field: "name", value: "Bob" }],
  });
  const remaining = await adapter.findMany({ model: "user" });
  console.log("✓ After delete:", remaining);

  // Count users
  const count = await adapter.count({ model: "user" });
  console.log("✓ User count:", count);

  // Transaction
  await adapter.transaction(async (tx) => {
    await tx.create({ model: "user", data: { name: "Charlie", email: "charlie@example.com" } });
    await tx.create({ model: "user", data: { name: "Diana", email: "diana@example.com" } });
  });
  const afterTx = await adapter.findMany({ model: "user" });
  console.log("✓ After transaction:", afterTx);

  // Cleanup
  await db.sql`DROP TABLE user`;
  db.dispose();
  console.log("✓ Cleaned up");
}

main().catch(console.error);

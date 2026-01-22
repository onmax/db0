import { Kysely, SqliteDialect } from "kysely";
import Database from "better-sqlite3";
import { kyselyAdapter } from "db0/integrations/kysely";
import type { Database as DB } from "./types";

async function main() {
  // Create Kysely instance
  const kysely = new Kysely<DB>({
    dialect: new SqliteDialect({ database: new Database(":memory:") }),
  });

  // Create table
  await kysely.schema
    .createTable("users")
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("name", "text")
    .addColumn("email", "text")
    .execute();
  console.log("✓ Created users table");

  // Wrap with db0 adapter
  const adapter = kyselyAdapter(kysely, { dialect: "sqlite", tableNames: ["users"] });
  console.log("✓ Created Kysely adapter");

  // Get model for users
  const userModel = adapter.model("users");

  // Create users
  const alice = await userModel.create({ name: "Alice", email: "alice@example.com" });
  const bob = await userModel.create({ name: "Bob", email: "bob@example.com" });
  console.log("✓ Created users:", [alice, bob]);

  // Find all users
  const allUsers = await userModel.findMany();
  console.log("✓ All users:", allUsers);

  // Find one user
  const found = await userModel.findOne({ where: { name: "Alice" } });
  console.log("✓ Found Alice:", found);

  // Update user
  const updated = await userModel.update({
    where: { name: "Alice" },
    data: { email: "alice@test.com" },
  });
  console.log("✓ Updated Alice:", updated);

  // Delete user
  const deleted = await userModel.delete({ where: { name: "Bob" } });
  const remaining = await userModel.findMany();
  console.log("✓ After delete:", remaining);

  // Count users
  const count = await userModel.count();
  console.log("✓ User count:", count);

  // Transaction
  await adapter.transaction(async (tx) => {
    await tx.model("users").create({ name: "Charlie", email: "charlie@example.com" });
    await tx.model("users").create({ name: "Diana", email: "diana@example.com" });
  });
  const afterTx = await userModel.findMany();
  console.log("✓ After transaction:", afterTx);

  // Cleanup
  await kysely.schema.dropTable("users").execute();
  await adapter.dispose();
  console.log("✓ Cleaned up");
}

main().catch(console.error);

import "reflect-metadata";
import { DataSource } from "typeorm";
import { typeormAdapter } from "db0/integrations/typeorm";
import { User } from "./entities/User";

async function main() {
  // Create TypeORM DataSource
  const dataSource = new DataSource({
    type: "better-sqlite3",
    database: ":memory:",
    entities: [User],
    synchronize: true,
  });

  await dataSource.initialize();
  console.log("✓ TypeORM DataSource initialized");

  // Wrap with db0 adapter
  const adapter = typeormAdapter(dataSource, { entities: { user: User } });
  console.log("✓ Created TypeORM adapter (dialect:", adapter.dialect, ")");

  // Get model for users
  const userModel = adapter.model("user");

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
  await userModel.delete({ where: { name: "Bob" } });
  const remaining = await userModel.findMany();
  console.log("✓ After delete:", remaining);

  // Count users
  const count = await userModel.count();
  console.log("✓ User count:", count);

  // Transaction
  await adapter.transaction(async (tx) => {
    await tx.model("user").create({ name: "Charlie", email: "charlie@example.com" });
    await tx.model("user").create({ name: "Diana", email: "diana@example.com" });
  });
  const afterTx = await userModel.findMany();
  console.log("✓ After transaction:", afterTx);

  // Cleanup
  await adapter.dispose();
  console.log("✓ Cleaned up");
}

main().catch(console.error);

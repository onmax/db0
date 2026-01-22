import { PrismaClient } from "@prisma/client";
import { prismaAdapter } from "db0/integrations/prisma";

async function main() {
  // Create Prisma client
  const prisma = new PrismaClient();

  // Wrap with db0 adapter
  const adapter = prismaAdapter(prisma);
  console.log("✓ Created Prisma adapter (dialect:", adapter.dialect, ")");

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
  const found = await userModel.findOne({ where: { id: alice.id } });
  console.log("✓ Found Alice:", found);

  // Update user
  const updated = await userModel.update({
    where: { id: alice.id },
    data: { email: "alice@test.com" },
  });
  console.log("✓ Updated Alice:", updated);

  // Delete user
  await userModel.delete({ where: { id: bob.id } });
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
  await prisma.user.deleteMany();
  await adapter.dispose();
  console.log("✓ Cleaned up");
}

main().catch(console.error);

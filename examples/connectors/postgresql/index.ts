import { createDatabase } from "db0";
import pg from "db0/connectors/postgresql/pg";

async function main() {
  const db = createDatabase(
    pg({
      host: process.env.POSTGRES_HOST || "localhost",
      port: Number(process.env.POSTGRES_PORT) || 5432,
      user: process.env.POSTGRES_USER || "postgres",
      password: process.env.POSTGRES_PASSWORD || "postgres",
      database: process.env.POSTGRES_DATABASE || "test",
    }),
  );

  // Create table
  await db.sql`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT, email TEXT)`;
  console.log("✓ Created users table");

  // Insert
  await db.sql`INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com')`;
  await db.sql`INSERT INTO users (name, email) VALUES ('Bob', 'bob@example.com')`;
  console.log("✓ Inserted 2 users");

  // Select all
  const users = await db.sql`SELECT * FROM users`;
  console.log("✓ All users:", users);

  // Select with WHERE
  const alice = await db.sql`SELECT * FROM users WHERE name = 'Alice'`;
  console.log("✓ Found Alice:", alice);

  // Update
  await db.sql`UPDATE users SET email = 'alice@test.com' WHERE name = 'Alice'`;
  const updated = await db.sql`SELECT * FROM users WHERE name = 'Alice'`;
  console.log("✓ Updated Alice:", updated);

  // Delete
  await db.sql`DELETE FROM users WHERE name = 'Bob'`;
  const remaining = await db.sql`SELECT * FROM users`;
  console.log("✓ After delete:", remaining);

  // Transaction
  await db.transaction(async (tx) => {
    await tx.sql`INSERT INTO users (name, email) VALUES ('Charlie', 'charlie@example.com')`;
    await tx.sql`INSERT INTO users (name, email) VALUES ('Diana', 'diana@example.com')`;
  });
  const afterTx = await db.sql`SELECT * FROM users`;
  console.log("✓ After transaction:", afterTx);

  // Cleanup
  await db.sql`DROP TABLE users`;
  await db.dispose();
  console.log("✓ Cleaned up");
}

main().catch(console.error);

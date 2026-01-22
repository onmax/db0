import { createDatabase } from "db0";
import mysql2 from "db0/connectors/mysql/mysql2";

async function main() {
  const db = createDatabase(
    mysql2({
      host: process.env.MYSQL_HOST || "localhost",
      port: Number(process.env.MYSQL_PORT) || 3306,
      user: process.env.MYSQL_USER || "root",
      password: process.env.MYSQL_PASSWORD || "root",
      database: process.env.MYSQL_DATABASE || "test",
    }),
  );

  // Create table
  await db.sql`CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255), email VARCHAR(255))`;
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

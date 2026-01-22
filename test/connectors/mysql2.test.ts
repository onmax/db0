import { beforeAll, describe, expect, it } from "vitest";
import connector from "../../src/connectors/mysql/mysql2";
import { createDatabase, type Database, type Connector } from "../../src";
import { testConnector } from "./_tests";

describe.runIf(process.env.MYSQL_URL)("connectors: mysql2.test", () => {
  const mysqlConnector = connector({ uri: process.env.MYSQL_URL! });

  testConnector({
    dialect: "mysql",
    connector: mysqlConnector,
  });
});

describe.runIf(process.env.MYSQL_URL)(
  "connectors: mysql2 - specific features",
  () => {
    let db: Database<Connector>;

    beforeAll(() => {
      db = createDatabase(connector({ uri: process.env.MYSQL_URL! }));
    });

    describe("JSON support", () => {
      it("insert and query JSON", async () => {
        await db.sql`DROP TABLE IF EXISTS json_test`;
        await db.sql`CREATE TABLE json_test (\`id\` INT AUTO_INCREMENT PRIMARY KEY, \`data\` JSON)`;

        const jsonData = { name: "John", age: 30, tags: ["admin", "user"] };
        await db.sql`INSERT INTO json_test (data) VALUES (${JSON.stringify(jsonData)})`;

        const { rows } = await db.sql`SELECT * FROM json_test WHERE id = 1`;
        expect((rows as { data: typeof jsonData }[])[0].data).toEqual(jsonData);
      });

      it("JSON path extraction", async () => {
        await db.sql`DROP TABLE IF EXISTS json_path`;
        await db.sql`CREATE TABLE json_path (\`id\` INT AUTO_INCREMENT PRIMARY KEY, \`data\` JSON)`;

        await db.sql`INSERT INTO json_path (data) VALUES ('{"name": "Alice", "score": 100}')`;
        await db.sql`INSERT INTO json_path (data) VALUES ('{"name": "Bob", "score": 85}')`;

        const { rows } =
          await db.sql`SELECT * FROM json_path WHERE JSON_EXTRACT(data, '$.score') > 90`;
        expect(rows).toHaveLength(1);
        expect((rows as { data: { name: string } }[])[0].data.name).toBe(
          "Alice",
        );
      });

      it("JSON_OBJECT and JSON_ARRAY", async () => {
        const { rows } =
          await db.sql`SELECT JSON_OBJECT('key', 'value', 'num', 123) as obj`;
        expect((rows as { obj: object }[])[0].obj).toEqual({
          key: "value",
          num: 123,
        });
      });
    });

    describe("ENUM support", () => {
      it("create and use ENUM", async () => {
        await db.sql`DROP TABLE IF EXISTS enum_test`;
        await db.sql`CREATE TABLE enum_test (\`id\` INT AUTO_INCREMENT PRIMARY KEY, \`status\` ENUM('pending', 'active', 'completed'))`;

        await db.sql`INSERT INTO enum_test (status) VALUES ('pending')`;
        await db.sql`INSERT INTO enum_test (status) VALUES ('active')`;

        const { rows } =
          await db.sql`SELECT * FROM enum_test WHERE status = 'active'`;
        expect(rows).toHaveLength(1);
        expect((rows as { status: string }[])[0].status).toBe("active");
      });
    });

    describe("SET type", () => {
      it("create and use SET", async () => {
        await db.sql`DROP TABLE IF EXISTS set_test`;
        await db.sql`CREATE TABLE set_test (\`id\` INT AUTO_INCREMENT PRIMARY KEY, \`permissions\` SET('read', 'write', 'delete'))`;

        await db.sql`INSERT INTO set_test (permissions) VALUES ('read,write')`;

        const { rows } = await db.sql`SELECT * FROM set_test WHERE id = 1`;
        expect((rows as { permissions: string }[])[0].permissions).toBe(
          "read,write",
        );
      });

      it("FIND_IN_SET", async () => {
        await db.sql`DROP TABLE IF EXISTS set_find`;
        await db.sql`CREATE TABLE set_find (\`id\` INT AUTO_INCREMENT PRIMARY KEY, \`tags\` SET('admin', 'user', 'guest'))`;

        await db.sql`INSERT INTO set_find (tags) VALUES ('admin,user')`;
        await db.sql`INSERT INTO set_find (tags) VALUES ('guest')`;

        const { rows } =
          await db.sql`SELECT * FROM set_find WHERE FIND_IN_SET('admin', tags)`;
        expect(rows).toHaveLength(1);
      });
    });

    describe("AUTO_INCREMENT", () => {
      it("auto-increment primary key", async () => {
        await db.sql`DROP TABLE IF EXISTS auto_inc_test`;
        await db.sql`CREATE TABLE auto_inc_test (\`id\` INT AUTO_INCREMENT PRIMARY KEY, \`name\` VARCHAR(255))`;

        await db.sql`INSERT INTO auto_inc_test (name) VALUES ('first')`;
        await db.sql`INSERT INTO auto_inc_test (name) VALUES ('second')`;
        await db.sql`INSERT INTO auto_inc_test (name) VALUES ('third')`;

        const { rows } = await db.sql`SELECT * FROM auto_inc_test ORDER BY id`;
        expect(rows).toHaveLength(3);
        expect((rows as { id: number }[])[0].id).toBe(1);
        expect((rows as { id: number }[])[1].id).toBe(2);
        expect((rows as { id: number }[])[2].id).toBe(3);
      });

      it("LAST_INSERT_ID", async () => {
        await db.sql`DROP TABLE IF EXISTS last_id_test`;
        await db.sql`CREATE TABLE last_id_test (\`id\` INT AUTO_INCREMENT PRIMARY KEY, \`value\` VARCHAR(255))`;

        await db.sql`INSERT INTO last_id_test (value) VALUES ('test')`;

        const { rows } = await db.sql`SELECT LAST_INSERT_ID() as last_id`;
        expect((rows as { last_id: number }[])[0].last_id).toBe(1);
      });
    });

    describe("Date/Time types", () => {
      it("DATE", async () => {
        await db.sql`DROP TABLE IF EXISTS date_test`;
        await db.sql`CREATE TABLE date_test (\`id\` INT AUTO_INCREMENT PRIMARY KEY, \`date_val\` DATE)`;

        await db.sql`INSERT INTO date_test (date_val) VALUES ('2024-01-15')`;

        const { rows } = await db.sql`SELECT * FROM date_test WHERE id = 1`;
        const dateVal = (rows as { date_val: Date }[])[0].date_val;
        expect(dateVal).toBeInstanceOf(Date);
        expect(dateVal.getFullYear()).toBe(2024);
      });

      it("DATETIME", async () => {
        await db.sql`DROP TABLE IF EXISTS datetime_test`;
        await db.sql`CREATE TABLE datetime_test (\`id\` INT AUTO_INCREMENT PRIMARY KEY, \`created_at\` DATETIME)`;

        await db.sql`INSERT INTO datetime_test (created_at) VALUES ('2024-01-15 10:30:00')`;

        const { rows } = await db.sql`SELECT * FROM datetime_test WHERE id = 1`;
        const createdAt = (rows as { created_at: Date }[])[0].created_at;
        expect(createdAt).toBeInstanceOf(Date);
        expect(createdAt.getFullYear()).toBe(2024);
      });

      it("TIMESTAMP", async () => {
        await db.sql`DROP TABLE IF EXISTS timestamp_test`;
        await db.sql`CREATE TABLE timestamp_test (\`id\` INT AUTO_INCREMENT PRIMARY KEY, \`ts\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;

        await db.sql`INSERT INTO timestamp_test (id) VALUES (1)`;

        const { rows } =
          await db.sql`SELECT * FROM timestamp_test WHERE id = 1`;
        expect((rows as { ts: Date }[])[0].ts).toBeInstanceOf(Date);
      });

      it("TIME", async () => {
        await db.sql`DROP TABLE IF EXISTS time_test`;
        await db.sql`CREATE TABLE time_test (\`id\` INT AUTO_INCREMENT PRIMARY KEY, \`time_val\` TIME)`;

        await db.sql`INSERT INTO time_test (time_val) VALUES ('14:30:00')`;

        const { rows } = await db.sql`SELECT * FROM time_test WHERE id = 1`;
        expect((rows as { time_val: string }[])[0].time_val).toBeDefined();
      });

      it("YEAR", async () => {
        await db.sql`DROP TABLE IF EXISTS year_test`;
        await db.sql`CREATE TABLE year_test (\`id\` INT AUTO_INCREMENT PRIMARY KEY, \`year_val\` YEAR)`;

        await db.sql`INSERT INTO year_test (year_val) VALUES (2024)`;

        const { rows } = await db.sql`SELECT * FROM year_test WHERE id = 1`;
        expect((rows as { year_val: number }[])[0].year_val).toBe(2024);
      });
    });

    describe("Numeric precision", () => {
      it("DECIMAL", async () => {
        await db.sql`DROP TABLE IF EXISTS decimal_test`;
        await db.sql`CREATE TABLE decimal_test (\`id\` INT AUTO_INCREMENT PRIMARY KEY, \`amount\` DECIMAL(10, 2))`;

        await db.sql`INSERT INTO decimal_test (amount) VALUES (12345.67)`;

        const { rows } = await db.sql`SELECT * FROM decimal_test WHERE id = 1`;
        expect((rows as { amount: string }[])[0].amount).toBe("12345.67");
      });

      it("BIGINT", async () => {
        await db.sql`DROP TABLE IF EXISTS bigint_test`;
        await db.sql`CREATE TABLE bigint_test (\`id\` INT AUTO_INCREMENT PRIMARY KEY, \`big_num\` BIGINT)`;

        // Using a value within JavaScript's safe integer range
        const bigValue = 9_007_199_254_740_991; // Number.MAX_SAFE_INTEGER
        await db.sql`INSERT INTO bigint_test (big_num) VALUES (${bigValue})`;

        const { rows } = await db.sql`SELECT * FROM bigint_test WHERE id = 1`;
        expect((rows as { big_num: number }[])[0].big_num).toBe(bigValue);
      });

      it("UNSIGNED INT", async () => {
        await db.sql`DROP TABLE IF EXISTS unsigned_test`;
        await db.sql`CREATE TABLE unsigned_test (\`id\` INT AUTO_INCREMENT PRIMARY KEY, \`val\` INT UNSIGNED)`;

        await db.sql`INSERT INTO unsigned_test (val) VALUES (4294967295)`;

        const { rows } = await db.sql`SELECT * FROM unsigned_test WHERE id = 1`;
        expect((rows as { val: number }[])[0].val).toBe(4_294_967_295);
      });
    });

    describe("ON DUPLICATE KEY UPDATE (UPSERT)", () => {
      it("INSERT ON DUPLICATE KEY UPDATE", async () => {
        await db.sql`DROP TABLE IF EXISTS upsert_test`;
        await db.sql`CREATE TABLE upsert_test (\`id\` INT PRIMARY KEY, \`value\` VARCHAR(255), \`count\` INT DEFAULT 1)`;

        await db.sql`INSERT INTO upsert_test (id, value) VALUES (1, 'initial')`;
        await db.sql`INSERT INTO upsert_test (id, value, count) VALUES (1, 'updated', 2) ON DUPLICATE KEY UPDATE value = VALUES(value), count = VALUES(count)`;

        const { rows } = await db.sql`SELECT * FROM upsert_test WHERE id = 1`;
        expect((rows as { value: string; count: number }[])[0].value).toBe(
          "updated",
        );
        expect((rows as { value: string; count: number }[])[0].count).toBe(2);
      });

      it("INSERT IGNORE", async () => {
        await db.sql`DROP TABLE IF EXISTS insert_ignore`;
        await db.sql`CREATE TABLE insert_ignore (\`id\` INT PRIMARY KEY, \`value\` VARCHAR(255))`;

        await db.sql`INSERT INTO insert_ignore (id, value) VALUES (1, 'first')`;
        await db.sql`INSERT IGNORE INTO insert_ignore (id, value) VALUES (1, 'second')`;

        const { rows } = await db.sql`SELECT * FROM insert_ignore WHERE id = 1`;
        expect((rows as { value: string }[])[0].value).toBe("first");
      });

      it("REPLACE INTO", async () => {
        await db.sql`DROP TABLE IF EXISTS replace_test`;
        await db.sql`CREATE TABLE replace_test (\`id\` INT PRIMARY KEY, \`value\` VARCHAR(255))`;

        await db.sql`INSERT INTO replace_test (id, value) VALUES (1, 'original')`;
        await db.sql`REPLACE INTO replace_test (id, value) VALUES (1, 'replaced')`;

        const { rows } = await db.sql`SELECT * FROM replace_test WHERE id = 1`;
        expect((rows as { value: string }[])[0].value).toBe("replaced");
      });
    });

    describe("String functions", () => {
      it("CONCAT", async () => {
        const { rows } =
          await db.sql`SELECT CONCAT('Hello', ' ', 'World') as result`;
        expect((rows as { result: string }[])[0].result).toBe("Hello World");
      });

      it("GROUP_CONCAT", async () => {
        await db.sql`DROP TABLE IF EXISTS group_concat_test`;
        await db.sql`CREATE TABLE group_concat_test (\`id\` INT AUTO_INCREMENT PRIMARY KEY, \`category\` VARCHAR(50), \`name\` VARCHAR(50))`;

        await db.sql`INSERT INTO group_concat_test (category, name) VALUES ('fruit', 'apple')`;
        await db.sql`INSERT INTO group_concat_test (category, name) VALUES ('fruit', 'banana')`;
        await db.sql`INSERT INTO group_concat_test (category, name) VALUES ('vegetable', 'carrot')`;

        const { rows } =
          await db.sql`SELECT category, GROUP_CONCAT(name ORDER BY name) as names FROM group_concat_test GROUP BY category ORDER BY category`;
        expect(rows).toHaveLength(2);
        expect((rows as { names: string }[])[0].names).toBe("apple,banana");
      });
    });

    describe("BLOB and TEXT types", () => {
      it("BLOB", async () => {
        await db.sql`DROP TABLE IF EXISTS blob_test`;
        await db.sql`CREATE TABLE blob_test (\`id\` INT AUTO_INCREMENT PRIMARY KEY, \`data\` BLOB)`;

        const binaryData = Buffer.from("Hello Binary World");
        await db.sql`INSERT INTO blob_test (data) VALUES (${binaryData})`;

        const { rows } = await db.sql`SELECT * FROM blob_test WHERE id = 1`;
        const data = (rows as { data: Buffer }[])[0].data;
        expect(Buffer.isBuffer(data)).toBe(true);
        expect(data.toString()).toBe("Hello Binary World");
      });

      it("TEXT types", async () => {
        await db.sql`DROP TABLE IF EXISTS text_types`;
        await db.sql`CREATE TABLE text_types (\`id\` INT AUTO_INCREMENT PRIMARY KEY, \`tiny\` TINYTEXT, \`medium\` MEDIUMTEXT, \`long_text\` LONGTEXT)`;

        await db.sql`INSERT INTO text_types (tiny, medium, long_text) VALUES ('small', 'medium sized', 'this is a longer text')`;

        const { rows } = await db.sql`SELECT * FROM text_types WHERE id = 1`;
        expect((rows as { tiny: string }[])[0].tiny).toBe("small");
        expect((rows as { medium: string }[])[0].medium).toBe("medium sized");
      });
    });

    describe("Subqueries and derived tables", () => {
      it("subquery in WHERE", async () => {
        await db.sql`DROP TABLE IF EXISTS subq_orders`;
        await db.sql`DROP TABLE IF EXISTS subq_customers`;
        await db.sql`CREATE TABLE subq_customers (\`id\` INT PRIMARY KEY, \`name\` VARCHAR(50))`;
        await db.sql`CREATE TABLE subq_orders (\`id\` INT PRIMARY KEY, \`customer_id\` INT, \`amount\` DECIMAL(10,2))`;

        await db.sql`INSERT INTO subq_customers VALUES (1, 'Alice'), (2, 'Bob')`;
        await db.sql`INSERT INTO subq_orders VALUES (1, 1, 100.00), (2, 1, 200.00)`;

        const { rows } = await db.sql`
          SELECT * FROM subq_customers
          WHERE id IN (SELECT DISTINCT customer_id FROM subq_orders)
        `;
        expect(rows).toHaveLength(1);
        expect((rows as { name: string }[])[0].name).toBe("Alice");
      });
    });

    describe("Window functions (MySQL 8+)", () => {
      it("ROW_NUMBER", async () => {
        await db.sql`DROP TABLE IF EXISTS window_test`;
        await db.sql`CREATE TABLE window_test (\`id\` INT AUTO_INCREMENT PRIMARY KEY, \`category\` VARCHAR(50), \`value\` INT)`;

        await db.sql`INSERT INTO window_test (category, value) VALUES ('A', 10), ('A', 20), ('B', 30)`;

        const { rows } = await db.sql`
          SELECT *, ROW_NUMBER() OVER (PARTITION BY category ORDER BY value) as rn
          FROM window_test
        `;
        expect(rows).toHaveLength(3);
      });

      it("RANK and DENSE_RANK", async () => {
        await db.sql`DROP TABLE IF EXISTS rank_test`;
        await db.sql`CREATE TABLE rank_test (\`id\` INT AUTO_INCREMENT PRIMARY KEY, \`score\` INT)`;

        await db.sql`INSERT INTO rank_test (score) VALUES (100), (100), (90), (80)`;

        const { rows } = await db.sql`
          SELECT score,
            RANK() OVER (ORDER BY score DESC) as rank_val,
            DENSE_RANK() OVER (ORDER BY score DESC) as dense_rank_val
          FROM rank_test
        `;
        expect(rows).toHaveLength(4);
        expect((rows as { rank_val: number }[])[0].rank_val).toBe(1);
        expect((rows as { rank_val: number }[])[2].rank_val).toBe(3);
      });
    });

    describe("cleanup", () => {
      it("dispose", async () => {
        await db.dispose();
        expect(db.disposed).toBe(true);
      });
    });
  },
);

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import mysql from "mysql2/promise";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  try {
    const raw = readFileSync(join(__dirname, "..", ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}

loadEnv();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const conn = await mysql.createConnection({ uri: url, multipleStatements: true });

try {
  console.log("Starting database migration for UNIQUE/COPY role renaming...");

  // 1. Update copy_role values
  console.log("Updating copy_role values in product_copies table...");
  await conn.query("UPDATE product_copies SET copy_role = 'UNIQUE' WHERE copy_role = 'MASTER'");
  await conn.query("UPDATE product_copies SET copy_role = 'COPY' WHERE copy_role = 'SLAVE'");
  console.log("✓ copy_role values updated");

  // 2. Drop existing index and generated column if they exist
  console.log("Dropping old is_master_flag and uq_one_master index if they exist...");
  try {
    await conn.query("ALTER TABLE product_copies DROP INDEX uq_one_master");
    console.log("✓ Old index uq_one_master dropped");
  } catch (err) {
    console.log("Note: uq_one_master index could not be dropped (might not exist):", err.message);
  }

  try {
    await conn.query("ALTER TABLE product_copies DROP COLUMN is_master_flag");
    console.log("✓ Old column is_master_flag dropped");
  } catch (err) {
    console.log("Note: is_master_flag column could not be dropped (might not exist):", err.message);
  }

  // 3. Re-apply the new patch
  console.log("Re-applying patch-one-master.sql...");
  const sql = readFileSync(join(__dirname, "patch-one-master.sql"), "utf8");
  await conn.query(sql);
  console.log("✓ New UNIQUE constraint patch applied successfully!");

} catch (e) {
  console.error("Migration failed:", e.message);
  process.exitCode = 1;
} finally {
  await conn.end();
}

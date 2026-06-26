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

const sqlPath = join(__dirname, "data", "masters.sql");
console.log(`Loading master data SQL from ${sqlPath}...`);
const sql = readFileSync(sqlPath, "utf8");

const conn = await mysql.createConnection({ uri: url, multipleStatements: true });
try {
  console.log("Emptying existing master tables...");
  await conn.query("SET FOREIGN_KEY_CHECKS=0;");
  await conn.query("TRUNCATE TABLE category_attributes;");
  await conn.query("TRUNCATE TABLE attribute_options;");
  await conn.query("TRUNCATE TABLE attributes;");
  await conn.query("TRUNCATE TABLE sticker_templates;");
  await conn.query("DELETE FROM categories;");
  console.log("Table cleanup done. Running masters.sql...");
  await conn.query(sql);
  console.log("✓ Master data SQL loaded successfully!");
} catch (e) {
  console.error("Failed to load master SQL:", e.message);
  process.exitCode = 1;
} finally {
  await conn.end();
}

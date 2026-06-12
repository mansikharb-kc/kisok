// Applies prisma/patch-one-master.sql using the DATABASE_URL connection.
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

const sql = readFileSync(join(__dirname, "patch-one-master.sql"), "utf8");

const conn = await mysql.createConnection({ uri: url, multipleStatements: true });
try {
  await conn.query(sql);
  console.log("✓ one-master patch applied");
} catch (e) {
  console.error("patch failed:", e.message);
  process.exitCode = 1;
} finally {
  await conn.end();
}

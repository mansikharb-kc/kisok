// One-time migration: copy the category taxonomy from the OLD database
// (kc_ims.categories — CUID ids, slug) into the NEW schema
// (kc_ims_v2.categories — bigint ids, code), preserving the parent hierarchy.
//
//   slug      -> code
//   name      -> name
//   parent_id -> parent_id (remapped CUID -> new bigint)
//   is_active -> status ('active' | 'retired')
//
// The old DB is only READ from; nothing there is modified.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import mysql from "mysql2/promise";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_DB = "kc_ims"; // old database to read categories from

function loadEnv() {
  const raw = readFileSync(join(__dirname, "..", ".env"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();

const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL });
const targetDb = (await conn.query("SELECT DATABASE() AS db"))[0][0].db;
console.log(`Source: ${SOURCE_DB}.categories  →  Target: ${targetDb}.categories`);

// Skip if target already has categories (idempotent guard).
const [[{ cnt }]] = await conn.query("SELECT COUNT(*) AS cnt FROM categories");
if (cnt > 0) {
  console.log(`Target already has ${cnt} categories — skipping migration.`);
  await conn.end();
  process.exit(0);
}

// Read source ordered so every parent is inserted before its children.
const [rows] = await conn.query(
  `SELECT id, name, slug, parent_id, is_active, created_at
     FROM \`${SOURCE_DB}\`.categories
    ORDER BY level ASC, sort_order ASC, created_at ASC`,
);
console.log(`Read ${rows.length} source categories.`);

const idMap = new Map(); // oldCuid -> newBigintId
let inserted = 0;
let skippedNoParent = 0;

for (const r of rows) {
  let newParentId = null;
  if (r.parent_id) {
    newParentId = idMap.get(r.parent_id) ?? null;
    if (newParentId === null) {
      // Parent not migrated (shouldn't happen with level ordering) — attach to root.
      skippedNoParent++;
    }
  }
  const status = r.is_active ? "active" : "retired";
  const [res] = await conn.query(
    `INSERT INTO categories (name, code, parent_id, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [r.name, r.slug, newParentId, status, r.created_at, r.created_at],
  );
  idMap.set(r.id, res.insertId);
  inserted++;
  if (inserted % 1000 === 0) console.log(`  …${inserted} inserted`);
}

console.log(`✓ Migrated ${inserted} categories.`);
if (skippedNoParent) console.log(`  (${skippedNoParent} had an unresolved parent → attached to root)`);
await conn.end();

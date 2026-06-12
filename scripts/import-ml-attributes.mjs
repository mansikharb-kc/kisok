// Import attributes + category mappings from the ML workbook into kc_ims_v2.
//   Attributes sheet      -> attributes (keyed by slug)
//   Cat_Attribute_Map     -> category_attributes (category matched by NAME, attribute by ML ID)
// Idempotent: re-running upserts.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import mysql from "mysql2/promise";
import xlsx from "xlsx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const XLSX_PATH = process.argv[2] || "C:\\Users\\Prince Jangra\\Downloads\\attributes_ref_data_v2.xlsx";

function loadEnv() {
  const raw = readFileSync(join(__dirname, "..", ".env"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();

const VALID_TYPES = new Set(["string", "number", "enum", "boolean", "date", "file"]);
const truthy = (v) => v === 1 || v === "1" || v === true || v === "TRUE";

const wb = xlsx.readFile(XLSX_PATH);
const attrRows = xlsx.utils.sheet_to_json(wb.Sheets["Attributes"], { defval: "" });
const mapRows = xlsx.utils.sheet_to_json(wb.Sheets["Cat_Attribute_Map"], { defval: "" });

const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL });

// ---- 1. Import attributes ----
const mlIdToDbId = new Map();
let attrCreated = 0;
for (const r of attrRows) {
  const code = String(r["Slug"] || "").trim();
  if (!code) continue;
  let dataType = String(r["Type"] || "string").trim().toLowerCase();
  if (!VALID_TYPES.has(dataType)) dataType = "string";
  const name = String(r["Display Name"] || r["Name"] || code).trim();
  const unit = String(r["Unit Code"] || "").trim() || null;
  const sectionGroup = String(r["Section Group Name"] || r["Section Name"] || "").trim() || null;
  const isVariant = truthy(r["Is Variant"]) ? 1 : 0;
  const isPriceable = truthy(r["Is Priceable"]) ? 1 : 0;
  const isRequired = truthy(r["Is Mandatory"]) ? 1 : 0;

  await conn.query(
    `INSERT INTO attributes (name, code, data_type, unit, section_group, is_variant, is_priceable, is_required, status, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?, 'active', NOW(), NOW())
     ON DUPLICATE KEY UPDATE name=VALUES(name), data_type=VALUES(data_type), unit=VALUES(unit),
       section_group=VALUES(section_group), is_variant=VALUES(is_variant), is_priceable=VALUES(is_priceable),
       is_required=VALUES(is_required), updated_at=NOW()`,
    [name, code, dataType, unit, sectionGroup, isVariant, isPriceable, isRequired],
  );
  const [[row]] = await conn.query(`SELECT id FROM attributes WHERE code=?`, [code]);
  mlIdToDbId.set(String(r["ID"]), row.id);
  attrCreated++;
}
console.log(`✓ attributes upserted: ${attrCreated}`);

// ---- 2. Build category name -> id(s) map ----
const [cats] = await conn.query(`SELECT id, name FROM categories`);
const nameToIds = new Map();
for (const c of cats) {
  const k = c.name.trim().toLowerCase();
  if (!nameToIds.has(k)) nameToIds.set(k, []);
  nameToIds.get(k).push(c.id);
}

// ---- 3. Import category-attribute mappings ----
let mapped = 0;
const skippedCats = new Set();
let ambiguous = 0;
for (const r of mapRows) {
  const catName = String(r["Category"] || "").trim();
  const mlAttrId = String(r["Attribute ID"] || "");
  const dbAttrId = mlIdToDbId.get(mlAttrId);
  if (!catName || !dbAttrId) continue;

  const ids = nameToIds.get(catName.toLowerCase());
  if (!ids || ids.length === 0) { skippedCats.add(catName); continue; }
  if (ids.length > 1) { ambiguous++; }
  const catId = ids[0]; // pick first match

  const isRequired = truthy(r["Is Required"]) ? 1 : 0;
  const isSearchable = truthy(r["Is Searchable"]) ? 1 : 0;
  const displayOrder = Number(r["Display Order"]) || 0;

  await conn.query(
    `INSERT INTO category_attributes (category_id, attribute_id, display_order, is_required_override, is_searchable)
     VALUES (?,?,?,?,?)
     ON DUPLICATE KEY UPDATE display_order=VALUES(display_order),
       is_required_override=VALUES(is_required_override), is_searchable=VALUES(is_searchable)`,
    [catId, dbAttrId, displayOrder, isRequired, isSearchable],
  );
  mapped++;
}

console.log(`✓ category-attribute mappings: ${mapped}`);
if (ambiguous) console.log(`  (${ambiguous} rows matched a non-unique category name — used first match)`);
if (skippedCats.size) console.log(`  skipped categories not found by name: ${[...skippedCats].join(", ")}`);

await conn.end();

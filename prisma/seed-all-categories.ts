import { PrismaClient } from "@prisma/client";
import xlsx from "xlsx";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();

function loadEnv() {
  const raw = readFileSync(join(__dirname, "..", ".env"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  console.log("Reading env variables...");
  loadEnv();

  const XLSX_PATH = "C:\\Users\\LT27\\Downloads\\Marketplace_Taxonomy_V6.xlsx";
  console.log(`Loading workbook from ${XLSX_PATH}...`);
  const wb = xlsx.readFile(XLSX_PATH);
  
  console.log("Parsing sheet 'Full Taxonomy'...");
  const sheet = wb.Sheets["Full Taxonomy"];
  const rows: any[] = xlsx.utils.sheet_to_json(sheet, { defval: "" });
  console.log(`Found ${rows.length} rows in taxonomy sheet.`);

  // We will track unique entries at each level.
  // Level 1: Domain L1
  // Level 2: Domain L1 -> Group L2
  // Level 3: Group L2 -> Family L3
  // Level 4: Family L3 -> Sub-Category (L4)
  // Level 5: Sub-Category (L4) -> Product Sub-Type (L5)

  const usedCodes = new Set<string>();
  const getUniqueCode = (name: string): string => {
    let base = slugify(name) || "category";
    let code = base;
    let k = 2;
    while (usedCodes.has(code)) {
      code = `${base}-${k++}`;
    }
    usedCodes.add(code);
    return code;
  };

  // --- LEVEL 1: Domain L1 ---
  console.log("Processing L1: Domains...");
  const l1Names = new Set<string>();
  for (const r of rows) {
    const d1 = String(r["Domain L1"] || "").trim();
    if (d1) l1Names.add(d1);
  }
  
  const l1Data = Array.from(l1Names).map(name => ({
    name,
    code: getUniqueCode(name),
    parentId: null,
    status: "active"
  }));
  console.log(`Bulk inserting ${l1Data.length} L1 Domains...`);
  await prisma.category.createMany({ data: l1Data, skipDuplicates: true });

  const dbL1 = await prisma.category.findMany({ where: { parentId: null } });
  const l1Map = new Map<string, bigint>();
  for (const c of dbL1) {
    l1Map.set(c.name.trim().toLowerCase(), c.id);
  }

  // --- LEVEL 2: Group L2 ---
  console.log("Processing L2: Groups...");
  const l2Keys = new Set<string>(); // "l1Name|l2Name"
  for (const r of rows) {
    const d1 = String(r["Domain L1"] || "").trim().toLowerCase();
    const d2 = String(r["Group L2"] || "").trim();
    if (d1 && d2) {
      l2Keys.add(`${d1}|${d2}`);
    }
  }

  const l2Data: any[] = [];
  for (const key of l2Keys) {
    const [d1Name, d2Name] = key.split("|");
    const parentId = l1Map.get(d1Name);
    if (parentId !== undefined) {
      l2Data.push({
        name: d2Name,
        code: getUniqueCode(d2Name),
        parentId,
        status: "active"
      });
    }
  }
  console.log(`Bulk inserting ${l2Data.length} L2 Groups...`);
  await prisma.category.createMany({ data: l2Data, skipDuplicates: true });

  const dbL2 = await prisma.category.findMany({ where: { parentId: { not: null } } });
  // Map of "l1Name|l2Name" -> id
  const l2Map = new Map<string, bigint>();
  // We need to look up their parent name to build correct key
  const l2MapHelper = new Map<bigint, string>();
  for (const c of dbL1) l2MapHelper.set(c.id, c.name.trim().toLowerCase());
  for (const c of dbL2) {
    const parentName = l2MapHelper.get(c.parentId!);
    if (parentName) {
      l2Map.set(`${parentName}|${c.name.trim().toLowerCase()}`, c.id);
    }
  }

  // --- LEVEL 3: Family L3 ---
  console.log("Processing L3: Families...");
  const l3Keys = new Set<string>(); // "l1Name|l2Name|l3Name"
  for (const r of rows) {
    const d1 = String(r["Domain L1"] || "").trim().toLowerCase();
    const d2 = String(r["Group L2"] || "").trim().toLowerCase();
    const d3 = String(r["Family L3"] || "").trim();
    if (d1 && d2 && d3) {
      l3Keys.add(`${d1}|${d2}|${d3}`);
    }
  }

  const l3Data: any[] = [];
  for (const key of l3Keys) {
    const parts = key.split("|");
    const d3Name = parts[2];
    const parentKey = `${parts[0]}|${parts[1]}`;
    const parentId = l2Map.get(parentKey);
    if (parentId !== undefined) {
      l3Data.push({
        name: d3Name,
        code: getUniqueCode(d3Name),
        parentId,
        status: "active"
      });
    }
  }
  console.log(`Bulk inserting ${l3Data.length} L3 Families...`);
  await prisma.category.createMany({ data: l3Data, skipDuplicates: true });

  // Let's retrieve all L3 categories. Since it can be a lot, we do it in batches or select only needed fields.
  const dbL3 = await prisma.category.findMany({
    where: { parentId: { in: Array.from(l2Map.values()) } },
    select: { id: true, name: true, parentId: true }
  });
  
  // We want to map "l1Name|l2Name|l3Name" -> id
  const l3Map = new Map<string, bigint>();
  // First helper to map L2 id -> "l1Name|l2Name"
  const l3MapHelper = new Map<bigint, string>();
  for (const [key, id] of l2Map.entries()) {
    l3MapHelper.set(id, key);
  }
  for (const c of dbL3) {
    const parentKey = l3MapHelper.get(c.parentId!);
    if (parentKey) {
      l3Map.set(`${parentKey}|${c.name.trim().toLowerCase()}`, c.id);
    }
  }

  // --- LEVEL 4: Sub-Category (L4) ---
  console.log("Processing L4: Sub-Categories...");
  const l4Keys = new Set<string>(); // "l1Name|l2Name|l3Name|l4Name"
  for (const r of rows) {
    const d1 = String(r["Domain L1"] || "").trim().toLowerCase();
    const d2 = String(r["Group L2"] || "").trim().toLowerCase();
    const d3 = String(r["Family L3"] || "").trim().toLowerCase();
    const d4 = String(r["Sub-Category (L4)"] || "").trim();
    if (d1 && d2 && d3 && d4) {
      l4Keys.add(`${d1}|${d2}|${d3}|${d4}`);
    }
  }

  const l4Data: any[] = [];
  for (const key of l4Keys) {
    const parts = key.split("|");
    const d4Name = parts[3];
    const parentKey = `${parts[0]}|${parts[1]}|${parts[2]}`;
    const parentId = l3Map.get(parentKey);
    if (parentId !== undefined) {
      l4Data.push({
        name: d4Name,
        code: getUniqueCode(d4Name),
        parentId,
        status: "active"
      });
    }
  }
  console.log(`Bulk inserting ${l4Data.length} L4 Sub-Categories...`);
  // Batch insertion in chunks of 5000 to prevent SQL length issues
  for (let i = 0; i < l4Data.length; i += 5000) {
    const chunk = l4Data.slice(i, i + 5000);
    await prisma.category.createMany({ data: chunk, skipDuplicates: true });
  }

  const dbL4 = await prisma.category.findMany({
    where: { parentId: { in: Array.from(l3Map.values()) } },
    select: { id: true, name: true, parentId: true }
  });
  
  // Map "l1Name|l2Name|l3Name|l4Name" -> id
  const l4Map = new Map<string, bigint>();
  const l4MapHelper = new Map<bigint, string>();
  for (const [key, id] of l3Map.entries()) {
    l4MapHelper.set(id, key);
  }
  for (const c of dbL4) {
    const parentKey = l4MapHelper.get(c.parentId!);
    if (parentKey) {
      l4Map.set(`${parentKey}|${c.name.trim().toLowerCase()}`, c.id);
    }
  }

  // --- LEVEL 5: Product Sub-Type (L5) ---
  console.log("Processing L5: Product Sub-Types...");
  const l5Keys = new Set<string>(); // "l1Name|l2Name|l3Name|l4Name|l5Name"
  for (const r of rows) {
    const d1 = String(r["Domain L1"] || "").trim().toLowerCase();
    const d2 = String(r["Group L2"] || "").trim().toLowerCase();
    const d3 = String(r["Family L3"] || "").trim().toLowerCase();
    const d4 = String(r["Sub-Category (L4)"] || "").trim().toLowerCase();
    const d5 = String(r["Product Sub-Type (L5)"] || "").trim();
    if (d1 && d2 && d3 && d4 && d5) {
      l5Keys.add(`${d1}|${d2}|${d3}|${d4}|${d5}`);
    }
  }

  const l5Data: any[] = [];
  for (const key of l5Keys) {
    const parts = key.split("|");
    const d5Name = parts[4];
    const parentKey = `${parts[0]}|${parts[1]}|${parts[2]}|${parts[3]}`;
    const parentId = l4Map.get(parentKey);
    if (parentId !== undefined) {
      l5Data.push({
        name: d5Name,
        code: getUniqueCode(d5Name),
        parentId,
        status: "active"
      });
    }
  }
  console.log(`Bulk inserting ${l5Data.length} L5 Product Sub-Types...`);
  // Batch insert L5
  for (let i = 0; i < l5Data.length; i += 5000) {
    const chunk = l5Data.slice(i, i + 5000);
    await prisma.category.createMany({ data: chunk, skipDuplicates: true });
  }

  const total = await prisma.category.count();
  console.log(`\n🎉 DONE! Total categories in database: ${total}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

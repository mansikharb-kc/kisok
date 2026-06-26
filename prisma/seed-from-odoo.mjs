/**
 * seed-from-odoo.mjs
 * Imports real inventory data from "Master Odoo Data.xlsx" into the IMS database.
 *
 * Full flow:
 *  1. Upsert categories from Excel (74 unique)
 *  2. Upsert brands from Excel (993 unique)
 *  3. Create one "Import Seller" + "Import Program" (required for LocalOnboardingRecord)
 *  4. Upsert brand_products (deduplicated by brand+name)
 *  5. Upsert LocalOnboardingRecord per product
 *  6. Parse location codes → LocationNode hierarchy
 *  7. Create product_copies per barcode row
 *  8. Create Screen "scr-b" and link first few racks
 *
 * Prerequisites: npm run setup (DB must be pushed + seeded with roles/admin + branch)
 */

import { PrismaClient } from "@prisma/client";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

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

const prisma = new PrismaClient();

function slugify(s) {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function parseLocation(loc) {
  if (!loc) return [];
  loc = loc.trim();
  if (loc.includes("/")) return loc.split("/").filter(Boolean);
  if (loc.includes(".")) return loc.split(".").filter(Boolean);
  return [loc];
}

function log(msg) {
  process.stdout.write(msg + "\n");
}

function logProgress(current, total, prefix) {
  if (current % 100 === 0 || current === total) {
    process.stdout.write(`\r  ${prefix}: ${current}/${total}`);
    if (current === total) process.stdout.write("\n");
  }
}

async function main() {
  log("\n🚀 Starting Odoo data import...\n");

  // ── 0. Get branch ─────────────────────────────────────────────────────────
  const branch = await prisma.branch.findFirst();
  if (!branch) throw new Error("No branch found. Run npm run setup first.");
  log(`✓ Branch: ${branch.name} (id: ${branch.id})`);

  // ── 1. Load Excel ─────────────────────────────────────────────────────────
  const xlsxPath = join(__dirname, "..", "Master Odoo Data.xlsx");
  log(`Loading ${xlsxPath}...`);
  const workbook = XLSX.readFile(xlsxPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json(sheet);
  const rows = rawData.filter(r => r.Name && r.Brand);
  log(`✓ ${rows.length} product rows loaded\n`);

  // ── 2. Upsert Categories ──────────────────────────────────────────────────
  log("📂 Upserting categories...");
  const uniqueCatNames = [...new Set(rows.map(r => (r["Product Category"] || "Uncategorized").trim()))];
  const categoryMap = new Map(); // name_lower → id

  for (const catName of uniqueCatNames) {
    if (!catName) continue;
    const existing = await prisma.category.findFirst({ where: { name: catName } });
    if (existing) {
      categoryMap.set(catName.toLowerCase(), existing.id);
    } else {
      let code = slugify(catName) || "cat";
      // Ensure code uniqueness
      const conflict = await prisma.category.findFirst({ where: { code } });
      if (conflict) code = code + "-" + Math.random().toString(36).slice(2, 6);
      const created = await prisma.category.create({
        data: { name: catName, code, parentId: null, status: "active" },
      });
      categoryMap.set(catName.toLowerCase(), created.id);
    }
  }
  log(`✓ ${categoryMap.size} categories ready\n`);

  // ── 3. Upsert Brands ──────────────────────────────────────────────────────
  log("🏷️  Upserting brands...");
  const uniqueBrands = new Map(); // code → {name, code}
  for (const r of rows) {
    const name = (r.Brand || "").trim();
    const code = ((r["Brand Code"] || "").trim() || slugify(name)).slice(0, 60);
    if (name && code && !uniqueBrands.has(code)) {
      uniqueBrands.set(code, { name, code });
    }
  }

  const brandMap = new Map(); // name_lower → id
  let bIdx = 0;
  for (const { name, code } of uniqueBrands.values()) {
    bIdx++;
    logProgress(bIdx, uniqueBrands.size, "Brands");
    try {
      const upserted = await prisma.brand.upsert({
        where: { code },
        update: { name },
        create: { name, code, status: "active", approvalStatus: "approved" },
      });
      brandMap.set(name.toLowerCase(), upserted.id);
    } catch {
      const fallbackCode = code + "-" + Math.random().toString(36).slice(2, 6);
      try {
        const created = await prisma.brand.create({
          data: { name, code: fallbackCode, status: "active", approvalStatus: "approved" },
        });
        brandMap.set(name.toLowerCase(), created.id);
      } catch {}
    }
  }
  log(`✓ ${brandMap.size} brands ready\n`);

  // ── 4. Create Import Seller + Program ─────────────────────────────────────
  log("👤 Creating import seller & program...");
  let importSeller = await prisma.seller.findFirst({ where: { sellerCode: "ODOO-IMPORT" } });
  if (!importSeller) {
    importSeller = await prisma.seller.create({
      data: {
        branchId: branch.id,
        name: "Odoo Import",
        sellerCode: "ODOO-IMPORT",
        status: "active",
      },
    });
  }
  log(`  Seller: ${importSeller.name} (id: ${importSeller.id})`);

  let importProgram = await prisma.program.findFirst({ where: { code: "ODOO-IMPORT" } });
  if (!importProgram) {
    importProgram = await prisma.program.create({
      data: {
        name: "Odoo Import Program",
        code: "ODOO-IMPORT",
        status: "active",
      },
    });
  }
  log(`  Program: ${importProgram.name} (id: ${importProgram.id})`);

  // Link seller to program + branch
  try {
    await prisma.branchProgram.upsert({
      where: { branchId_programId: { branchId: branch.id, programId: importProgram.id } },
      update: {},
      create: { branchId: branch.id, programId: importProgram.id, approvalStatus: "approved" },
    });
  } catch {}
  log("✓ Seller & program ready\n");

  // ── 5. Upsert BrandProducts + LocalOnboardingRecords ─────────────────────
  log("📦 Upserting brand products + onboarding records...");
  const productMap = new Map(); // "brandId_name_lower" → productId
  const recordMap = new Map();  // productId → localRecordId

  const uniqueProductKeys = new Map(); // "brandId_name_lower" → first row
  for (const r of rows) {
    const brandName = (r.Brand || "").trim().toLowerCase();
    const productName = (r.Name || "").trim();
    if (!brandName || !productName) continue;
    const brandId = brandMap.get(brandName);
    if (!brandId) continue;
    const key = `${brandId}_${productName.toLowerCase()}`;
    if (!uniqueProductKeys.has(key)) {
      uniqueProductKeys.set(key, { r, brandId, productName });
    }
  }

  let pIdx = 0;
  for (const [key, { r, brandId, productName }] of uniqueProductKeys.entries()) {
    pIdx++;
    logProgress(pIdx, uniqueProductKeys.size, "Products");
    const catName = (r["Product Category"] || "Uncategorized").trim().toLowerCase();
    const catId = categoryMap.get(catName) || [...categoryMap.values()][0];
    if (!catId) continue;

    let sku = (r["Internal Reference"] || "").trim();
    if (!sku) sku = `${brandId}-${slugify(productName).slice(0, 40)}`;

    let product;
    try {
      product = await prisma.brandProduct.upsert({
        where: { brandId_sku: { brandId, sku } },
        update: { name: productName, categoryId: catId },
        create: { brandId, name: productName, sku, categoryId: catId, status: "active" },
      });
    } catch {
      // SKU conflict — make unique
      sku = sku + "-" + Math.random().toString(36).slice(2, 6);
      try {
        product = await prisma.brandProduct.create({
          data: { brandId, name: productName, sku, categoryId: catId, status: "active" },
        });
      } catch { continue; }
    }
    productMap.set(key, product.id);

    // Upsert local onboarding record
    try {
      const record = await prisma.localOnboardingRecord.upsert({
        where: {
          brandProductId_sellerId_branchId_programId: {
            brandProductId: product.id,
            sellerId: importSeller.id,
            branchId: branch.id,
            programId: importProgram.id,
          },
        },
        update: { status: "completed" },
        create: {
          brandProductId: product.id,
          sellerId: importSeller.id,
          branchId: branch.id,
          programId: importProgram.id,
          status: "completed",
        },
      });
      recordMap.set(product.id.toString(), record.id);
    } catch {}
  }
  log(`\n✓ ${productMap.size} products, ${recordMap.size} records ready\n`);

  // ── 6. Build Location Tree ────────────────────────────────────────────────
  log("📍 Building location tree...");
  const locationCodes = [...new Set(rows.map(r => (r.Location || "").trim()).filter(Boolean))];
  const nodeCache = new Map(); // cumulativePath → id
  const nodeTypeByDepth = ["WAREHOUSE", "BLOCK", "RACK", "TRAY", "SLOT"];

  let lIdx = 0;
  for (const locStr of locationCodes) {
    lIdx++;
    logProgress(lIdx, locationCodes.length, "Locations");
    const parts = parseLocation(locStr);
    if (!parts.length) continue;

    let parentId = null;
    let cumulativePath = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      cumulativePath = cumulativePath ? `${cumulativePath}/${part}` : part;
      if (nodeCache.has(cumulativePath)) {
        parentId = nodeCache.get(cumulativePath);
        continue;
      }

      const existing = await prisma.locationNode.findFirst({
        where: { branchId: branch.id, locationId: cumulativePath },
      });

      if (existing) {
        nodeCache.set(cumulativePath, existing.id);
        parentId = existing.id;
        continue;
      }

      const nodeType = nodeTypeByDepth[i] || "SLOT";
      const isRack = nodeType === "RACK";
      let codeBase = slugify(cumulativePath).slice(0, 50);
      if (!codeBase) codeBase = "loc";

      try {
        const node = await prisma.locationNode.create({
          data: {
            branchId: branch.id,
            parentId,
            nodeType,
            name: part,
            code: codeBase + "-" + Math.random().toString(36).slice(2, 6),
            depth: i,
            isPlacementEligible: i >= 2,
            quantity: 1,
            isScreenMountable: isRack,
            locationId: cumulativePath,
            status: "active",
          },
        });
        nodeCache.set(cumulativePath, node.id);
        parentId = node.id;
      } catch {
        const found = await prisma.locationNode.findFirst({
          where: { branchId: branch.id, locationId: cumulativePath },
        });
        if (found) {
          nodeCache.set(cumulativePath, found.id);
          parentId = found.id;
        }
      }
    }
  }
  log(`\n✓ ${nodeCache.size} location nodes ready\n`);

  // ── 7. Create Product Copies ───────────────────────────────────────────────
  log("🔖 Creating product copies...");
  let copyCount = 0;
  let skipCount = 0;

  for (let i = 0; i < rows.length; i++) {
    logProgress(i + 1, rows.length, "Copies");
    const r = rows[i];
    const barcode = (r.Barcode || "").trim();
    if (!barcode) { skipCount++; continue; }

    const brandName = (r.Brand || "").trim().toLowerCase();
    const productName = (r.Name || "").trim();
    const locStr = (r.Location || "").trim();

    const brandId = brandMap.get(brandName);
    if (!brandId) { skipCount++; continue; }

    const productKey = `${brandId}_${productName.toLowerCase()}`;
    const productId = productMap.get(productKey);
    if (!productId) { skipCount++; continue; }

    const recordId = recordMap.get(productId.toString());
    if (!recordId) { skipCount++; continue; }

    // Find leaf location node
    let locationNodeId = null;
    if (locStr) {
      const parts = parseLocation(locStr);
      const leafPath = parts.join("/");
      locationNodeId = nodeCache.get(leafPath) || null;
    }

    try {
      await prisma.productCopy.create({
        data: {
          localRecordId: recordId,
          brandProductId: productId,
          branchId: branch.id,
          sequenceNo: 1,
          instanceCode: barcode,
          copyRole: "UNIQUE",
          locationNodeId,
          availability: "IN",
          status: "active",
        },
      });
      copyCount++;
    } catch {
      skipCount++;
    }
  }
  log(`\n✓ ${copyCount} copies created (${skipCount} skipped)\n`);

  // ── 8. Create Screen ──────────────────────────────────────────────────────
  log("🖥️  Creating screen scr-b...");
  let screen = await prisma.screen.findFirst({ where: { token: "scr-b" } });
  if (!screen) {
    screen = await prisma.screen.create({
      data: {
        branchId: branch.id,
        name: "Showroom Screen B",
        token: "scr-b",
        viewDefault: "LOCAL",
        status: "active",
      },
    });
    log(`  Created screen scr-b (id: ${screen.id})`);

    // Link some RACK nodes to screen
    const racks = await prisma.locationNode.findMany({
      where: { branchId: branch.id, nodeType: "RACK", isScreenMountable: true },
      take: 10,
    });
    for (const rack of racks) {
      try {
        await prisma.screenRack.create({
          data: { screenId: screen.id, locationNodeId: rack.id },
        });
      } catch {}
    }
    log(`  Linked ${racks.length} racks to screen\n`);
  } else {
    log(`  Screen scr-b already exists (id: ${screen.id})\n`);
  }

  // ── Final summary ─────────────────────────────────────────────────────────
  log("✨ Import complete!\n");
  log("📊 Final DB Counts:");
  const counts = {
    categories: await prisma.category.count(),
    brands: await prisma.brand.count(),
    products: await prisma.brandProduct.count(),
    locationNodes: await prisma.locationNode.count(),
    productCopies: await prisma.productCopy.count(),
    screens: await prisma.screen.count(),
  };
  for (const [k, v] of Object.entries(counts)) {
    log(`  ${k.padEnd(16)}: ${v}`);
  }
  log("");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("\n❌ Error:", e.message);
    await prisma.$disconnect();
    process.exit(1);
  });

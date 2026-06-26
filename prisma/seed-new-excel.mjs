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
  log("\n🚀 Starting New Product Excel data import...\n");

  // 1. Get branch
  const branch = await prisma.branch.findFirst();
  if (!branch) throw new Error("No branch found.");
  log(`✓ Branch: ${branch.name} (id: ${branch.id})`);

  // 2. Load Excel file
  const xlsxPath = "C:\\Users\\LT13\\Downloads\\Product (product.template) (2).xlsx";
  log(`Loading ${xlsxPath}...`);
  const workbook = XLSX.readFile(xlsxPath);
  
  // Sheet1 contains all combined rows
  const sheet = workbook.Sheets["Sheet1"] || workbook.Sheets[workbook.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json(sheet);
  const rows = rawData.filter(r => r.Name && r.Brand);
  log(`✓ ${rows.length} product rows loaded from Excel\n`);

  // 3. Upsert Categories
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
      const conflict = await prisma.category.findFirst({ where: { code } });
      if (conflict) code = code + "-" + Math.random().toString(36).slice(2, 6);
      const created = await prisma.category.create({
        data: { name: catName, code, parentId: null, status: "active" },
      });
      categoryMap.set(catName.toLowerCase(), created.id);
    }
  }
  log(`✓ ${categoryMap.size} categories ready\n`);

  // 4. Upsert Brands
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

  // 5. Create Import Seller + Program
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

  try {
    await prisma.branchProgram.upsert({
      where: { branchId_programId: { branchId: branch.id, programId: importProgram.id } },
      update: {},
      create: { branchId: branch.id, programId: importProgram.id, approvalStatus: "approved" },
    });
  } catch {}
  log("✓ Seller & program ready\n");

  // 6. Upsert BrandProducts + LocalOnboardingRecords
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
      sku = sku + "-" + Math.random().toString(36).slice(2, 6);
      try {
        product = await prisma.brandProduct.create({
          data: { brandId, name: productName, sku, categoryId: catId, status: "active" },
        });
      } catch { continue; }
    }
    productMap.set(key, product.id);

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

  // 7. Build Location Tree
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

  // 8. Create Product Copies
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

  // 9. Link all RACK nodes to screen scr-b
  log("🖥️  Linking all RACK nodes to screen scr-b...");
  const screen = await prisma.screen.findFirst({ where: { token: "scr-b" } });
  if (screen) {
    const allRacks = await prisma.locationNode.findMany({
      where: { nodeType: "RACK" },
      select: { id: true }
    });
    let linked = 0;
    for (const rack of allRacks) {
      try {
        await prisma.screenRack.create({
          data: { screenId: screen.id, locationNodeId: rack.id }
        });
        linked++;
      } catch {}
    }
    log(`✓ Linked ${linked} racks to screen scr-b\n`);
  }

  log("✨ Import complete!\n");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("\n❌ Error:", e.message);
    await prisma.$disconnect();
    process.exit(1);
  });

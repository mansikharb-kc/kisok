/**
 * KC IMS — Demo seed for KC-Bangalore branch
 * ============================================
 * Creates a complete, realistic data flow showing the full linkage:
 *
 *   Branch (KC-Bangalore)
 *     ├── Programs  → Immersive Hub Program, Catalogue Library Program
 *     ├── Brands    → Kohler, Asian Paints, Jaquar
 *     ├── Warehouse tree
 *     │     ├── Immersive Hub (WAREHOUSE)
 *     │     │     ├── Block A — Bathware Zone (BLOCK, screen-mountable)
 *     │     │     │     ├── Rack A1 — Kohler Display (RACK, placement-eligible)
 *     │     │     │     └── Rack A2 — Jaquar Display  (RACK, placement-eligible)
 *     │     │     └── Block B — Paints Zone (BLOCK, screen-mountable)
 *     │     │           └── Rack B1 — Asian Paints (RACK, placement-eligible)
 *     │     └── Catalogue Library (WAREHOUSE)
 *     │           ├── Tray CL-1 — Kohler eCat Tray (TRAY, placement-eligible)
 *     │           └── Tray CL-2 — Paints Swatch Tray (TRAY, placement-eligible)
 *     ├── Sellers   → Kohler India Ltd, Asian Paints Ltd, Jaquar Group
 *     └── Products  → onboarded under programs, placed in locations
 *
 * Run: npx tsx prisma/seed-demo.ts
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ─── helpers ────────────────────────────────────────────────────────────────

function buildPath(parentPath: string | null, id: bigint): string {
  return parentPath ? `${parentPath}${id}/` : `/${id}/`;
}

function instanceCode(sellerCode: string, branchCode: string, sku: string, seq: number): string {
  return `${sellerCode}-${branchCode}-${sku}-${String(seq).padStart(3, "0")}`;
}

async function upsertUser(
  fullName: string,
  email: string,
  password: string,
  username: string,
) {
  const hash = await bcrypt.hash(password, 10);
  return prisma.user.upsert({
    where: { email },
    update: { username },
    create: { fullName, email, passwordHash: hash, status: "active", username },
  });
}

async function attachRole(userId: bigint, roleCode: string, branchId: bigint | null) {
  const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
  const existing = await prisma.userRole.findFirst({
    where: { userId, roleId: role.id, branchId },
  });
  if (!existing) {
    await prisma.userRole.create({ data: { userId, roleId: role.id, branchId } });
  }
}

async function createNode(
  branchId: bigint,
  parentId: bigint | null,
  parentPath: string | null,
  nodeType: string,
  name: string,
  code: string,
  depth: number,
  isPlacementEligible: boolean,
  isScreenMountable: boolean,
) {
  const node = await prisma.locationNode.create({
    data: {
      branchId,
      parentId,
      nodeType,
      name,
      code,
      depth,
      path: "",
      isPlacementEligible,
      isScreenMountable,
      status: "active",
    },
  });
  const path = buildPath(parentPath, node.id);
  const locationId = isPlacementEligible ? `LOC-${branchId}-${node.id}` : null;
  return prisma.locationNode.update({ where: { id: node.id }, data: { path, locationId } });
}

// ─── main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🌱  KC-Bangalore demo seed starting…\n");

  // ── 1. Branch ──────────────────────────────────────────────────────────────
  const branch = await prisma.branch.upsert({
    where: { branchCode: "KC-BLR" },
    update: {},
    create: {
      name: "KC Bangalore",
      branchCode: "KC-BLR",
      city: "Bangalore",
      address: "No. 12, Lavelle Road, Ashok Nagar, Bangalore – 560001",
      status: "active",
    },
  });
  console.log(`✓ Branch: ${branch.name} (${branch.branchCode})`);

  // ── 2. Users ───────────────────────────────────────────────────────────────
  const branchAdmin = await upsertUser("Aman Sharma", "aman@gmail.com", "1234", "aman");
  const onbLead     = await upsertUser("Pihu Nair", "pihu@gmail.com", "1234", "pihu");
  const obExec1     = await upsertUser("Arihant Verma", "arihant@gmail.com", "1234", "arihant");
  const obExec2     = await upsertUser("Sneha Rao", "sneha@kc.local", "Exec@1234", "sneha");
  const csgnUser    = await upsertUser("Navri Patel", "navri@gmail.com", "1234", "navri");

  await attachRole(branchAdmin.id, "BRANCH_ADMIN", branch.id);
  await attachRole(onbLead.id,     "ONB_LEAD",     branch.id);
  await attachRole(obExec1.id,     "OB_EXEC",      branch.id);
  await attachRole(obExec2.id,     "OB_EXEC",      branch.id);
  await attachRole(csgnUser.id,    "CONSIGNMENT_USER", branch.id);

  console.log(`✓ Users: ${[branchAdmin, onbLead, obExec1, obExec2, csgnUser].map(u => u.fullName).join(", ")}`);

  // ── 3. HO Masters — Categories ────────────────────────────────────────────
  const catBathware = await prisma.category.upsert({
    where: { code: "bathware" },
    update: {},
    create: { name: "Bathware", code: "bathware", status: "active" },
  });
  const catFaucets = await prisma.category.upsert({
    where: { code: "faucets" },
    update: {},
    create: { name: "Faucets & Showers", code: "faucets", parentId: catBathware.id, status: "active" },
  });
  const catSanitaryware = await prisma.category.upsert({
    where: { code: "sanitaryware" },
    update: {},
    create: { name: "Sanitaryware", code: "sanitaryware", parentId: catBathware.id, status: "active" },
  });
  const catPaints = await prisma.category.upsert({
    where: { code: "paints" },
    update: {},
    create: { name: "Paints & Finishes", code: "paints", status: "active" },
  });
  const catWallPaints = await prisma.category.upsert({
    where: { code: "wall-paints" },
    update: {},
    create: { name: "Wall Paints", code: "wall-paints", parentId: catPaints.id, status: "active" },
  });
  console.log(`✓ Categories: Bathware → Faucets, Sanitaryware | Paints → Wall Paints`);

  // ── 4. HO Masters — Attributes ────────────────────────────────────────────
  const attrFinish = await prisma.attribute.upsert({
    where: { code: "finish" },
    update: {},
    create: { name: "Finish", code: "finish", dataType: "enum", sectionGroup: "Aesthetics", isVariant: true, status: "active" },
  });
  // Enum options
  for (const v of ["Chrome", "Brushed Nickel", "Matte Black", "Gold PVD"]) {
    await prisma.attributeOption.upsert({
      where: { attributeId_optionValue: { attributeId: attrFinish.id, optionValue: v } },
      update: {},
      create: { attributeId: attrFinish.id, optionValue: v },
    });
  }

  const attrMaterial = await prisma.attribute.upsert({
    where: { code: "material" },
    update: {},
    create: { name: "Material", code: "material", dataType: "text", sectionGroup: "Technical", isRequired: true, status: "active" },
  });

  const attrSheen = await prisma.attribute.upsert({
    where: { code: "sheen-level" },
    update: {},
    create: { name: "Sheen Level", code: "sheen-level", dataType: "enum", sectionGroup: "Aesthetics", status: "active" },
  });
  for (const v of ["Matte", "Eggshell", "Satin", "Semi-Gloss", "Gloss"]) {
    await prisma.attributeOption.upsert({
      where: { attributeId_optionValue: { attributeId: attrSheen.id, optionValue: v } },
      update: {},
      create: { attributeId: attrSheen.id, optionValue: v },
    });
  }

  const attrTenure = await prisma.attribute.upsert({
    where: { code: "collab-tenure" },
    update: {},
    create: { name: "Collaboration Tenure", code: "collab-tenure", dataType: "text", sectionGroup: "Contract", status: "active" },
  });

  const attrDisplayZone = await prisma.attribute.upsert({
    where: { code: "display-zone" },
    update: {},
    create: { name: "Display Zone", code: "display-zone", dataType: "text", sectionGroup: "Placement", status: "active" },
  });

  console.log(`✓ Attributes: Finish, Material, Sheen Level, Collaboration Tenure, Display Zone`);

  // ── 5. Category ↔ Attribute bindings ─────────────────────────────────────
  const catAttrPairs: [bigint, bigint, number][] = [
    [catFaucets.id, attrFinish.id, 1],
    [catFaucets.id, attrMaterial.id, 2],
    [catSanitaryware.id, attrFinish.id, 1],
    [catSanitaryware.id, attrMaterial.id, 2],
    [catWallPaints.id, attrSheen.id, 1],
  ];
  for (const [categoryId, attributeId, displayOrder] of catAttrPairs) {
    await prisma.categoryAttribute.upsert({
      where: { categoryId_attributeId: { categoryId, attributeId } },
      update: {},
      create: { categoryId, attributeId, displayOrder },
    });
  }
  console.log(`✓ Category-Attribute bindings created`);

  // ── 6. HO Masters — Brands ────────────────────────────────────────────────
  const brandKohler = await prisma.brand.upsert({
    where: { code: "kohler" },
    update: {},
    create: {
      name: "Kohler", code: "kohler", brandNo: "BR-001",
      brandType: "Premium", contactPerson: "Arun Mehta",
      city: "Mumbai", state: "Maharashtra",
      approvalStatus: "approved", status: "active",
    },
  });
  const brandAsianPaints = await prisma.brand.upsert({
    where: { code: "asian-paints" },
    update: {},
    create: {
      name: "Asian Paints", code: "asian-paints", brandNo: "BR-002",
      brandType: "Mass Premium", contactPerson: "Sunita Reddy",
      city: "Mumbai", state: "Maharashtra",
      approvalStatus: "approved", status: "active",
    },
  });
  const brandJaquar = await prisma.brand.upsert({
    where: { code: "jaquar" },
    update: {},
    create: {
      name: "Jaquar", code: "jaquar", brandNo: "BR-003",
      brandType: "Premium", contactPerson: "Vijay Singh",
      city: "Delhi", state: "Delhi",
      approvalStatus: "approved", status: "active",
    },
  });
  console.log(`✓ Brands: Kohler, Asian Paints, Jaquar`);

  // Brand ↔ Category
  const brandCatPairs: [bigint, bigint][] = [
    [brandKohler.id, catBathware.id],
    [brandKohler.id, catFaucets.id],
    [brandKohler.id, catSanitaryware.id],
    [brandAsianPaints.id, catPaints.id],
    [brandAsianPaints.id, catWallPaints.id],
    [brandJaquar.id, catBathware.id],
    [brandJaquar.id, catFaucets.id],
  ];
  for (const [brandId, categoryId] of brandCatPairs) {
    await prisma.brandCategory.upsert({
      where: { brandId_categoryId: { brandId, categoryId } },
      update: {},
      create: { brandId, categoryId },
    });
  }

  // ── 7. HO Masters — Programs ──────────────────────────────────────────────
  /**
   * Immersive Hub Program — for brands that have a physical display zone
   * (hands-on experience, full product display with digital screens)
   */
  const progImmersive = await prisma.program.upsert({
    where: { code: "immersive-hub" },
    update: {},
    create: { name: "Immersive Hub", code: "immersive-hub", status: "active" },
  });

  /**
   * Catalogue Library Program — brand supplies catalogues/swatches for
   * customers to browse (no live display, catalogue-only zone)
   */
  const progCatalogue = await prisma.program.upsert({
    where: { code: "catalogue-library" },
    update: {},
    create: { name: "Catalogue Library", code: "catalogue-library", status: "active" },
  });

  // Bind definition attributes (contract terms) to programs
  for (const [programId, attributeId] of [
    [progImmersive.id, attrTenure.id] as [bigint, bigint],
    [progCatalogue.id, attrTenure.id] as [bigint, bigint],
  ]) {
    await prisma.programDefinitionAttribute.upsert({
      where: { programId_attributeId: { programId, attributeId } },
      update: {},
      create: { programId, attributeId },
    });
  }

  // Bind common attributes (shared product fields) to programs
  for (const [programId, attributeId] of [
    [progImmersive.id, attrDisplayZone.id] as [bigint, bigint],
    [progCatalogue.id, attrDisplayZone.id] as [bigint, bigint],
  ]) {
    await prisma.programCommonAttribute.upsert({
      where: { programId_attributeId: { programId, attributeId } },
      update: {},
      create: { programId, attributeId },
    });
  }

  console.log(`✓ Programs: Immersive Hub, Catalogue Library (with attribute bindings)`);

  // ── 8. Branch config — link programs & brands to branch ───────────────────
  for (const programId of [progImmersive.id, progCatalogue.id]) {
    await prisma.branchProgram.upsert({
      where: { branchId_programId: { branchId: branch.id, programId } },
      update: {},
      create: { branchId: branch.id, programId, approvalStatus: "approved" },
    });
  }
  for (const brandId of [brandKohler.id, brandAsianPaints.id, brandJaquar.id]) {
    await prisma.branchBrand.upsert({
      where: { branchId_brandId: { branchId: branch.id, brandId } },
      update: {},
      create: { branchId: branch.id, brandId },
    });
  }
  console.log(`✓ Branch programs (approved) & brands linked to KC-Bangalore`);

  // ── 9. Sample sizes ───────────────────────────────────────────────────────
  const sizeA3 = await prisma.sampleSize.upsert({
    where: { branchId_label: { branchId: branch.id, label: "A3" } },
    update: {},
    create: { branchId: branch.id, label: "A3", dimensions: "297×420mm" },
  });
  const sizeA4 = await prisma.sampleSize.upsert({
    where: { branchId_label: { branchId: branch.id, label: "A4" } },
    update: {},
    create: { branchId: branch.id, label: "A4", dimensions: "210×297mm" },
  });
  const sizeFullUnit = await prisma.sampleSize.upsert({
    where: { branchId_label: { branchId: branch.id, label: "Full Unit" } },
    update: {},
    create: { branchId: branch.id, label: "Full Unit", dimensions: "As per product spec" },
  });
  console.log(`✓ Sample sizes: A3, A4, Full Unit`);

  // ── 10. Warehouse & Location tree ─────────────────────────────────────────
  /**
   * KC-Bangalore has two warehouses:
   *  • Immersive Hub  — live display zone (Blocks → Racks)
   *  • Catalogue Library — swatch/catalogue zone (Trays)
   */

  // -- Immersive Hub warehouse --
  const wh1 = await createNode(branch.id, null, null, "WAREHOUSE", "Immersive Hub", "WH-IH", 0, false, false);

  const blkA = await createNode(branch.id, wh1.id, wh1.path, "BLOCK", "Block A – Bathware Zone", "BLK-A", 1, false, true);
  const rackA1 = await createNode(branch.id, blkA.id, blkA.path, "RACK",  "Rack A1 – Kohler Display", "RCK-A1", 2, true, false);
  const rackA2 = await createNode(branch.id, blkA.id, blkA.path, "RACK",  "Rack A2 – Jaquar Display",  "RCK-A2", 2, true, false);

  const blkB = await createNode(branch.id, wh1.id, wh1.path, "BLOCK", "Block B – Paints Zone", "BLK-B", 1, false, true);
  const rackB1 = await createNode(branch.id, blkB.id, blkB.path, "RACK",  "Rack B1 – Asian Paints",    "RCK-B1", 2, true, false);

  // -- Catalogue Library warehouse --
  const wh2 = await createNode(branch.id, null, null, "WAREHOUSE", "Catalogue Library", "WH-CL", 0, false, false);
  const trayCL1 = await createNode(branch.id, wh2.id, wh2.path, "TRAY", "Tray CL-1 – Kohler eCat",      "TRY-CL1", 1, true, false);
  const trayCL2 = await createNode(branch.id, wh2.id, wh2.path, "TRAY", "Tray CL-2 – Paints Swatches",  "TRY-CL2", 1, true, false);

  console.log(`✓ Location tree:`);
  console.log(`    🏭 Immersive Hub`);
  console.log(`       🗂️  Block A – Bathware Zone  [🖥️ screen-mountable]`);
  console.log(`           📦 Rack A1 – Kohler Display  [📍 ${rackA1.locationId}]`);
  console.log(`           📦 Rack A2 – Jaquar Display  [📍 ${rackA2.locationId}]`);
  console.log(`       🗂️  Block B – Paints Zone     [🖥️ screen-mountable]`);
  console.log(`           📦 Rack B1 – Asian Paints    [📍 ${rackB1.locationId}]`);
  console.log(`    🏭 Catalogue Library`);
  console.log(`       🗃️  Tray CL-1 – Kohler eCat      [📍 ${trayCL1.locationId}]`);
  console.log(`       🗃️  Tray CL-2 – Paints Swatches  [📍 ${trayCL2.locationId}]`);

  // ── 11. Sellers ───────────────────────────────────────────────────────────
  const sellerKohler = await prisma.seller.upsert({
    where: { sellerCode: "SLR-KOH-BLR" },
    update: {},
    create: {
      branchId: branch.id, name: "Kohler India Ltd",
      sellerCode: "SLR-KOH-BLR", membershipId: "MEM-1001", status: "active",
    },
  });
  const sellerAP = await prisma.seller.upsert({
    where: { sellerCode: "SLR-AP-BLR" },
    update: {},
    create: {
      branchId: branch.id, name: "Asian Paints Ltd",
      sellerCode: "SLR-AP-BLR", membershipId: "MEM-1002", status: "active",
    },
  });
  const sellerJaquar = await prisma.seller.upsert({
    where: { sellerCode: "SLR-JAQ-BLR" },
    update: {},
    create: {
      branchId: branch.id, name: "Jaquar Group",
      sellerCode: "SLR-JAQ-BLR", membershipId: "MEM-1003", status: "active",
    },
  });
  console.log(`✓ Sellers: Kohler India Ltd, Asian Paints Ltd, Jaquar Group`);

  // Seller ↔ Brand
  await prisma.sellerBrand.upsert({ where: { sellerId_brandId: { sellerId: sellerKohler.id, brandId: brandKohler.id } }, update: {}, create: { sellerId: sellerKohler.id, brandId: brandKohler.id } });
  await prisma.sellerBrand.upsert({ where: { sellerId_brandId: { sellerId: sellerAP.id, brandId: brandAsianPaints.id } }, update: {}, create: { sellerId: sellerAP.id, brandId: brandAsianPaints.id } });
  await prisma.sellerBrand.upsert({ where: { sellerId_brandId: { sellerId: sellerJaquar.id, brandId: brandJaquar.id } }, update: {}, create: { sellerId: sellerJaquar.id, brandId: brandJaquar.id } });

  // Seller assignments → OB Execs
  await prisma.sellerAssignment.upsert({ where: { sellerId_obExecUserId: { sellerId: sellerKohler.id, obExecUserId: obExec1.id } }, update: {}, create: { sellerId: sellerKohler.id, obExecUserId: obExec1.id, assignedBy: onbLead.id } });
  await prisma.sellerAssignment.upsert({ where: { sellerId_obExecUserId: { sellerId: sellerAP.id, obExecUserId: obExec2.id } }, update: {}, create: { sellerId: sellerAP.id, obExecUserId: obExec2.id, assignedBy: onbLead.id } });
  await prisma.sellerAssignment.upsert({ where: { sellerId_obExecUserId: { sellerId: sellerJaquar.id, obExecUserId: obExec1.id } }, update: {}, create: { sellerId: sellerJaquar.id, obExecUserId: obExec1.id, assignedBy: onbLead.id } });

  // Seller contracts
  await prisma.sellerContract.upsert({
    where: { id: (await prisma.sellerContract.findFirst({ where: { sellerId: sellerKohler.id, programId: progImmersive.id } }))?.id ?? BigInt(0) },
    update: {},
    create: { sellerId: sellerKohler.id, programId: progImmersive.id, collaborationTenure: "2 Years", fitoutPeriod: "30 Days", contractStart: new Date("2024-01-01"), contractEnd: new Date("2025-12-31"), verified: true, verifiedBy: onbLead.id },
  });
  await prisma.sellerContract.upsert({
    where: { id: (await prisma.sellerContract.findFirst({ where: { sellerId: sellerAP.id, programId: progCatalogue.id } }))?.id ?? BigInt(0) },
    update: {},
    create: { sellerId: sellerAP.id, programId: progCatalogue.id, collaborationTenure: "1 Year", fitoutPeriod: "15 Days", contractStart: new Date("2024-03-01"), contractEnd: new Date("2025-02-28"), verified: true, verifiedBy: onbLead.id },
  });
  await prisma.sellerContract.upsert({
    where: { id: (await prisma.sellerContract.findFirst({ where: { sellerId: sellerJaquar.id, programId: progImmersive.id } }))?.id ?? BigInt(0) },
    update: {},
    create: { sellerId: sellerJaquar.id, programId: progImmersive.id, collaborationTenure: "2 Years", fitoutPeriod: "30 Days", contractStart: new Date("2024-02-01"), contractEnd: new Date("2026-01-31"), verified: true, verifiedBy: onbLead.id },
  });
  console.log(`✓ Seller → Brand links, OB Exec assignments & contracts created`);

  // ── 12. Brand Products (shared master) ────────────────────────────────────
  const chromeOption = await prisma.attributeOption.findFirst({ where: { attribute: { code: "finish" }, optionValue: "Chrome" } });
  const matteOption  = await prisma.attributeOption.findFirst({ where: { attribute: { code: "finish" }, optionValue: "Matte Black" } });
  const satinOption  = await prisma.attributeOption.findFirst({ where: { attribute: { code: "sheen-level" }, optionValue: "Satin" } });
  const glossOption  = await prisma.attributeOption.findFirst({ where: { attribute: { code: "sheen-level" }, optionValue: "Gloss" } });

  const prodKohlerBathSet = await prisma.brandProduct.upsert({
    where: { brandId_sku: { brandId: brandKohler.id, sku: "K-BATH-001" } },
    update: {},
    create: { brandId: brandKohler.id, sku: "K-BATH-001", name: "Kohler Veil Faucet – Chrome", categoryId: catFaucets.id, status: "active" },
  });
  const prodKohlerShower = await prisma.brandProduct.upsert({
    where: { brandId_sku: { brandId: brandKohler.id, sku: "K-SHW-002" } },
    update: {},
    create: { brandId: brandKohler.id, sku: "K-SHW-002", name: "Kohler Moxie Shower – Matte Black", categoryId: catFaucets.id, status: "active" },
  });
  const prodAPEmulsion = await prisma.brandProduct.upsert({
    where: { brandId_sku: { brandId: brandAsianPaints.id, sku: "AP-EMU-101" } },
    update: {},
    create: { brandId: brandAsianPaints.id, sku: "AP-EMU-101", name: "Royale Luxury Emulsion – Satin White", categoryId: catWallPaints.id, status: "active" },
  });
  const prodAPTexture = await prisma.brandProduct.upsert({
    where: { brandId_sku: { brandId: brandAsianPaints.id, sku: "AP-TXT-102" } },
    update: {},
    create: { brandId: brandAsianPaints.id, sku: "AP-TXT-102", name: "Royale Play Texture – Gloss Finish", categoryId: catWallPaints.id, status: "active" },
  });
  const prodJaquarFaucet = await prisma.brandProduct.upsert({
    where: { brandId_sku: { brandId: brandJaquar.id, sku: "JQ-FCT-201" } },
    update: {},
    create: { brandId: brandJaquar.id, sku: "JQ-FCT-201", name: "Jaquar Solo Basin Mixer – Chrome", categoryId: catFaucets.id, status: "active" },
  });

  // Product attribute values
  const pavData: [bigint, bigint, string | null, bigint | null][] = [
    [prodKohlerBathSet.id, attrMaterial.id, "Brass", null],
    [prodKohlerBathSet.id, attrFinish.id,   null,    chromeOption?.id ?? null],
    [prodKohlerShower.id,  attrMaterial.id, "ABS Plastic + Stainless Steel", null],
    [prodKohlerShower.id,  attrFinish.id,   null,    matteOption?.id ?? null],
    [prodAPEmulsion.id,    attrSheen.id,    null,    satinOption?.id ?? null],
    [prodAPTexture.id,     attrSheen.id,    null,    glossOption?.id ?? null],
    [prodJaquarFaucet.id,  attrMaterial.id, "Brass", null],
    [prodJaquarFaucet.id,  attrFinish.id,   null,    chromeOption?.id ?? null],
  ];
  for (const [brandProductId, attributeId, valueText, optionId] of pavData) {
    await prisma.productAttributeValue.upsert({
      where: { brandProductId_attributeId: { brandProductId, attributeId } },
      update: {},
      create: { brandProductId, attributeId, valueText, optionId },
    });
  }
  console.log(`✓ Brand products: Kohler Veil Faucet, Kohler Moxie Shower, AP Royale Emulsion & Texture, Jaquar Solo`);

  // ── 13. Local Onboarding Records ──────────────────────────────────────────
  /**
   * KEY LINKAGE:
   *   Product + Seller + Branch + Program = LocalOnboardingRecord
   *
   *   Kohler Faucet  → Kohler seller → KC-BLR → Immersive Hub program
   *   Kohler Shower  → Kohler seller → KC-BLR → Catalogue Library program
   *   AP Emulsion    → AP seller     → KC-BLR → Catalogue Library program
   *   AP Texture     → AP seller     → KC-BLR → Immersive Hub program
   *   Jaquar Faucet  → Jaquar seller → KC-BLR → Immersive Hub program
   */
  async function upsertLocalRecord(brandProductId: bigint, sellerId: bigint, programId: bigint) {
    const existing = await prisma.localOnboardingRecord.findFirst({
      where: { brandProductId, sellerId, branchId: branch.id, programId },
    });
    if (existing) return existing;
    return prisma.localOnboardingRecord.create({
      data: { brandProductId, sellerId, branchId: branch.id, programId, status: "active", onboardedBy: obExec1.id },
    });
  }

  const lorKohlerFaucet   = await upsertLocalRecord(prodKohlerBathSet.id, sellerKohler.id, progImmersive.id);
  const lorKohlerShower   = await upsertLocalRecord(prodKohlerShower.id,  sellerKohler.id, progCatalogue.id);
  const lorAPEmulsion     = await upsertLocalRecord(prodAPEmulsion.id,    sellerAP.id,     progCatalogue.id);
  const lorAPTexture      = await upsertLocalRecord(prodAPTexture.id,     sellerAP.id,     progImmersive.id);
  const lorJaquarFaucet   = await upsertLocalRecord(prodJaquarFaucet.id,  sellerJaquar.id, progImmersive.id);

  console.log(`✓ Local onboarding records (product × seller × branch × program) created`);

  // ── 14. Product Copies → placed in location nodes ─────────────────────────
  /**
   * KEY LINKAGE:
   *   LocalOnboardingRecord → ProductCopy → LocationNode
   *
   *   Kohler Faucet (Immersive Hub program)  → Rack A1 (Immersive Hub, Block A)  MASTER
   *   Kohler Shower (Catalogue Library)       → Tray CL-1 (Catalogue Library)    MASTER
   *   AP Emulsion   (Catalogue Library)       → Tray CL-2 (Catalogue Library)    MASTER
   *   AP Texture    (Immersive Hub program)   → Rack B1 (Immersive Hub, Block B)  MASTER
   *   Jaquar Faucet (Immersive Hub program)   → Rack A2 (Immersive Hub, Block A)  MASTER
   *
   *   + extra SLAVE copies for Kohler Faucet (2 physical samples in Immersive Hub)
   */
  async function upsertCopy(
    lorId: bigint, productId: bigint, seq: number, role: "MASTER" | "SLAVE",
    locationNodeId: bigint, sampleSizeId: bigint, sellerCode: string, sku: string,
  ) {
    const code = instanceCode(sellerCode, branch.branchCode, sku, seq);
    const existing = await prisma.productCopy.findFirst({ where: { instanceCode: code } });
    if (existing) return existing;
    return prisma.productCopy.create({
      data: {
        localRecordId: lorId, brandProductId: productId, branchId: branch.id,
        sequenceNo: seq, instanceCode: code, copyRole: role,
        locationNodeId, sampleSizeId, availability: "IN", status: "active",
      },
    });
  }

  // Kohler Faucet → Rack A1 (Immersive Hub) — 1 MASTER + 1 SLAVE
  const cpKF1 = await upsertCopy(lorKohlerFaucet.id, prodKohlerBathSet.id, 1, "MASTER", rackA1.id, sizeFullUnit.id, "SLR-KOH-BLR", "K-BATH-001");
  const cpKF2 = await upsertCopy(lorKohlerFaucet.id, prodKohlerBathSet.id, 2, "SLAVE",  rackA1.id, sizeA3.id,       "SLR-KOH-BLR", "K-BATH-001");

  // Kohler Shower → Tray CL-1 (Catalogue Library)
  const cpKS1 = await upsertCopy(lorKohlerShower.id, prodKohlerShower.id, 1, "MASTER", trayCL1.id, sizeA4.id, "SLR-KOH-BLR", "K-SHW-002");

  // AP Emulsion → Tray CL-2 (Catalogue Library)
  const cpAP1 = await upsertCopy(lorAPEmulsion.id, prodAPEmulsion.id, 1, "MASTER", trayCL2.id, sizeA4.id, "SLR-AP-BLR", "AP-EMU-101");

  // AP Texture → Rack B1 (Immersive Hub)
  const cpAP2 = await upsertCopy(lorAPTexture.id, prodAPTexture.id, 1, "MASTER", rackB1.id, sizeA3.id, "SLR-AP-BLR", "AP-TXT-102");

  // Jaquar Faucet → Rack A2 (Immersive Hub)
  const cpJQ1 = await upsertCopy(lorJaquarFaucet.id, prodJaquarFaucet.id, 1, "MASTER", rackA2.id, sizeFullUnit.id, "SLR-JAQ-BLR", "JQ-FCT-201");

  console.log(`✓ Product copies placed:`);
  console.log(`    ${cpKF1.instanceCode}  → Rack A1 (Immersive Hub) [MASTER]`);
  console.log(`    ${cpKF2.instanceCode}  → Rack A1 (Immersive Hub) [SLAVE]`);
  console.log(`    ${cpKS1.instanceCode}  → Tray CL-1 (Catalogue Library) [MASTER]`);
  console.log(`    ${cpAP1.instanceCode}  → Tray CL-2 (Catalogue Library) [MASTER]`);
  console.log(`    ${cpAP2.instanceCode}  → Rack B1 (Immersive Hub) [MASTER]`);
  console.log(`    ${cpJQ1.instanceCode}  → Rack A2 (Immersive Hub) [MASTER]`);

  // ── 15. Sticker Templates (HO, category-wise) ────────────────────────────
  const defaultElements = {
    brandLogo: true, branchName: true, productName: true, category: true,
    attributes: false, locationId: true, sku: true, qr: true,
  };
  async function upsertStickerTemplate(categoryId: bigint, name: string) {
    const existing = await prisma.stickerTemplate.findFirst({ where: { categoryId, name } });
    if (existing) return existing;
    return prisma.stickerTemplate.create({
      data: { categoryId, name, elements: defaultElements, layout: {}, status: "active" },
    });
  }
  await upsertStickerTemplate(catFaucets.id, "Faucet Label (Standard)");
  await upsertStickerTemplate(catPaints.id, "Paint Swatch Label");
  console.log(`✓ Sticker templates: Faucet Label, Paint Swatch Label`);

  // ── 16. Consignment Tickets (OB Exec ↔ Consignment to-and-fro) ────────────
  async function upsertTicket(
    ticketNo: string,
    data: {
      type: string; status: string; currentRole: string; title: string;
      description?: string; sellerId: bigint; brandId: bigint; localRecordId?: bigint;
      resolution?: string; resolved?: boolean;
      events: { action: string; fromRole?: string; toRole?: string; note?: string; byUserId: bigint }[];
    },
  ) {
    const existing = await prisma.ticket.findFirst({ where: { ticketNo } });
    if (existing) return existing;
    const t = await prisma.ticket.create({
      data: {
        ticketNo, type: data.type, branchId: branch.id, sellerId: data.sellerId,
        brandId: data.brandId, localRecordId: data.localRecordId ?? null,
        title: data.title, description: data.description ?? null,
        status: data.status, currentRole: data.currentRole, raisedBy: obExec1.id,
        resolution: data.resolution ?? null, resolvedAt: data.resolved ? new Date() : null,
      },
    });
    for (const ev of data.events) {
      await prisma.ticketEvent.create({
        data: { ticketId: t.id, action: ev.action, fromRole: ev.fromRole ?? null, toRole: ev.toRole ?? null, note: ev.note ?? null, byUserId: ev.byUserId },
      });
    }
    return t;
  }

  await upsertTicket("TKT-0001", {
    type: "SAMPLE_REQUEST", status: "WITH_CONSIGNMENT", currentRole: "CONSIGNMENT_USER",
    title: "Need Kohler Veil faucet sample", description: "Require 1 sample for Immersive Hub display",
    sellerId: sellerKohler.id, brandId: brandKohler.id, localRecordId: lorKohlerFaucet.id,
    events: [{ action: "raise", fromRole: "OB_EXEC", toRole: "CONSIGNMENT_USER", note: "Require 1 sample for Immersive Hub display", byUserId: obExec1.id }],
  });
  await upsertTicket("TKT-0002", {
    type: "FABRICATION", status: "WITH_EXEC", currentRole: "OB_EXEC",
    title: "AP Texture panel needs cutting to A3", description: "Cut panel to A3 for swatch tray",
    sellerId: sellerAP.id, brandId: brandAsianPaints.id, localRecordId: lorAPTexture.id,
    events: [
      { action: "raise", fromRole: "OB_EXEC", toRole: "CONSIGNMENT_USER", note: "Cut to A3 please", byUserId: obExec1.id },
      { action: "send_to_exec", fromRole: "CONSIGNMENT_USER", toRole: "OB_EXEC", note: "Fabricated to A3, please verify & place", byUserId: csgnUser.id },
    ],
  });
  await upsertTicket("TKT-0003", {
    type: "DAMAGE", status: "RESOLVED", currentRole: "OB_EXEC", resolved: true,
    title: "Jaquar faucet chrome scratched", description: "Surface scratch on received unit",
    resolution: "Replacement received & placed",
    sellerId: sellerJaquar.id, brandId: brandJaquar.id, localRecordId: lorJaquarFaucet.id,
    events: [
      { action: "raise", fromRole: "OB_EXEC", toRole: "CONSIGNMENT_USER", note: "Unit scratched, need replacement", byUserId: obExec1.id },
      { action: "note", note: "Re-ordered from brand SPOC", byUserId: csgnUser.id },
      { action: "resolve", note: "Replacement received & placed", byUserId: csgnUser.id },
    ],
  });
  console.log(`✓ Consignment tickets: TKT-0001 (sample), TKT-0002 (fabrication), TKT-0003 (damage, resolved)`);

  // ── 17. Pending Change Request (Branch Admin → HO approval demo) ──────────
  const existingCr = await prisma.changeRequest.findFirst({
    where: { type: "NEW_CATEGORY", status: "pending", branchId: branch.id },
  });
  if (!existingCr) {
    await prisma.changeRequest.create({
      data: {
        type: "NEW_CATEGORY",
        payload: { name: "Acoustic Panels", code: "acoustic-panels", parentId: null },
        branchId: branch.id, requestedBy: branchAdmin.id, status: "pending",
      },
    });
  }
  console.log(`✓ Pending change request: "Acoustic Panels" (awaiting HO approval)`);

  // ── 18. Summary ───────────────────────────────────────────────────────────
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║            KC-Bangalore Demo Data — COMPLETE                 ║
╠══════════════════════════════════════════════════════════════╣
║  BRANCH         KC Bangalore (KC-BLR)                        ║
║                                                              ║
║  PROGRAMS       Immersive Hub    → live display zone         ║
║                 Catalogue Library → swatch / eCat zone       ║
║                                                              ║
║  WAREHOUSES     Immersive Hub (wh) → Blocks → Racks          ║
║                 Catalogue Library  → Trays                   ║
║                                                              ║
║  FLOW EXAMPLE (Kohler Faucet):                               ║
║    Kohler (brand)                                            ║
║      └─ Kohler India Ltd (seller, MEM-1001)                  ║
║           └─ Contract: Immersive Hub / 2 Years               ║
║                └─ Local Record (KC-BLR × Immersive Hub)      ║
║                     ├─ Copy #1 [MASTER] → Rack A1, Full Unit ║
║                     └─ Copy #2 [SLAVE]  → Rack A1, A3        ║
║                                                              ║
║  USERS          aman@kc.local    → Branch Admin (Admin@123)  ║
║                 priya@kc.local   → Onb Lead   (Onb@1234)     ║
║                 rahul@kc.local   → OB Exec    (Exec@1234)    ║
║                 sneha@kc.local   → OB Exec    (Exec@1234)    ║
║                 dev@kc.local     → Consignment (Csgn@1234)   ║
╚══════════════════════════════════════════════════════════════╝
  `);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

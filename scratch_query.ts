import { prisma } from "./src/lib/prisma";

async function main() {
  console.log("Checking database integrity...");

  // 1. Check ProductAttributeValue -> brandProduct
  const pavs = await prisma.productAttributeValue.findMany({ select: { id: true, brandProductId: true, attributeId: true } });
  const products = await prisma.brandProduct.findMany({ select: { id: true } });
  const productIds = new Set(products.map(p => String(p.id)));
  
  for (const pav of pavs) {
    if (!productIds.has(String(pav.brandProductId))) {
      console.log(`Orphaned ProductAttributeValue -> Product: ID ${String(pav.id)}, product ID ${String(pav.brandProductId)}`);
    }
  }

  // 2. Check ProductCopy -> record, product, branch
  const copies = await prisma.productCopy.findMany({
    select: { id: true, localRecordId: true, brandProductId: true, branchId: true }
  });
  const records = await prisma.localOnboardingRecord.findMany({ select: { id: true } });
  const recordIds = new Set(records.map(r => String(r.id)));
  const branches = await prisma.branch.findMany({ select: { id: true } });
  const branchIds = new Set(branches.map(b => String(b.id)));

  for (const c of copies) {
    if (!recordIds.has(String(c.localRecordId))) {
      console.log(`Orphaned ProductCopy -> LocalOnboardingRecord: ID ${String(c.id)}, record ID ${String(c.localRecordId)}`);
    }
    if (!productIds.has(String(c.brandProductId))) {
      console.log(`Orphaned ProductCopy -> BrandProduct: ID ${String(c.id)}, product ID ${String(c.brandProductId)}`);
    }
    if (!branchIds.has(String(c.branchId))) {
      console.log(`Orphaned ProductCopy -> Branch: ID ${String(c.id)}, branch ID ${String(c.branchId)}`);
    }
  }

  console.log("Integrity check complete.");
}

main().catch(err => {
  console.error(err);
});

import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  console.log("=== DB Row Counts ===");
  console.log("Users:", await db.user.count());
  console.log("Roles:", await db.role.count());
  console.log("Branches:", await db.branch.count());
  console.log("Categories:", await db.category.count());
  console.log("Brands:", await db.brand.count());
  console.log("BrandProducts:", await db.brandProduct.count());
  console.log("ProductCopies:", await db.productCopy.count());
  console.log("LocationNodes:", await db.locationNode.count());
  console.log("Screens:", await db.screen.count());
  console.log("Sellers:", await db.seller.count());
  console.log("Programs:", await db.program.count());
}

main().catch(console.error).finally(() => db.$disconnect());

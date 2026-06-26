const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

const s = (v) => JSON.stringify(v, (_, val) => typeof val === 'bigint' ? val.toString() : val, 2);

async function main() {
  const rackId = 6n;
  const copies = await db.productCopy.findMany({
    where: { locationNodeId: rackId },
    include: {
      product: {
        include: {
          brand: true,
          category: true,
        }
      }
    }
  });
  console.log(`Copies in Rack ${rackId}:`);
  for (const c of copies) {
    console.log(`Copy: ${c.instanceCode}, Product: ${c.product.name}, Brand: ${c.product.brand.name}, Category: ${c.product.category.name} (id: ${c.product.categoryId})`);
  }
}

main().catch(console.error).finally(() => db.$disconnect());

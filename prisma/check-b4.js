const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

const s = (v) => JSON.stringify(v, (_, val) => typeof val === 'bigint' ? val.toString() : val, 2);

async function main() {
  const copies = await db.productCopy.findMany({
    where: { locationNodeId: 9n },
    include: { product: { include: { category: true } } }
  });
  console.log('Copies in Rack B4:');
  console.log(s(copies.map(c => ({
    copyId: c.id,
    sku: c.product?.sku,
    productName: c.product?.name,
    categoryName: c.product?.category?.name
  }))));
}

main().catch(console.error).finally(() => db.$disconnect());

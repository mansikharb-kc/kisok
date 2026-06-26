const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

const s = (v) => JSON.stringify(v, (_, val) => typeof val === 'bigint' ? val.toString() : val, 2);

async function main() {
  const blockB = await db.locationNode.findFirst({ where: { name: { contains: 'Block B' } } });
  console.log('Block B id:', blockB?.id?.toString());
  
  const racks = await db.locationNode.findMany({ where: { parentId: blockB.id } });
  console.log('Racks in Block B:', s(racks.map(r => ({ id: r.id, name: r.name }))));
  
  for (const rack of racks) {
    const copies = await db.productCopy.findMany({
      where: { locationNodeId: rack.id },
      include: { record: true, product: true }
    });
    console.log('Rack', rack.name, 'copies:', s(copies.slice(0, 5)));
  }

  const cats = await db.category.findMany({ select: { id: true, name: true } });
  console.log('Categories:', s(cats));

  // check consignmentItem for products
  const items = await db.consignmentItem.findMany({ 
    select: { id: true, productId: true, product: { select: { id: true, name: true, categoryId: true } } }, 
    take: 10 
  });
  console.log('ConsignmentItems (first 10):', s(items));

  // check localOnboardingRecord for products
  const records = await db.localOnboardingRecord.findMany({
    select: { id: true, name: true, categoryId: true },
    take: 10
  });
  console.log('LocalOnboardingRecords (first 10):', s(records));
}

main().catch(console.error).finally(() => db.$disconnect());

const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  console.log('=== Linking ALL racks to scr-b screen ===');

  const screen = await db.screen.findFirst({ 
    where: { token: 'scr-b' },
    include: { racks: true }
  });

  if (!screen) {
    console.error('Screen scr-b not found!');
    return;
  }

  console.log(`Screen: ${screen.name} (id: ${screen.id})`);
  console.log(`Currently linked racks: ${screen.racks.length}`);

  // Get all RACK type nodes
  const allRacks = await db.locationNode.findMany({
    where: { nodeType: 'RACK' },
    select: { id: true, name: true, locationId: true }
  });

  console.log(`\nTotal RACK nodes in DB: ${allRacks.length}`);

  const existingRackIds = new Set(screen.racks.map(r => r.locationNodeId.toString()));
  const newRacks = allRacks.filter(r => !existingRackIds.has(r.id.toString()));
  console.log(`New racks to link: ${newRacks.length}`);

  let linked = 0;
  let skipped = 0;
  for (const rack of newRacks) {
    try {
      await db.screenRack.create({
        data: { screenId: screen.id, locationNodeId: rack.id }
      });
      linked++;
    } catch {
      skipped++;
    }
  }

  console.log(`\n✓ Linked ${linked} new racks (${skipped} skipped/already linked)`);
  
  const total = await db.screenRack.count({ where: { screenId: screen.id } });
  console.log(`Total racks now linked to scr-b: ${total}`);

  // Check product copies accessible via screen
  const racksLinked = await db.screenRack.findMany({
    where: { screenId: screen.id },
    select: { locationNodeId: true }
  });
  const rackIds = racksLinked.map(r => r.locationNodeId);
  const copies = await db.productCopy.count({
    where: { locationNodeId: { in: rackIds }, status: 'active' }
  });
  console.log(`Product copies accessible via screen: ${copies}`);
}

main().catch(console.error).finally(() => db.$disconnect());

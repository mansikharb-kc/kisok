const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

const s = (v) => JSON.stringify(v, (_, val) => typeof val === 'bigint' ? val.toString() : val, 2);

async function main() {
  console.log('=== Linking Rack B3 and Rack B4 to screen scr-b (id: 2) ===');

  const links = [
    { screenId: 2n, locationNodeId: 8n }, // Rack B3
    { screenId: 2n, locationNodeId: 9n }  // Rack B4
  ];

  for (const link of links) {
    const existing = await db.screenRack.findFirst({
      where: { screenId: link.screenId, locationNodeId: link.locationNodeId }
    });

    if (!existing) {
      const sr = await db.screenRack.create({
        data: link
      });
      console.log(`Linked Rack (id: ${link.locationNodeId}) to screen (id: ${link.screenId}):`, s(sr));
    } else {
      console.log(`Rack (id: ${link.locationNodeId}) already linked to screen (id: ${link.screenId})`);
    }
  }
}

main().catch(console.error).finally(() => db.$disconnect());

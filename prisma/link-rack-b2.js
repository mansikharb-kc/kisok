const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  // Link Rack B2 (id: 7) to screen scr-b (id: 2)
  const existing = await db.screenRack.findFirst({
    where: { screenId: 2n, locationNodeId: 7n }
  });

  if (!existing) {
    const sr = await db.screenRack.create({
      data: { screenId: 2n, locationNodeId: 7n }
    });
    const s = (v) => JSON.stringify(v, (_, val) => typeof val === 'bigint' ? val.toString() : val, 2);
    console.log('Linked Rack B2 to scr-b:', s(sr));
  } else {
    console.log('Rack B2 already linked to scr-b');
  }
}

main().catch(console.error).finally(() => db.$disconnect());

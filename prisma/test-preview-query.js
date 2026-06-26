const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

const s = (v) => JSON.stringify(v, (_, val) => typeof val === 'bigint' ? val.toString() : val, 2);

async function main() {
  const branchId = 1n;
  const screensRaw = await db.screen.findMany({
    where: { branchId },
    include: {
      racks: {
        include: {
          rack: {
            include: {
              copies: {
                where: { status: "active" },
                include: { product: true }
              }
            }
          }
        }
      }
    }
  });

  for (const s of screensRaw) {
    console.log(`Screen: ${s.name}`);
    for (const sr of s.racks) {
      console.log(`  Rack: ${sr.rack.name}, active copies: ${sr.rack.copies.length}`);
    }
  }
}

main().catch(console.error).finally(() => db.$disconnect());

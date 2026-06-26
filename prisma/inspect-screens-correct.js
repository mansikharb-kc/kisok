const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

const s = (v) => JSON.stringify(v, (_, val) => typeof val === 'bigint' ? val.toString() : val, 2);

async function main() {
  const screens = await db.screen.findMany({
    include: {
      location: true,
      racks: {
        include: {
          rack: true
        }
      }
    }
  });
  console.log('Screens with racks:', s(screens));
}

main().catch(console.error).finally(() => db.$disconnect());

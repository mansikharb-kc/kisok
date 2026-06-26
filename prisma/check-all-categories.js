const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

const s = (v) => JSON.stringify(v, (_, val) => typeof val === 'bigint' ? val.toString() : val, 2);

async function main() {
  const cats = await db.category.findMany();
  console.log('All categories:', s(cats));
}

main().catch(console.error).finally(() => db.$disconnect());

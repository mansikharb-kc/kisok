import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  try {
    await prisma.$executeRawUnsafe('CREATE INDEX seller_assignments_seller_id_idx ON seller_assignments(seller_id)');
    console.log('Created missing index');
  } catch (e) {
    console.error('Index might already exist:', e instanceof Error ? e.message : e);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());

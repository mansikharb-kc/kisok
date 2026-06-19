const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const branches = await prisma.branch.findMany({
    include: { branchCategories: true },
    orderBy: { id: 'desc' },
    take: 5
  });
  console.dir(branches, { depth: null });
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());

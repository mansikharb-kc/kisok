const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const categories = await prisma.category.findMany({
    where: {
      OR: [
        { name: { contains: 'Faucet' } },
        { name: { contains: 'Sanitaryware' } },
        { name: { contains: 'Paint' } },
        { name: { contains: 'Bath' } }
      ]
    }
  });
  
  for (const c of categories) {
    console.log(`ID: ${c.id}, Name: ${c.name}, Code: ${c.code}`);
  }
}

main().then(() => prisma.$disconnect());

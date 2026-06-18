const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const matches = await prisma.category.findMany({
    where: {
      OR: [
        { code: { contains: 'faucet' } },
        { code: { contains: 'sanitary' } },
        { code: { contains: 'paint' } },
        { code: { contains: 'bath' } }
      ]
    }
  });
  
  for (const m of matches) {
    console.log(`ID: ${m.id}, Name: ${m.name}, Code: ${m.code}`);
  }
}

main().then(() => prisma.$disconnect());

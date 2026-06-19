const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cat = await prisma.category.findFirst({ where: { status: 'active' } });
  if (!cat) {
    console.log("No category found");
    return;
  }

  const res = await fetch('http://localhost:3000/api/branches', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': 'next-auth.session-token=your-token-here' // We might not need this if we bypass auth or just do it via Prisma directly
    },
    body: JSON.stringify({
      name: "Test Branch " + Date.now(),
      branchCode: "tb-" + Date.now(),
      status: "active",
      categoryIds: [String(cat.id)]
    })
  });
  
  // Since we don't have the auth cookie, I'll just use Prisma directly to simulate what the API does.
  const branch = await prisma.branch.create({
    data: {
      name: "Prisma Test Branch",
      branchCode: "ptb-" + Date.now(),
      status: "active",
      branchCategories: {
        create: [{ categoryId: cat.id }]
      }
    },
    include: { branchCategories: true }
  });

  console.log("Created Branch with Categories:");
  console.dir(branch, { depth: null });
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());

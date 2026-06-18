const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      roles: {
        include: {
          role: true,
          branch: true
        }
      }
    }
  });
  
  console.log('--- ALL USERS ---');
  for (const u of users) {
    console.log(`ID: ${u.id}, Name: ${u.fullName}, Email: ${u.email}, Username: ${u.username}, Status: ${u.status}`);
    console.log('Roles:', u.roles.map(r => `${r.role.code} (${r.branch ? r.branch.name : 'Global'})`).join(', '));
    console.log('-----------------');
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

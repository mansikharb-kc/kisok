const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const PASSWORDS = {
  'admin@kc.local': 'Admin@123',
  'aman@gmail.com': '1234',
  'pihu@gmail.com': '1234',
  'arihant@gmail.com': '1234',
  'sneha@kc.local': 'Exec@1234',
  'navri@gmail.com': '1234'
};

async function main() {
  console.log('Resetting user passwords...');
  for (const [email, password] of Object.entries(PASSWORDS)) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const hash = await bcrypt.hash(password, 10);
      await prisma.user.update({
        where: { email },
        data: { passwordHash: hash }
      });
      console.log(`✓ Reset password for ${email} to "${password}"`);
    } else {
      console.log(`x User ${email} not found in database`);
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

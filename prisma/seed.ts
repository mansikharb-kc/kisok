// Seeds ONLY system-level data:
//   * the 5 Phase-1 roles (RBAC needs these to exist)
//   * one first HO Admin user so you can log in
// No categories / attributes / brands / branches are seeded — you add those
// from the dashboard.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ROLES = [
  { code: "HO_ADMIN", name: "KC HO Admin", description: "L1 — global master setup + approvals" },
  { code: "BRANCH_ADMIN", name: "KC Branch Admin", description: "L2 — warehouse/location + program config" },
  { code: "ONB_LEAD", name: "Onboarding Lead", description: "L3 — sellers, membership, assignment" },
  { code: "CONSIGNMENT_USER", name: "Consignment User", description: "L3 — receive, buffer, fabricate, QC" },
  { code: "OB_EXEC", name: "Onboarding Exec", description: "L3 — product onboarding & placement" },
];

async function main() {
  // Roles (idempotent)
  for (const r of ROLES) {
    await prisma.role.upsert({
      where: { code: r.code },
      update: { name: r.name, description: r.description },
      create: r,
    });
  }
  console.log(`✓ ${ROLES.length} roles ready`);

  // First HO Admin
  const email = process.env.SEED_ADMIN_EMAIL || "admin@kc.local";
  const password = process.env.SEED_ADMIN_PASSWORD || "Admin@123";
  const name = process.env.SEED_ADMIN_NAME || "KC HO Admin";

  const hoRole = await prisma.role.findUniqueOrThrow({ where: { code: "HO_ADMIN" } });
  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { fullName: name, email, passwordHash, status: "active" },
  });

  // Attach global HO_ADMIN role (branchId null = global)
  const existing = await prisma.userRole.findFirst({
    where: { userId: admin.id, roleId: hoRole.id, branchId: null },
  });
  if (!existing) {
    await prisma.userRole.create({
      data: { userId: admin.id, roleId: hoRole.id },
    });
  }

  console.log(`✓ HO Admin ready → ${email} / ${password}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

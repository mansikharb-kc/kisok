import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, handler } from "@/lib/api";

export const GET = handler(async () => {
  await requireRole("HO_ADMIN", "BRANCH_ADMIN");

  const roles = await prisma.role.findMany({
    orderBy: { name: "asc" },
  });

  return ok({ roles });
});

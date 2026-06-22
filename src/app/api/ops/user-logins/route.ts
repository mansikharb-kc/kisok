import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";
import { ok, fail, handler } from "@/lib/api";

// Dynamic GET endpoint to fetch user session logs
export const GET = handler(async () => {
  const session = await getSession();
  if (!session) return fail("Unauthorized", 401);
  if (!hasRole(session.roles, "ONB_LEAD")) return fail("Forbidden", 403);

  const roleEntry = session.roles.find((r) => r.code === "ONB_LEAD" && r.branchId);
  const branchId = roleEntry?.branchId ? BigInt(roleEntry.branchId) : null;
  if (!branchId) return fail("Branch ID required", 400);

  const targetRoles = ["OB_EXEC", "CONSIGNMENT_USER", "CONCIERGE_MANAGER", "PROJECT_USER"];
  const allowedUserRoles = await prisma.userRole.findMany({
    where: {
      branchId: branchId,
      role: {
        code: {
          in: targetRoles,
        },
      },
    },
    select: {
      userId: true,
    },
  });
  const allowedUserIds = allowedUserRoles.map((ur) => ur.userId);

  const logs = await prisma.userSessionLog.findMany({
    where: {
      userId: { in: allowedUserIds },
      role: { in: targetRoles },
    },
    orderBy: {
      loginTime: "desc",
    },
  });

  return ok({ logs: serialize(logs) });
});

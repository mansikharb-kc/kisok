import { getSession } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import type { RoleCode } from "@/lib/rbac";

export const POST = handler(async (req: Request) => {
  const session = await getSession();
  if (!session) return fail("Unauthorized", 401);
  if (!session.sessionLogId) return ok({ ok: true });

  const body = await req.json().catch(() => null);
  const path = body?.path || "";

  let activeRole: string | undefined = undefined;

  if (path.startsWith("/ops/onboarding") || path.startsWith("/ops/placement")) {
    activeRole = "OB_EXEC";
  } else if (path.startsWith("/ops/consignments")) {
    const userRoleCodes = session.roles.map((r) => r.code);
    if (userRoleCodes.includes("CONSIGNMENT_USER")) {
      activeRole = "CONSIGNMENT_USER";
    } else if (userRoleCodes.includes("OB_EXEC")) {
      activeRole = "OB_EXEC";
    }
  } else if (
    path.startsWith("/ops/sellers") ||
    path.startsWith("/ops/assignments") ||
    path.startsWith("/ops/sample-sizes") ||
    path.startsWith("/ops/user-logins") ||
    path.startsWith("/ops/activity")
  ) {
    const userRoleCodes = session.roles.map((r) => r.code);
    if (
      (path.startsWith("/ops/user-logins") || path.startsWith("/ops/activity")) &&
      userRoleCodes.includes("BRANCH_ADMIN")
    ) {
      activeRole = "BRANCH_ADMIN";
    } else {
      activeRole = "ONB_LEAD";
    }
  } else if (path.startsWith("/ops/tickets")) {
    const userRoleCodes = session.roles.map((r) => r.code);
    if (userRoleCodes.includes("CONCIERGE_MANAGER")) {
      activeRole = "CONCIERGE_MANAGER";
    } else if (userRoleCodes.includes("PROJECT_USER")) {
      activeRole = "PROJECT_USER";
    }
  } else if (path.startsWith("/masters/categories") || path.startsWith("/ops/flags")) {
    const targetRoles: RoleCode[] = ["ONB_LEAD", "OB_EXEC", "CONSIGNMENT_USER", "PROJECT_USER", "CONCIERGE_MANAGER"];
    const userRoleCodes = session.roles.map((r) => r.code);
    activeRole = userRoleCodes.find((rc) => targetRoles.includes(rc));
  }

  const updateData: { lastActive: Date; role?: string } = {
    lastActive: new Date(),
  };
  if (activeRole) {
    updateData.role = activeRole;
  }

  try {
    await prisma.userSessionLog.update({
      where: { id: BigInt(session.sessionLogId) },
      data: updateData,
    });
  } catch (e) {
    console.error("Failed to ping session:", e);
  }

  return ok({ ok: true });
});

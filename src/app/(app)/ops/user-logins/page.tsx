import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";
import UserLoginsClient from "@/components/ops/UserLoginsClient";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasRole(session.roles, "ONB_LEAD")) redirect("/dashboard");

  const roleEntry = session.roles.find((r) => r.code === "ONB_LEAD" && r.branchId);
  const branchId = roleEntry?.branchId ? BigInt(roleEntry.branchId) : null;
  if (!branchId) redirect("/dashboard");

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

  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { name: true },
  });

  const serializedLogs = serialize(logs) as any[];

  return (
    <UserLoginsClient
      initialLogs={serializedLogs}
      branchName={branch?.name ?? "Managed Branch"}
    />
  );
}

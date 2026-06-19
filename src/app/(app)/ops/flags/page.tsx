import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";
import FlagsClient from "@/components/ops/FlagsClient";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login");

  const allowedRoles = ["HO_ADMIN", "BRANCH_ADMIN", "ONB_LEAD", "OB_EXEC"];
  if (!hasRole(session.roles, ...allowedRoles as any)) redirect("/dashboard");

  const isHo = hasRole(session.roles, "HO_ADMIN");
  const branchRole = session.roles.find((r) => r.branchId);
  const branchId = branchRole?.branchId ? BigInt(branchRole.branchId) : null;

  const where: any = {};
  if (!isHo) {
    if (!branchId) redirect("/dashboard");
    where.pipeline = {
      assignment: {
        seller: {
          branchId,
        },
      },
    };
  }

  const flags = await prisma.flag.findMany({
    where,
    include: {
      pipeline: {
        include: {
          brand: {
            select: { name: true, code: true },
          },
          assignment: {
            include: {
              seller: {
                select: { name: true, sellerCode: true },
              },
              program: {
                select: { name: true },
              },
              exec: {
                select: { fullName: true, email: true },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const serializedFlags = serialize(flags) as any[];

  return (
    <FlagsClient
      initialFlags={serializedFlags}
      isHo={isHo}
      branchName={isHo ? "Global HO" : undefined}
    />
  );
}

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";
import AssignmentForm from "./AssignmentForm";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasRole(session.roles, "ONB_LEAD")) redirect("/dashboard");

  const roleEntry = session.roles.find((r) => r.code === "ONB_LEAD" && r.branchId);
  const branchId = roleEntry?.branchId ? BigInt(roleEntry.branchId) : null;
  if (!branchId) redirect("/dashboard");

  // Fetch active sellers and active OB Exec users for the branch
  const [sellers, execs] = await Promise.all([
    prisma.seller.findMany({
      where: { branchId, status: "active" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sellerCode: true },
    }),
    prisma.user.findMany({
      where: {
        status: "active",
        roles: {
          some: {
            branchId,
            role: { code: "OB_EXEC" },
          },
        },
      },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, email: true },
    }),
  ]);

  const serializedSellers = serialize(sellers);
  const serializedExecs = serialize(execs);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <AssignmentForm sellers={serializedSellers} execs={serializedExecs} />
    </div>
  );
}

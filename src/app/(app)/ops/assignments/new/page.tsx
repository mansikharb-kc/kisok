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

  // Fetch active sellers (with their contracted programs) and active OB Exec users for the branch
  const [sellers, execs] = await Promise.all([
    prisma.seller.findMany({
      where: { branchId, status: "active" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        sellerCode: true,
        contracts: {
          select: {
            programId: true,
            program: { select: { name: true, code: true } },
          },
        },
      },
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

  // Reduce each seller's contracts to a de-duplicated list of contracted programs.
  const sellerOptions = sellers.map((s) => {
    const seen = new Set<string>();
    const programs: { id: string; name: string; code: string }[] = [];
    for (const c of s.contracts) {
      const pid = c.programId.toString();
      if (seen.has(pid)) continue;
      seen.add(pid);
      programs.push({ id: pid, name: c.program.name, code: c.program.code });
    }
    return { id: s.id, name: s.name, sellerCode: s.sellerCode, programs };
  });

  const serializedSellers = serialize(sellerOptions);
  const serializedExecs = serialize(execs);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <AssignmentForm sellers={serializedSellers} execs={serializedExecs} />
    </div>
  );
}

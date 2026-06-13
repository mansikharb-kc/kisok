import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";
import WarehouseTree, { LocationNode } from "@/components/warehouse/WarehouseTree";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Allow HO_ADMIN to view any branch; BRANCH_ADMIN sees their own branch
  const isHo = hasRole(session.roles, "HO_ADMIN");
  const isBranchAdmin = hasRole(session.roles, "BRANCH_ADMIN");

  if (!isHo && !isBranchAdmin) redirect("/dashboard");

  // Determine which branch to show
  let branchId: bigint | null = null;

  if (isBranchAdmin) {
    const branchRole = session.roles.find((r) => r.code === "BRANCH_ADMIN" && r.branchId);
    branchId = branchRole?.branchId ? BigInt(branchRole.branchId) : null;
  }

  if (!branchId) {
    // HO admin with no branch selected — show a picker (or first branch)
    const first = await prisma.branch.findFirst({ where: { status: "active" }, orderBy: { name: "asc" } });
    branchId = first?.id ?? null;
  }

  if (!branchId) {
    return (
      <div className="text-center py-20 text-slate-500">
        No active branch found. Please create a branch first from HO Masters → Branches.
      </div>
    );
  }

  const branch = await prisma.branch.findUnique({ where: { id: branchId } });

  const rows = await prisma.locationNode.findMany({
    where: { branchId },
    orderBy: [{ path: "asc" }, { name: "asc" }],
    select: {
      id: true,
      parentId: true,
      nodeType: true,
      name: true,
      code: true,
      path: true,
      depth: true,
      isPlacementEligible: true,
      isScreenMountable: true,
      locationId: true,
      status: true,
      _count: { select: { children: true, copies: true } },
    },
  });

  const nodes: LocationNode[] = serialize(rows);

  return (
    <div className="space-y-2">
      {branch && (
        <p className="text-xs text-slate-400 font-mono">
          Branch: <span className="font-semibold text-slate-600">{branch.name}</span> · {branch.branchCode}
        </p>
      )}
      <WarehouseTree branchId={String(branchId)} initial={nodes} />
    </div>
  );
}

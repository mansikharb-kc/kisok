import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";
import WarehouseTree, { LocationNode } from "@/components/warehouse/WarehouseTree";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login");

  const isHo = hasRole(session.roles, "HO_ADMIN");
  const isBranchAdmin = hasRole(session.roles, "BRANCH_ADMIN");
  if (!isHo && !isBranchAdmin) redirect("/dashboard");

  let branchId: bigint | null = null;
  if (isBranchAdmin) {
    const branchRole = session.roles.find((r) => r.code === "BRANCH_ADMIN" && r.branchId);
    branchId = branchRole?.branchId ? BigInt(branchRole.branchId) : null;
  }
  if (!branchId) {
    const first = await prisma.branch.findFirst({ where: { status: "active" }, orderBy: { name: "asc" } });
    branchId = first?.id ?? null;
  }
  if (!branchId) {
    return (
      <div className="text-center py-20 text-slate-500">
        No active branch found. Please create a branch from HO Masters → Branches.
      </div>
    );
  }

  const [branch, nodeRows, categoryRows] = await Promise.all([
    prisma.branch.findUnique({ where: { id: branchId } }),

    prisma.locationNode.findMany({
      where: { branchId },
      orderBy: [{ path: "asc" }, { name: "asc" }],
      select: {
        id: true,
        parentId: true,
        nodeType: true,
        name: true,
        code: true,
        categoryId: true,
        path: true,
        depth: true,
        isPlacementEligible: true,
        isScreenMountable: true,
        locationId: true,
        status: true,
        category: { select: { id: true, name: true, code: true } },
        _count: { select: { children: true, copies: true } },
      },
    }),

    // All active categories from HO masters — for the category picker in the modal
    prisma.category.findMany({
      where: { status: "active" },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, code: true, parentId: true },
    }),
  ]);

  const nodes: LocationNode[] = serialize(nodeRows) as any;
  const categories = serialize(categoryRows) as any;

  return (
    <div className="space-y-2">
      {branch && (
        <p className="text-xs text-slate-400 font-mono">
          Branch: <span className="font-semibold text-slate-600">{branch.name}</span> · {branch.branchCode}
        </p>
      )}
      <WarehouseTree branchId={String(branchId)} initial={nodes} categories={categories} />
    </div>
  );
}

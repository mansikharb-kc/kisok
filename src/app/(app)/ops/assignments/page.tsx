import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";
import AssignmentsTableClient from "@/components/ops/AssignmentsTableClient";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasRole(session.roles, "ONB_LEAD")) redirect("/dashboard");

  const roleEntry = session.roles.find((r) => r.code === "ONB_LEAD" && r.branchId);
  const branchId = roleEntry?.branchId ? BigInt(roleEntry.branchId) : null;
  if (!branchId) redirect("/dashboard");

  const [assignments, totalSellers, branch] = await Promise.all([
    prisma.sellerAssignment.findMany({
      where: { seller: { branchId } },
      orderBy: { assignedAt: "desc" },
      include: {
        seller: {
          select: {
            name: true,
            sellerCode: true,
            membershipId: true,
            status: true,
            sellerBrands: { include: { brand: { select: { name: true, code: true } } } },
          },
        },
        program: { select: { name: true, code: true } },
        exec: { select: { id: true, fullName: true, email: true } },
      },
    }),
    prisma.seller.count({ where: { branchId } }),
    prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } }),
  ]);

  const rows = serialize(assignments) as any[];

  const totalAssignments = rows.length;
  const unassignedCount = totalSellers - new Set(rows.map((a: any) => a.seller.sellerCode)).size;
  const execCount = new Set(rows.map((a: any) => a.exec.id)).size;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Assignments</h1>
          <p className="text-sm text-slate-500 mt-1">
            Seller-to-exec assignments at {branch?.name ?? "your branch"}.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Assignments</div>
          <div className="text-3xl font-bold mt-1 text-slate-900">{totalAssignments}</div>
        </div>
        <div className={`rounded-xl border p-5 shadow-sm ${unassignedCount > 0 ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white/60 backdrop-blur-md"}`}>
          <div className={`text-xs font-semibold uppercase tracking-wider ${unassignedCount > 0 ? "text-amber-600" : "text-slate-400"}`}>
            Unassigned Sellers
          </div>
          <div className={`text-3xl font-bold mt-1 ${unassignedCount > 0 ? "text-amber-700" : "text-slate-900"}`}>
            {unassignedCount}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Exec Count</div>
          <div className="text-3xl font-bold mt-1 text-brand-600">{execCount}</div>
        </div>
      </div>

      {/* Table view client component */}
      <AssignmentsTableClient initialRows={rows} />
    </div>
  );
}


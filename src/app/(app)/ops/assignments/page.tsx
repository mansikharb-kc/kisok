import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";
import RemoveAssignmentButton from "@/components/ops/RemoveAssignmentButton";

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

  // Group by exec
  const byExec = new Map<
    string,
    { exec: { id: string; fullName: string; email: string }; assignments: { id: string; seller: any; program: any }[] }
  >();
  for (const a of rows) {
    const key = a.exec.id;
    if (!byExec.has(key)) byExec.set(key, { exec: a.exec, assignments: [] });
    byExec.get(key)!.assignments.push({ id: a.id, seller: a.seller, program: a.program });
  }

  const totalAssignments = rows.length;
  const unassignedCount = totalSellers - new Set(rows.map((a: any) => a.seller.sellerCode)).size;
  const execCount = byExec.size;

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
        <Link
          href="/ops/assignments/new"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          + Assign Seller
        </Link>
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

      {/* Grouped by exec */}
      {byExec.size === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 backdrop-blur-md p-12 text-center">
          <p className="text-sm text-slate-400">No assignments yet.</p>
          <Link
            href="/ops/assignments/new"
            className="mt-3 inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"
          >
            + Assign the first seller
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {[...byExec.values()].map(({ exec, assignments }) => (
            <div
              key={exec.id}
              className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md overflow-hidden shadow-sm"
            >
              {/* Exec header */}
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-100 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold shrink-0 select-none">
                  {exec.fullName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-slate-800">{exec.fullName}</div>
                  <div className="text-[11px] text-slate-400">
                    {exec.email} · OB Exec ·{" "}
                    <span className="font-medium text-slate-500">
                      {assignments.length} seller{assignments.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sellers list */}
              <div className="divide-y divide-slate-100">
                {assignments.map(({ id: assignmentId, seller: s, program: p }) => (
                  <div
                    key={assignmentId}
                    className={`flex items-center gap-4 px-5 py-3 ${s.status !== "active" ? "opacity-50" : ""}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-800 text-sm">
                        {s.name}
                        {p?.name ? (
                          <span className="text-slate-400 font-normal"> — {p.name}</span>
                        ) : null}
                      </div>
                      <div className="font-mono text-[11px] text-slate-400">
                        {s.sellerCode}
                        {s.membershipId ? ` · ${s.membershipId}` : ""}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {s.sellerBrands.map((sb: any) => (
                        <span
                          key={sb.brand.code}
                          className="text-[11px] px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 font-medium"
                        >
                          {sb.brand.name}
                        </span>
                      ))}
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${
                        s.status === "active"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          s.status === "active" ? "bg-emerald-500" : "bg-slate-300"
                        }`}
                      />
                      {s.status}
                    </span>
                    <RemoveAssignmentButton id={assignmentId} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

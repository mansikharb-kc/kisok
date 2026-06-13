import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasRole(session.roles, "ONB_LEAD")) redirect("/dashboard");

  const roleEntry = session.roles.find((r) => r.code === "ONB_LEAD" && r.branchId);
  const branchId = roleEntry?.branchId ? BigInt(roleEntry.branchId) : null;
  if (!branchId) redirect("/dashboard");

  const [sellers, branch] = await Promise.all([
    prisma.seller.findMany({
      where: { branchId },
      orderBy: [{ status: "asc" }, { name: "asc" }],
      include: {
        sellerBrands: { include: { brand: { select: { name: true, code: true } } } },
        contracts: { include: { program: { select: { name: true } } } },
        assignments: { include: { exec: { select: { fullName: true } } } },
        _count: { select: { consignments: true, localRecords: true } },
      },
    }),
    prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } }),
  ]);

  const rows = serialize(sellers) as any[];

  const totalSellers = rows.length;
  const assignedCount = rows.filter((s) => s.assignments.length > 0).length;
  const unassignedCount = totalSellers - assignedCount;
  const activeContractsCount = rows.reduce(
    (acc: number, s: any) => acc + s.contracts.filter((c: any) => c.verified).length,
    0
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sellers</h1>
          <p className="text-sm text-slate-500 mt-1">
            Sellers registered at {branch?.name ?? "your branch"}.
          </p>
        </div>
        <Link
          href="/ops/sellers/new"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          + New Seller
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Sellers</div>
          <div className="text-3xl font-bold mt-1 text-slate-900">{totalSellers}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Assigned</div>
          <div className="text-3xl font-bold mt-1 text-emerald-600">{assignedCount}</div>
        </div>
        <div className={`rounded-xl border p-5 shadow-sm ${unassignedCount > 0 ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}>
          <div className={`text-xs font-semibold uppercase tracking-wider ${unassignedCount > 0 ? "text-amber-600" : "text-slate-400"}`}>Unassigned</div>
          <div className={`text-3xl font-bold mt-1 ${unassignedCount > 0 ? "text-amber-700" : "text-slate-900"}`}>{unassignedCount}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Contracts</div>
          <div className="text-3xl font-bold mt-1 text-brand-600">{activeContractsCount}</div>
        </div>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-sm text-slate-400">No sellers yet.</p>
          <Link href="/ops/sellers/new" className="mt-3 inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
            + Add the first seller
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Seller</th>
                <th className="px-4 py-3 text-left font-medium">Membership ID</th>
                <th className="px-4 py-3 text-left font-medium">Brands</th>
                <th className="px-4 py-3 text-left font-medium">Programs / Contracts</th>
                <th className="px-4 py-3 text-left font-medium">Assigned Exec</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((s: any) => (
                <tr key={s.id} className={`hover:bg-slate-50 transition-colors ${s.status !== "active" ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3 align-middle">
                    <div className="font-semibold text-slate-800">{s.name}</div>
                    <div className="font-mono text-[11px] text-slate-400">{s.sellerCode}</div>
                  </td>
                  <td className="px-4 py-3 align-middle font-mono text-xs text-slate-600">
                    {s.membershipId ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex flex-wrap gap-1">
                      {s.sellerBrands.length === 0 ? (
                        <span className="text-slate-300 text-xs">—</span>
                      ) : (
                        s.sellerBrands.map((sb: any) => (
                          <span key={sb.brand.code} className="text-[11px] px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 font-medium">
                            {sb.brand.name}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex flex-wrap gap-1">
                      {s.contracts.length === 0 ? (
                        <span className="text-slate-300 text-xs">—</span>
                      ) : (
                        s.contracts.map((c: any) => (
                          <span
                            key={c.id}
                            className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                              c.verified
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {c.program.name} {c.verified ? "✓" : "⏳"}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle text-xs text-slate-600">
                    {s.assignments.length === 0 ? (
                      <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                        Unassigned
                      </span>
                    ) : (
                      s.assignments.map((a: any) => a.exec.fullName).join(", ")
                    )}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        s.status === "active"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          s.status === "active" ? "bg-emerald-500" : "bg-slate-300"
                        }`}
                      />
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/ops/sellers/${s.id}/edit`}
                        className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-600 transition-colors"
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/ops/sellers/${s.id}`}
                        className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-600 transition-colors"
                      >
                        View
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

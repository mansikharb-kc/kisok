import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ConsignmentsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const allowedRoles = ["ONB_LEAD", "CONSIGNMENT_USER", "OB_EXEC"];
  const hasAccess = session.roles.some((r) => allowedRoles.includes(r.code));
  if (!hasAccess) redirect("/dashboard");

  const opsRole = session.roles.find((r) => allowedRoles.includes(r.code) && r.branchId);
  const branchId = opsRole?.branchId ? BigInt(opsRole.branchId) : null;
  if (!branchId) redirect("/dashboard");

  const [consignments, branch] = await Promise.all([
    prisma.consignment.findMany({
      where: { seller: { branchId } },
      orderBy: { createdAt: "desc" },
      include: {
        seller: { select: { name: true, sellerCode: true } },
        brand: { select: { name: true, code: true } },
        items: { include: { qcRecords: { orderBy: { qcAt: "desc" }, take: 1 } } },
      },
    }),
    prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } }),
  ]);

  const rows = serialize(consignments) as any[];

  // Counts for status widgets
  const total = rows.length;
  const statusCounts = rows.reduce((acc: Record<string, number>, c: any) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {});

  const statusColors: Record<string, string> = {
    initiated: "bg-blue-50 text-blue-700 border-blue-200",
    received: "bg-indigo-50 text-indigo-700 border-indigo-200",
    in_buffer: "bg-amber-50 text-amber-700 border-amber-200",
    fabricating: "bg-orange-50 text-orange-700 border-orange-200",
    qc: "bg-purple-50 text-purple-700 border-purple-200",
    passed_back: "bg-emerald-50 text-emerald-700 border-emerald-200",
    closed: "bg-slate-100 text-slate-600 border-slate-200",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Consignments & Quality Control</h1>
        <p className="text-sm text-slate-500 mt-1">
          Monitor incoming consignments, manage buffer stages, fabrication, and QC records for {branch?.name ?? "your branch"}.
        </p>
      </div>

      {/* Access Rights Info Banner */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-sm">
        <div className="space-y-1">
          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
            🔑 Role Access Guide: Consignments Flow
          </div>
          <p className="text-xs text-slate-500 max-w-3xl">
            <strong>Consignment User</strong> has full rights to Receive, Buffer, Fabricate, and run QC on physical samples.
            <strong>Onboarding Lead</strong> and <strong>Onboarding Exec</strong> receive notifications and trigger consignments.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-medium">
          <span className="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700">Consignment: CRUD</span>
          <span className="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700">QC Status: CRUD</span>
          <span className="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700">Controlled sizes: Select</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {(["initiated", "received", "in_buffer", "fabricating", "qc", "passed_back", "closed"] as const).map((status) => {
          const count = statusCounts[status] ?? 0;
          const label = status.replace("_", " ");
          return (
            <div key={status} className={`rounded-xl border p-4 shadow-sm ${statusColors[status] || "bg-white border-slate-200 text-slate-800"}`}>
              <div className="text-[10px] font-semibold uppercase tracking-wider opacity-85 truncate">{label}</div>
              <div className="text-2xl font-bold mt-0.5">{count}</div>
            </div>
          );
        })}
      </div>

      {/* Main List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 text-sm">Consignments Catalogue</h2>
          <span className="text-xs font-medium text-slate-400">{total} consignments total</span>
        </div>

        {rows.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            No active consignments registered at this branch yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-5 py-3.5">Seller & Brand</th>
                  <th className="px-5 py-3.5">SPOC Contact</th>
                  <th className="px-5 py-3.5">Expected Date</th>
                  <th className="px-5 py-3.5">Items Summary</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 align-top">
                      <div className="font-semibold text-slate-800">{c.seller.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5 font-medium">Brand: {c.brand.name}</div>
                      <div className="text-[10px] font-mono text-slate-400 mt-1">ID: #{c.id}</div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="font-medium text-slate-800 text-xs">{c.spocName || "—"}</div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">{c.spocContact || "—"}</div>
                    </td>
                    <td className="px-5 py-4 align-top font-mono text-xs text-slate-700">
                      {c.expectedDate ? new Date(c.expectedDate).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="space-y-1.5">
                        {c.items.length === 0 ? (
                          <span className="text-slate-400 text-xs">No items defined</span>
                        ) : (
                          c.items.map((item: any) => {
                            const lastQc = item.qcRecords?.[0];
                            return (
                              <div key={item.id} className="text-xs bg-slate-50 p-2 rounded border border-slate-200/60 max-w-sm">
                                <div className="font-medium text-slate-800">{item.description}</div>
                                <div className="text-[10px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                                  <span>Type: {item.sampleType || "Sample"}</span>
                                  <span>·</span>
                                  <span>Qty: {item.receivedQty ?? 0} / {item.expectedQty ?? 0}</span>
                                </div>
                                {lastQc && (
                                  <div className="mt-1 flex items-center gap-1.5">
                                    <span className={`text-[9px] px-1 py-0.2 rounded font-bold uppercase ${
                                      lastQc.result === "pass" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                                    }`}>
                                      QC: {lastQc.result}
                                    </span>
                                    {lastQc.notes && <span className="text-[10px] text-slate-400 truncate max-w-[150px]">({lastQc.notes})</span>}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold uppercase border ${statusColors[c.status] || "bg-white border-slate-200"}`}>
                        {c.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-top text-xs text-slate-500 italic max-w-xs truncate">
                      {c.remarks || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

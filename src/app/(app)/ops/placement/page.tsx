import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PlacementPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const allowedRoles = ["OB_EXEC", "ONB_LEAD"];
  const hasAccess = session.roles.some((r) => allowedRoles.includes(r.code));
  if (!hasAccess) redirect("/dashboard");

  const opsRole = session.roles.find((r) => allowedRoles.includes(r.code) && r.branchId);
  const branchId = opsRole?.branchId ? BigInt(opsRole.branchId) : null;
  if (!branchId) redirect("/dashboard");

  const [copies, branch] = await Promise.all([
    prisma.productCopy.findMany({
      where: { branchId },
      orderBy: { createdAt: "desc" },
      include: {
        product: { select: { name: true, sku: true, brand: { select: { name: true } } } },
        location: { select: { name: true, locationId: true, path: true } },
        size: { select: { label: true } },
        record: { include: { seller: { select: { name: true } } } },
      },
    }),
    prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } }),
  ]);

  const rows = serialize(copies) as any[];

  // Counts
  const total = rows.length;
  const masterCount = rows.filter((c) => c.copyRole === "MASTER").length;
  const slaveCount = total - masterCount;
  const unplacedCount = rows.filter((c) => !c.locationNodeId).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Physical Placement & QR Stickers</h1>
        <p className="text-sm text-slate-500 mt-1">
          Map physical samples/copies to location nodes, audit copy roles, and manage QR tags for {branch?.name ?? "your branch"}.
        </p>
      </div>

      {/* Access Rights Info Banner */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-sm">
        <div className="space-y-1">
          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
            🔑 Role Access Guide: Placements & Locations
          </div>
          <p className="text-xs text-slate-500 max-w-3xl">
            <strong>Onboarding Exec</strong> has full rights to map products to location nodes, determine copy counts, designate MASTER/SLAVE roles, select sample size from the controlled list, and trigger sticker rendering.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-medium">
          <span className="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700">Placement: CRUD</span>
          <span className="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700">Copy Role: Exactly 1 Master</span>
          <span className="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700">QR Sticker: Batch print</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Copies on shelf</div>
          <div className="text-3xl font-bold mt-1 text-slate-900">{total}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-purple-600">Master Copies</div>
          <div className="text-3xl font-bold mt-1 text-purple-700">{masterCount}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Slave Copies</div>
          <div className="text-3xl font-bold mt-1 text-slate-700">{slaveCount}</div>
        </div>
        <div className={`rounded-xl border p-5 shadow-sm ${unplacedCount > 0 ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}>
          <div className={`text-xs font-semibold uppercase tracking-wider ${unplacedCount > 0 ? "text-amber-600" : "text-slate-400"}`}>Unplaced Copies</div>
          <div className={`text-3xl font-bold mt-1 ${unplacedCount > 0 ? "text-amber-700" : "text-slate-900"}`}>{unplacedCount}</div>
        </div>
      </div>

      {/* Main List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 text-sm">Physical Copy Catalogues</h2>
          <span className="text-xs font-medium text-slate-400">{total} copies total</span>
        </div>

        {rows.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            No physical product copies have been placed at this branch yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-5 py-3.5">Instance Code & QR</th>
                  <th className="px-5 py-3.5">Product Details</th>
                  <th className="px-5 py-3.5">Copy Role & Size</th>
                  <th className="px-5 py-3.5">Physical Location</th>
                  <th className="px-5 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 align-top">
                      <div className="font-mono text-xs font-semibold text-slate-800">{c.instanceCode}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">Instance ID: #{c.id}</div>
                      <div className="mt-1">
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 font-medium select-none">
                          QR code generated
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="font-semibold text-slate-800">{c.product.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">SKU: {c.product.sku}</div>
                      <div className="text-[10px] font-medium text-slate-400 mt-1">Seller: {c.record.seller.name}</div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="space-y-1">
                        <div>
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            c.copyRole === "MASTER" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                          }`}>
                            {c.copyRole}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 font-medium">
                          Size: {c.size?.label || "—"}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      {c.location ? (
                        <div className="space-y-1">
                          <div className="font-semibold text-slate-800 text-xs">{c.location.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">ID: {c.location.locationId}</div>
                          <div className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]" title={c.location.path}>
                            Path: {c.location.path}
                          </div>
                        </div>
                      ) : (
                        <span className="text-amber-600 font-medium text-xs flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                          Unplaced / Stage Buffer
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="space-y-1">
                        <div>
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            c.availability === "IN" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}>
                            Availability: {c.availability}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Status: {c.status}
                        </div>
                      </div>
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

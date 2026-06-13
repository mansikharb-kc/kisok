import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const allowedRoles = ["OB_EXEC", "ONB_LEAD"];
  const hasAccess = session.roles.some((r) => allowedRoles.includes(r.code));
  if (!hasAccess) redirect("/dashboard");

  const opsRole = session.roles.find((r) => allowedRoles.includes(r.code) && r.branchId);
  const branchId = opsRole?.branchId ? BigInt(opsRole.branchId) : null;
  if (!branchId) redirect("/dashboard");

  const [records, branch] = await Promise.all([
    prisma.localOnboardingRecord.findMany({
      where: { branchId },
      orderBy: { createdAt: "desc" },
      include: {
        product: {
          include: {
            brand: { select: { name: true, code: true } },
            category: { select: { name: true, code: true } },
            attrValues: { include: { attribute: true, option: true } },
          },
        },
        seller: { select: { name: true, sellerCode: true } },
        program: { select: { name: true, code: true } },
      },
    }),
    prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } }),
  ]);

  const rows = serialize(records) as any[];

  // Counts
  const total = rows.length;
  const activeCount = rows.filter((r) => r.status === "active").length;
  const draftCount = rows.filter((r) => r.status === "draft").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Product Onboarding</h1>
        <p className="text-sm text-slate-500 mt-1">
          Review locally onboarded products and specifications for {branch?.name ?? "your branch"}.
        </p>
      </div>

      {/* Access Rights Info Banner */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-sm">
        <div className="space-y-1">
          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
            🔑 Role Access Guide: Product Onboarding & Catalogues
          </div>
          <p className="text-xs text-slate-500 max-w-3xl">
            <strong>Onboarding Exec</strong> can freely create new Brand Product Masters, fill in empty attributes, and link media.
            Modifying already-populated master fields requires HO approval. Overrides and local media are always free.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-medium">
          <span className="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700">Master Product: Create (Free)</span>
          <span className="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700">Master Edits: Gated</span>
          <span className="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700">Local Overrides: CRUD</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Products</div>
          <div className="text-3xl font-bold mt-1 text-slate-900">{total}</div>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Active (Shelf-Ready)</div>
          <div className="text-3xl font-bold mt-1 text-emerald-700">{activeCount}</div>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-600">Draft Status</div>
          <div className="text-3xl font-bold mt-1 text-amber-700">{draftCount}</div>
        </div>
      </div>

      {/* Main List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 text-sm">Onboarded Products Catalogue</h2>
          <span className="text-xs font-medium text-slate-400">{total} items total</span>
        </div>

        {rows.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            No products have been onboarded at this branch yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-5 py-3.5">Product Spec</th>
                  <th className="px-5 py-3.5">Category & Brand</th>
                  <th className="px-5 py-3.5">Seller & Program</th>
                  <th className="px-5 py-3.5">Attributes & Dimensions</th>
                  <th className="px-5 py-3.5">Local Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {rows.map((row) => {
                  const p = row.product;
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-4 align-top">
                        <div className="font-semibold text-slate-800">{p.name}</div>
                        <div className="font-mono text-xs text-slate-500 mt-0.5">SKU: {p.sku}</div>
                        <div className="text-[10px] text-slate-400 mt-1 font-mono">Record ID: #{row.id}</div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="font-medium text-slate-800 text-xs">{p.brand.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">Category: {p.category.name}</div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="font-semibold text-slate-700 text-xs">{row.seller.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">Code: {row.seller.sellerCode}</div>
                        <div className="text-[10px] mt-1 inline-flex px-2 py-0.5 rounded bg-brand-50 text-brand-700 font-medium border border-brand-100">
                          Prog: {row.program.name}
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="space-y-1 max-w-md">
                          {p.attrValues.length === 0 ? (
                            <span className="text-slate-400 text-xs italic">No attributes loaded</span>
                          ) : (
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                              {p.attrValues.map((v: any) => {
                                const val = v.option ? v.option.optionValue : (v.valueText || v.valueNumber || (v.valueBool !== null ? String(v.valueBool) : "—"));
                                return (
                                  <div key={v.id} className="truncate">
                                    <span className="text-slate-400 font-medium">{v.attribute.name}:</span>{" "}
                                    <span className="text-slate-700 font-medium">{val} {v.attribute.unit}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                          row.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";
import { buildParentOptions } from "@/lib/categoryTree";
import { levelMeta } from "@/lib/categoryLevels";
import SellerBrandsList from "@/components/ops/SellerBrandsList";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasRole(session.roles, "ONB_LEAD")) redirect("/dashboard");

  const roleEntry = session.roles.find((r) => r.code === "ONB_LEAD" && r.branchId);
  const branchId = roleEntry?.branchId ? BigInt(roleEntry.branchId) : null;
  if (!branchId) redirect("/dashboard");

  const sellerId = BigInt(params.id);

  const [seller, categoryRows] = await Promise.all([
    prisma.seller.findUnique({
      where: { id: sellerId },
      include: {
        sellerBrands: { include: { brand: { select: { id: true, name: true, code: true } } } },
        sellerCategories: { select: { categoryId: true } },
        contracts: { include: { program: { select: { name: true } } } },
        assignments: { include: { exec: { select: { fullName: true, email: true } } } },
        branch: { select: { name: true } },
        localRecords: {
          include: {
            product: {
              include: {
                brand: { select: { name: true, code: true } },
                category: { select: { name: true } },
              },
            },
            program: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.category.findMany({
      where: { status: "active" },
      select: { id: true, name: true, parentId: true },
    }),
  ]);

  if (!seller) notFound();
  if (seller.branchId !== branchId) redirect("/dashboard");

  const s = serialize(seller) as any;
  const flatCats = serialize(categoryRows);

  const parents = buildParentOptions(flatCats);
  const byId = new Map(parents.map((p) => [p.id, p]));

  const sellerCategoriesList = s.sellerCategories?.map((sc: any) => {
    return byId.get(String(sc.categoryId));
  }).filter(Boolean) ?? [];

  const card = "bg-white/60 backdrop-blur-md rounded-2xl border border-slate-200 p-6 shadow-sm";
  const labelStyle = "text-xs font-semibold uppercase tracking-wider text-slate-400";
  const valStyle = "text-sm font-medium text-slate-800 mt-1";

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/ops/sellers"
            className="text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            ‹ Back to Sellers
          </Link>
          <h1 className="text-2xl font-bold mt-1 text-slate-900">{s.name}</h1>
          <p className="text-sm text-slate-500">Seller detail and governance records</p>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/print/sellers/${s.id}`}
            target="_blank"
            className="rounded-lg border border-slate-350 bg-white/60 backdrop-blur-md text-slate-750 px-5 py-2 text-sm font-semibold hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm"
          >
            Print Contract / Profile
          </Link>
          <Link
            href={`/ops/sellers/${s.id}/edit`}
            className="rounded-lg bg-brand-600 text-white px-5 py-2 text-sm font-semibold hover:bg-brand-700 transition-colors shadow-sm"
          >
            Edit Seller
          </Link>
        </div>
      </div>

      {/* Grid of Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Basic Profile & Associations */}
        <div className="md:col-span-1 space-y-6">
          {/* Profile Card */}
          <div className={card}>
            <h3 className="font-bold text-slate-950 mb-4 pb-2 border-b border-slate-100">
              Profile
            </h3>
            <div className="space-y-4">
              <div>
                <div className={labelStyle}>Seller Name</div>
                <div className={valStyle}>{s.name}</div>
              </div>
              <div>
                <div className={labelStyle}>Seller Code</div>
                <div className={`${valStyle} font-mono text-xs`}>{s.sellerCode}</div>
              </div>
              <div>
                <div className={labelStyle}>Membership ID</div>
                <div className={valStyle}>{s.membershipId ?? <span className="text-slate-300">Not set</span>}</div>
              </div>
              <div>
                <div className={labelStyle}>Status</div>
                <div className="mt-1.5">
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
                </div>
              </div>
              <div>
                <div className={labelStyle}>Branch</div>
                <div className={valStyle}>{s.branch.name}</div>
              </div>
            </div>
          </div>

          {/* Categories Operated In */}
          <div className={card}>
            <h3 className="font-bold text-slate-950 mb-4 pb-2 border-b border-slate-100">
              Categories Operated In
            </h3>
            {sellerCategoriesList.length === 0 ? (
              <p className="text-sm text-slate-400">No categories associated with this seller.</p>
            ) : (
              <div className="space-y-2">
                {sellerCategoriesList.map((cat: any) => (
                  <div key={cat.id} className="flex items-center gap-2 text-xs">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${levelMeta(cat.level).badge}`}>
                      {levelMeta(cat.level).label}
                    </span>
                    <span className="font-mono text-slate-400 shrink-0">{cat.number}</span>
                    <span className="font-medium text-slate-800 truncate">{cat.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Brands Associated */}
          <SellerBrandsList sellerBrands={s.sellerBrands} />
        </div>

        {/* Right Column: Contracts and Assignments */}
        <div className="md:col-span-2 space-y-6">
          {/* Contracts */}
          <div className={card}>
            <h3 className="font-bold text-slate-950 mb-4 pb-2 border-b border-slate-100">
              Program Contracts
            </h3>
            {s.contracts.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center border border-dashed border-slate-200 rounded-xl">
                No active program contracts established.
              </p>
            ) : (
              <div className="space-y-4">
                {s.contracts.map((c: any) => (
                  <div
                    key={c.id}
                    className="rounded-xl border border-slate-150 bg-slate-50/50 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="font-bold text-slate-800 text-sm">{c.program.name}</div>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                          c.verified
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {c.verified ? "Verified ✓" : "Verification Pending "}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                      <div>
                        <div className="text-slate-400 uppercase tracking-wider font-semibold">Tenure</div>
                        <div className="text-slate-700 font-medium mt-0.5">
                          {c.collaborationTenure ?? "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400 uppercase tracking-wider font-semibold">Fitout Period</div>
                        <div className="text-slate-700 font-medium mt-0.5">
                          {c.fitoutPeriod ?? "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400 uppercase tracking-wider font-semibold">Start Date</div>
                        <div className="text-slate-700 font-medium mt-0.5">
                          {c.contractStart ? c.contractStart.slice(0, 10) : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400 uppercase tracking-wider font-semibold">End Date</div>
                        <div className="text-slate-700 font-medium mt-0.5">
                          {c.contractEnd ? c.contractEnd.slice(0, 10) : "—"}
                        </div>
                      </div>
                    </div>

                    {c.remarks && (
                      <div className="pt-2 text-xs border-t border-slate-100/60">
                        <span className="text-slate-400 font-semibold uppercase tracking-wider block mb-0.5">
                          Remarks
                        </span>
                        <p className="text-slate-600 font-medium">{c.remarks}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assignments */}
          <div className={card}>
            <h3 className="font-bold text-slate-950 mb-4 pb-2 border-b border-slate-100">
              Assigned Onboarding Executives
            </h3>
            {s.assignments.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center border border-dashed border-slate-200 rounded-xl">
                No executives assigned to this seller yet. Go to{" "}
                <Link href="/ops/assignments" className="text-brand-600 hover:underline">
                  Assignments
                </Link>{" "}
                to assign an executive.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {s.assignments.map((a: any) => (
                  <div key={a.exec.email} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="h-8 w-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold font-mono">
                      {a.exec.fullName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{a.exec.fullName}</div>
                      <div className="text-xs text-slate-400">{a.exec.email}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Onboarded Products Section */}
      <div className={card}>
        <h3 className="font-bold text-slate-950 mb-4 pb-2 border-b border-slate-100">
          Onboarded Products ({s.localRecords.length})
        </h3>
        {s.localRecords.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center text-sm text-slate-400">
            No products have been onboarded for this seller yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Product / SKU</th>
                  <th className="px-4 py-3 text-left font-medium">Brand</th>
                  <th className="px-4 py-3 text-left font-medium">Category</th>
                  <th className="px-4 py-3 text-left font-medium">Program</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Onboarded At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {s.localRecords.map((r: any) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 align-middle font-medium">
                      <div className="font-semibold text-slate-800">{r.product.name}</div>
                      <div className="font-mono text-[11px] text-slate-400 mt-0.5">{r.product.sku}</div>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-50 border border-brand-200 text-brand-700 font-semibold">
                        {r.product.brand.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle text-xs text-slate-600 font-medium">
                      {r.product.category.name}
                    </td>
                    <td className="px-4 py-3 align-middle text-xs text-slate-650 font-semibold">
                      {r.program.name}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wider ${
                          r.status === "completed" || r.status === "active" || r.status === "submitted"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                            : r.status === "draft"
                            ? "bg-slate-100 text-slate-600 border border-slate-200"
                            : "bg-amber-50 text-amber-700 border border-amber-100"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle text-xs text-slate-500 font-medium">
                      {new Date(r.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
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

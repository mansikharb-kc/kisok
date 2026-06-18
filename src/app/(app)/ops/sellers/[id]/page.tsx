import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";
import { buildParentOptions } from "@/lib/categoryTree";
import { levelMeta } from "@/lib/categoryLevels";
import { subtractDays, formatDMY, formatDaysToYMD } from "@/lib/brandMeta";
import { formatDate } from "@/lib/format";

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

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{s.name}</h1>
          <p className="text-sm text-slate-500">Seller detail and governance records</p>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/print/sellers/${s.id}`}
            target="_blank"
            className="rounded-lg border border-slate-300 bg-white/60 backdrop-blur-md text-slate-700 px-5 py-2 text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm"
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

      {/* Profile */}
      <FormSection title="Profile">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Seller Name">{s.name}</Field>
          <Field label="Seller Code" mono>{s.sellerCode}</Field>
          <Field label="Membership ID">{s.membershipId ?? <span className="text-slate-400">Not set</span>}</Field>
          <Field label="Branch">{s.branch.name}</Field>
          <Field label="Status">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white capitalize ${s.status === "active" ? "bg-emerald-600" : "bg-slate-500"}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              {s.status}
            </span>
          </Field>
        </div>
      </FormSection>

      {/* Program Contracts */}
      <FormSection title="Program Contracts">
        {s.contracts.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center border border-dashed border-slate-200 rounded-xl">
            No active program contracts established.
          </p>
        ) : (
          <div className="space-y-5">
            {s.contracts.map((c: any) => {
              const fitoutStr = c.fitoutPeriod ? c.fitoutPeriod.replace(/\D/g, "") : "";
              const startStr = c.contractStart ? c.contractStart.slice(0, 10) : "";
              const baseStartDate = startStr && fitoutStr ? subtractDays(startStr, fitoutStr) : "";
              const fitoutEnd = baseStartDate && fitoutStr ? subtractDays(startStr, "1") : "";
              const tenureDays = c.collaborationTenure ? c.collaborationTenure.replace(/\D/g, "") : "";

              return (
                <div key={c.id} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-slate-800 text-sm">{c.program.name}</div>
                    <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold text-white ${c.verified ? "bg-emerald-600" : "bg-amber-600"}`}>
                      {c.verified ? "Verified ✓" : "Verification Pending"}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Field label="Collaboration Tenure ( In Days )">
                      {tenureDays ? `${tenureDays} Days` : "—"}
                      {tenureDays && formatDaysToYMD(c.collaborationTenure) ? <span className="block text-[11px] text-slate-400">( {formatDaysToYMD(c.collaborationTenure)} )</span> : null}
                    </Field>
                    <Field label="Collaboration Tenure Start Date">{c.contractStart ? formatDMY(c.contractStart.slice(0, 10)) : "—"}</Field>
                    <Field label="Collaboration Tenure End Date">{c.contractEnd ? formatDMY(c.contractEnd.slice(0, 10)) : "—"}</Field>
                    <Field label="Fitout Period ( In Days )">
                      {fitoutStr ? `${fitoutStr} Days` : "—"}
                      {fitoutStr && formatDaysToYMD(fitoutStr) ? <span className="block text-[11px] text-slate-400">( {formatDaysToYMD(fitoutStr)} )</span> : null}
                    </Field>
                    <Field label="Fitout Period Start Date">{baseStartDate ? formatDMY(baseStartDate) : "—"}</Field>
                    <Field label="Fitout Period End Date">{fitoutEnd ? formatDMY(fitoutEnd) : "—"}</Field>
                    {c.remarks ? <div className="sm:col-span-2 lg:col-span-3"><Field label="Remarks">{c.remarks}</Field></div> : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </FormSection>

      {/* Categories */}
      <FormSection title="Categories Operated In">
        {sellerCategoriesList.length === 0 ? (
          <p className="text-sm text-slate-400">No categories associated with this seller.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sellerCategoriesList.map((cat: any) => (
              <span key={cat.id} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md px-3 py-1.5 text-xs">
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${levelMeta(cat.level).badge}`}>{levelMeta(cat.level).label}</span>
                <span className="font-mono text-slate-400">{cat.number}</span>
                <span className="font-medium text-slate-800">{cat.name}</span>
              </span>
            ))}
          </div>
        )}
      </FormSection>

      {/* Brands */}
      <FormSection title="Authorized Brands">
        {s.sellerBrands.length === 0 ? (
          <p className="text-sm text-slate-400">No brands associated with this seller.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {s.sellerBrands.map((sb: any) => (
              <span key={sb.brand.id} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md px-3 py-1.5 text-xs">
                <span className="font-medium text-slate-800">{sb.brand.name}</span>
                <span className="font-mono text-slate-400">{sb.brand.code}</span>
              </span>
            ))}
          </div>
        )}
      </FormSection>

      {/* Assignments */}
      <FormSection title="Assigned Onboarding Executives">
        {s.assignments.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center border border-dashed border-slate-200 rounded-xl">
            No executives assigned yet. Go to{" "}
            <Link href="/ops/assignments" className="text-brand-600 hover:underline">Assignments</Link> to assign one.
          </p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {s.assignments.map((a: any) => (
              <div key={a.exec.email} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md px-4 py-2.5">
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
      </FormSection>

      {/* Onboarded Products */}
      <FormSection title={`Onboarded Products (${s.localRecords.length})`}>
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
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-white ${
                          r.status === "completed" || r.status === "active" || r.status === "submitted"
                            ? "bg-emerald-600"
                            : r.status === "draft"
                            ? "bg-slate-500"
                            : "bg-amber-600"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle text-xs text-slate-500 font-medium">
                      {formatDate(r.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </FormSection>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-4 border-b border-slate-200 pb-2 text-sm font-bold uppercase tracking-wider text-slate-700">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`mt-1 rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md px-3 py-2 text-sm font-medium text-slate-800 ${mono ? "font-mono text-xs" : ""}`}>
        {children}
      </div>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma, serialize } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import BrandDetailLogo from "@/components/brands/BrandDetailLogo";
import BrandApprovalActions from "@/components/brands/BrandApprovalActions";

export const dynamic = "force-dynamic";

function parseId(id: string): bigint | null {
  try {
    return BigInt(id);
  } catch {
    return null;
  }
}

export default async function BrandDetailPage({ params }: { params: { id: string } }) {
  const id = parseId(params.id);
  if (id === null) notFound();

  const session = await getSession();
  const readOnly = session ? !hasRole(session.roles, "HO_ADMIN") : true;

  const row = await prisma.brand.findUnique({
    where: { id },
    include: {
      logo: { select: { url: true } },
      brandCategories: { include: { category: { select: { name: true } } } },
      _count: { select: { brandProducts: true, branchBrands: true, sellerBrands: true } },
    },
  });

  if (!row) notFound();

  const b: any = serialize(row);
  const categories: string[] = b.brandCategories.map((bc: any) => bc.category.name);
  const approval = String(b.approvalStatus);
  const status = String(b.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <Link href="/masters/brands" className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 hover:bg-slate-50">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
          Brands
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-md p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <BrandDetailLogo url={b.logo?.url ?? null} name={b.name} />
            <div>
              <h1 className="text-2xl font-bold text-slate-800">{b.name}</h1>
              <span className="mt-1 inline-block rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-white">{b.code}</span>
            </div>
          </div>
          {!readOnly && (
            <Link href={`/masters/brands/${b.id}/edit`} className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-brand-600 hover:bg-slate-50">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
              Edit
            </Link>
          )}
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Field label="Brand ID">
            <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-white">{b.code}</span>
          </Field>
          <Field label="Type">
            <span className="text-slate-700">{b.brandType ?? "—"}</span>
          </Field>
          <Field label="Approval">
            <BrandApprovalActions brandId={String(b.id)} approval={approval} readOnly={readOnly} />
          </Field>
          <Field label="Status">
            {(() => {
              const map: Record<string, { label: string; cls: string; dot: string }> = {
                active: { label: "Active", cls: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
                inactive: { label: "Inactive", cls: "bg-slate-100 text-slate-500", dot: "bg-slate-300" },
                pending_approval: { label: "Pending approval", cls: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
              };
              const s = map[status] ?? { label: status, cls: "bg-slate-100 text-slate-500", dot: "bg-slate-300" };
              return (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${s.cls}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                  {s.label}
                </span>
              );
            })()}
          </Field>
          <Field label="Categories" full>
            {categories.length === 0 ? (
              <span className="text-slate-300">—</span>
            ) : (
              <div className="flex flex-col gap-1 text-sm text-slate-700">
                {categories.map((c) => <span key={c}>{c}</span>)}
              </div>
            )}
          </Field>
          <Field label="Usage" full>
            <div className="flex flex-wrap gap-6 text-sm text-slate-600">
              <span><span className="font-semibold text-slate-800">{b._count.brandProducts}</span> products</span>
              <span><span className="font-semibold text-slate-800">{b._count.sellerBrands}</span> sellers</span>
              <span><span className="font-semibold text-slate-800">{b._count.branchBrands}</span> branches</span>
            </div>
          </Field>
        </dl>
      </div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <dt className="text-xs uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="mt-1.5">{children}</dd>
    </div>
  );
}

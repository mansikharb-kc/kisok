import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";
import SellersTableClient from "@/components/ops/SellersTableClient";

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
      where: { branchId, status: { not: "archived" } },
      orderBy: [{ status: "asc" }, { name: "asc" }],
      include: {
        sellerBrands: { include: { brand: { select: { name: true, code: true } } } },
        contracts: { include: { program: { select: { name: true } } } },
        assignments: {
          include: {
            exec: { select: { id: true, fullName: true, email: true } },
          },
        },
        localRecords: {
          include: {
            product: {
              include: {
                category: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
              },
            },
          },
        },
        _count: { select: { consignments: true, localRecords: true } },
      },
    }),
    prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } }),
  ]);

  const rows = serialize(sellers) as any[];

  const totalSellers = rows.length;
  const assignedCount = rows.filter((s) => s.assignments.length > 0).length;
  const unassignedCount = totalSellers - assignedCount;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalBrands = new Set(
    rows.flatMap((s: any) => s.sellerBrands.map((sb: any) => sb.brand.code))
  ).size;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalCategories = new Set(
    rows.flatMap((s: any) => s.localRecords.map((lr: any) => lr.product?.category?.id))
  ).size;


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
        <div className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Sellers</div>
          <div className="text-3xl font-bold mt-1 text-slate-900">{totalSellers}</div>
        </div>
        <div className={`rounded-xl border p-5 shadow-sm ${unassignedCount > 0 ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white/60 backdrop-blur-md"}`}>
          <div className={`text-xs font-semibold uppercase tracking-wider ${unassignedCount > 0 ? "text-amber-600" : "text-slate-400"}`}>Unassigned</div>
          <div className={`text-3xl font-bold mt-1 ${unassignedCount > 0 ? "text-amber-700" : "text-slate-900"}`}>{unassignedCount}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Brands</div>
          <div className="text-3xl font-bold mt-1 text-slate-900">{totalBrands}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Categories</div>
          <div className="text-3xl font-bold mt-1 text-slate-900">{totalCategories}</div>
        </div>
      </div>

      {/* Interactive Sellers List with Filter & Sort */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 backdrop-blur-md p-12 text-center">
          <p className="text-sm text-slate-400">No sellers yet.</p>
          <Link href="/ops/sellers/new" className="mt-3 inline-flex items-center gap-1 text-brand-600 hover:underline">
            + Add the first seller
          </Link>
        </div>
      ) : (
        <SellersTableClient rows={rows} />
      )}
    </div>
  );
}

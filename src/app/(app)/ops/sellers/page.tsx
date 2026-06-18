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

  const sellers = await prisma.seller.findMany({
    where: { branchId, status: { not: "archived" } },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: {
      sellerBrands: { include: { brand: { select: { name: true, code: true } } } },
      contracts: { include: { program: { select: { name: true } } } },
      assignments: {
        include: {
          exec: { select: { id: true, fullName: true, email: true } },
          program: { select: { id: true, name: true } },
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
  });

  const rows = serialize(sellers) as any[];

  return (
    <div className="space-y-5">
      {/* Header */}
      <h1 className="text-2xl font-bold text-slate-900">Sellers</h1>

      {/* Interactive Sellers List with Filter & Sort */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 backdrop-blur-md p-12 text-center">
          <p className="text-sm text-slate-400">No sellers yet.</p>
          <Link href="/ops/sellers/new" className="mt-3 inline-flex items-center gap-1 text-brand-600 hover:underline">
            + Add the first seller
          </Link>
        </div>
      ) : (
        <SellersTableClient rows={rows} newSellerHref="/ops/sellers/new" />
      )}
    </div>
  );
}

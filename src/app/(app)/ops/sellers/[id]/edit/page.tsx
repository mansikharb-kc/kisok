import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";
import SellerForm from "@/components/ops/SellerForm";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasRole(session.roles, "ONB_LEAD")) redirect("/dashboard");

  const roleEntry = session.roles.find((r) => r.code === "ONB_LEAD" && r.branchId);
  const branchId = roleEntry?.branchId ? BigInt(roleEntry.branchId) : null;
  if (!branchId) redirect("/dashboard");

  const sellerId = BigInt(params.id);

  // Fetch seller details and branch configuration in parallel
  const [seller, branchBrands, branchPrograms] = await Promise.all([
    prisma.seller.findUnique({
      where: { id: sellerId },
      include: {
        sellerBrands: { select: { brandId: true } },
        contracts: true,
      },
    }),
    prisma.branchBrand.findMany({
      where: { branchId, brand: { status: "active" } },
      include: { brand: { select: { id: true, name: true, code: true } } },
    }),
    prisma.branchProgram.findMany({
      where: { branchId, program: { status: "active" } },
      include: { program: { select: { id: true, name: true, code: true } } },
    }),
  ]);

  if (!seller) notFound();
  if (seller.branchId !== branchId) redirect("/dashboard");

  const brands = serialize(branchBrands.map((bb) => bb.brand));
  const programs = serialize(branchPrograms.map((bp) => bp.program));
  const sellerData = serialize(seller);

  return (
    <div className="space-y-6">
      <SellerForm brands={brands} programs={programs} seller={sellerData} />
    </div>
  );
}

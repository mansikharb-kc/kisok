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

  // Brands = all HO-approved active brands. Programs = branch's approved programs.
  const [seller, brandRows, branchPrograms] = await Promise.all([
    prisma.seller.findUnique({
      where: { id: sellerId },
      include: {
        sellerBrands: { select: { brandId: true } },
        contracts: true,
      },
    }),
    prisma.brand.findMany({
      where: { status: "active", approvalStatus: "approved" },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
    prisma.branchProgram.findMany({
      where: { branchId, approvalStatus: "approved", program: { status: "active" } },
      include: { program: { select: { id: true, name: true, code: true } } },
    }),
  ]);

  if (!seller) notFound();
  if (seller.branchId !== branchId) redirect("/dashboard");

  const brands = serialize(brandRows);
  const programs = serialize(branchPrograms.map((bp) => bp.program));
  const sellerData = serialize(seller);

  return (
    <div className="space-y-6">
      <SellerForm brands={brands} programs={programs} seller={sellerData} />
    </div>
  );
}

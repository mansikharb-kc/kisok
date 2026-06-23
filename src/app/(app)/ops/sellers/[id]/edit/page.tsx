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
  const seller = await prisma.seller.findUnique({
    where: { id: sellerId },
    include: {
      sellerBrands: { select: { brandId: true } },
      sellerCategories: { select: { categoryId: true } },
      contracts: true,
      assignments: true,
    },
  });

  if (!seller) notFound();
  if (seller.branchId !== branchId) redirect("/dashboard");

  const brandIds = seller.sellerBrands.map((sb) => sb.brandId);

  const [brandRows, branchPrograms, execRows, categoryRows, salespersonRows] = await Promise.all([
    prisma.brand.findMany({
      where: { status: "active", approvalStatus: "approved" },
      select: {
        id: true,
        name: true,
        code: true,
        createdByUserId: true,
        brandCategories: { select: { categoryId: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.branchProgram.findMany({
      where: { branchId, approvalStatus: "approved", program: { status: "active" } },
      include: { program: { select: { id: true, name: true, code: true } } },
    }),
    prisma.user.findMany({
      where: {
        status: "active",
        roles: {
          some: {
            role: { code: "OB_EXEC" },
            branchId,
          },
        },
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        _count: {
          select: { assignments: true },
        },
      },
      orderBy: { fullName: "asc" },
    }),
    prisma.category.findMany({
      where: { status: "active" },
      select: { id: true, name: true, parentId: true },
    }),
    prisma.seller.findMany({
      where: {
        branchId,
        salesperson: { not: null },
      },
      select: {
        salesperson: true,
      },
      distinct: ["salesperson"],
    }),
  ]);

  const brands = serialize(brandRows);
  const programs = serialize(branchPrograms.map((bp) => bp.program));
  const execs = serialize(execRows);
  const flatCategories = serialize(categoryRows);
  const sellerData = serialize(seller);
  const salespersons = Array.from(new Set(
    salespersonRows.map((r) => r.salesperson ?? "").map((s) => s.trim()).filter(Boolean)
  )).sort();

  return (
    <div className="space-y-6">
      <SellerForm
        brands={brands}
        programs={programs}
        execs={execs}
        flatCategories={flatCategories}
        seller={sellerData}
        salespersons={salespersons}
        currentUserId={session.uid}
      />
    </div>
  );
}

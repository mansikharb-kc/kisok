import { prisma, serialize } from "@/lib/prisma";
import BrandsClient, { BrandRow } from "@/components/brands/BrandsClient";

export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  const rows = await prisma.brand.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: {
      logo: { select: { url: true } },
      brandCategories: { include: { category: { select: { name: true } } } },
      _count: { select: { brandProducts: true, branchBrands: true, sellerBrands: true } },
    },
  });

  const brands: BrandRow[] = serialize(rows).map((b: any) => ({
    id: b.id,
    brandNo: b.brandNo,
    name: b.name,
    code: b.code,
    brandType: b.brandType,
    logoUrl: b.logo?.url ?? null,
    categories: b.brandCategories.map((bc: any) => bc.category.name),
    approvalStatus: b.approvalStatus,
    status: b.status,
    productCount: b._count.brandProducts,
    sellerCount: b._count.sellerBrands,
    branchCount: b._count.branchBrands,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Brands</h1>
        <p className="text-sm text-slate-500 mt-1">
          HO master. Each brand owns a SKU-keyed product catalog shared across sellers & branches. New brands need HO approval.
        </p>
      </div>
      <BrandsClient initial={brands} />
    </div>
  );
}

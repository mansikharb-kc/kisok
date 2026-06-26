// Brand page — shows brands and products matching selected brand using static JSON data
import BrandGrid from "@/components/rms/BrandGrid";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export default async function RmsBrandPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { brand?: string; rack?: string };
}) {
  const filePath = path.join(process.cwd(), "prisma", "scr_b_data.json");
  if (!fs.existsSync(filePath)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f5fa] p-8 text-center">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Static data not found</h1>
          <p className="mt-2 text-sm text-slate-500">Run the dump script to generate scr_b_data.json.</p>
        </div>
      </div>
    );
  }

  const fileData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const branchName = fileData.branchName || "KC Broadway";
  const dbProducts = fileData.products || [];

  // 1. Calculate stats for all brands
  const brandStats = new Map<string, { name: string; code: string; categoryIds: Set<string>; total: number }>();
  for (const p of dbProducts) {
    if (!p.brandId) continue;
    const bId = p.brandId;
    if (!brandStats.has(bId)) {
      brandStats.set(bId, { name: p.brandName, code: p.brandCode || "", categoryIds: new Set(), total: 0 });
    }
    const stats = brandStats.get(bId)!;
    stats.total += 1;
    if (p.categoryId) stats.categoryIds.add(p.categoryId);
  }

  const brandsList = [...brandStats.entries()].map(([id, stats]) => ({
    id,
    name: stats.name,
    code: stats.code,
    materialTypeCount: stats.categoryIds.size,
    totalProductsCount: stats.total,
    blockName: null
  }));

  // 2. Fetch products of the selected brand
  let selectedBrand = null;
  let products: any[] = [];

  if (searchParams.brand) {
    const brandId = searchParams.brand;
    const stats = brandStats.get(brandId);

    if (stats) {
      selectedBrand = {
        id: brandId,
        name: stats.name,
        code: stats.code,
        bannerUrl: null,
        materialTypeCount: stats.categoryIds.size,
        totalProductsCount: stats.total,
        blockName: null,
      };

      const brandProducts = dbProducts.filter((p: any) => p.brandId === brandId);
      products = brandProducts.map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        categoryName: p.categoryName || "Category",
        categoryId: p.categoryId || "",
        locations: p.locations || []
      }));
    }
  }

  return (
    <BrandGrid
      token={params.token}
      branchName={branchName}
      brands={brandsList}
      selectedBrand={selectedBrand}
      products={products}
    />
  );
}

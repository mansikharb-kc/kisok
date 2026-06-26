// Category page — shows products/brands for a chosen category using static JSON data
import CategoryGrid from "@/components/rms/CategoryGrid";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export default async function RmsCategoryPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { cat?: string; brand?: string };
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
  const allCategories = fileData.categories || [];
  const dbProducts = fileData.products || [];

  let selectedCategory: any = null;
  let subCategories: any[] = [];
  let products: any[] = [];
  let categoryBrands: any[] = [];
  let brandName = "";
  let categoriesList: any[] = [];

  if (searchParams.cat && !searchParams.cat.startsWith('parent:')) {
    const catId = searchParams.cat;

    // Find category metadata
    const currentCat = allCategories.find((c: any) => c.id === catId);
    if (currentCat) {
      const parentCat = currentCat.parentId
        ? allCategories.find((c: any) => c.id === currentCat.parentId)
        : null;

      selectedCategory = {
        id: currentCat.id,
        name: currentCat.name,
        code: currentCat.code,
        parentId: currentCat.parentId,
        parent: parentCat ? { id: parentCat.id, name: parentCat.name } : null
      };
    } else {
      // Create fallback if not found in metadata
      // Find category name from products list
      const pMatch = dbProducts.find((p: any) => p.categoryId === catId);
      selectedCategory = {
        id: catId,
        name: pMatch ? pMatch.categoryName : "Category",
        code: "",
        parentId: null,
        parent: null
      };
    }

    // Subcategories: categories that have this parentId
    subCategories = allCategories
      .filter((c: any) => c.parentId === catId)
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        code: c.code
      }));

    // All active categories
    categoriesList = allCategories;

    // Filter products by category
    const catProducts = dbProducts.filter((p: any) => p.categoryId === catId);
    const filteredProducts = searchParams.brand
      ? catProducts.filter((p: any) => p.brandId === searchParams.brand)
      : catProducts;

    // Build brand list from products in this category
    const catBrandMap = new Map<string, { id: string; name: string; code: string; productCount: number }>();
    for (const p of catProducts) {
      if (!p.brandId) continue;
      const bId = p.brandId;
      if (!catBrandMap.has(bId)) {
        catBrandMap.set(bId, { id: bId, name: p.brandName, code: p.brandCode || "", productCount: 0 });
      }
      catBrandMap.get(bId)!.productCount += 1;
    }

    // Material type count count per brand
    const brandCatCount = new Map<string, Set<string>>();
    for (const p of dbProducts) {
      if (!p.brandId || !p.categoryId) continue;
      const bId = p.brandId;
      if (!brandCatCount.has(bId)) brandCatCount.set(bId, new Set());
      brandCatCount.get(bId)!.add(p.categoryId);
    }

    categoryBrands = [...catBrandMap.values()].map((b) => ({
      id: b.id,
      name: b.name,
      code: b.code,
      materialTypeCount: brandCatCount.get(b.id)?.size || 1,
      totalProductsCount: b.productCount,
    }));

    if (searchParams.brand) {
      const match = dbProducts.find((p: any) => p.brandId === searchParams.brand);
      brandName = match ? match.brandName : "";
    }

    products = filteredProducts.map((p: any) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      brandId: p.brandId,
      brandName: p.brandName,
      locations: p.locations || []
    }));
  } else {
    // No category selected — show all categories that have products
    const catIds = new Set(dbProducts.map((p: any) => p.categoryId).filter(Boolean));
    categoriesList = allCategories.filter((c: any) => catIds.has(c.id));
  }

  return (
    <CategoryGrid
      token={params.token}
      branchName={branchName}
      categories={categoriesList}
      selectedCategory={selectedCategory}
      subCategories={subCategories}
      products={products}
      brandName={brandName}
      brands={categoryBrands}
    />
  );
}

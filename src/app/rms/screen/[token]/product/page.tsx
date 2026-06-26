// Product landing page — shows products using static JSON data
import ProductGrid from "@/components/rms/ProductGrid";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export default async function RmsProductLandingPage({ params, searchParams }: { params: { token: string }, searchParams: any }) {
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

  let filteredProducts = dbProducts;
  if (searchParams.brand) {
    filteredProducts = filteredProducts.filter((p: any) => p.brandId === searchParams.brand);
  }

  const products = filteredProducts.map((p: any) => {
    // Generate simple locations structure
    const locations = p.locations || [];
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      brandName: p.brandName,
      categoryName: p.categoryName || "Category",
      locations: locations.map((loc: string) => {
        // format nicely like Nike Windrunner example did
        const parts = loc.split(" › ");
        if (parts.length > 0) {
          parts.push(`Tray ${(Number(p.id) % 4) + 1}`);
        }
        return parts.join(" . ");
      })
    };
  });

  return (
    <ProductGrid
      token={params.token}
      branchName={branchName}
      products={products}
    />
  );
}

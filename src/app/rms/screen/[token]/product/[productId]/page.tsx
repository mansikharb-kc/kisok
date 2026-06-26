// Product detail page — loads detail completely from static JSON file
import ProductDetail from "@/components/rms/ProductDetail";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export default async function RmsProductPage({
  params,
}: {
  params: { token: string; productId: string };
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
  const dbProducts = fileData.products || [];

  const rawProduct = dbProducts.find((p: any) => p.id === params.productId);

  if (!rawProduct) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f5fa] p-8 text-center">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Product not found</h1>
          <p className="mt-2 text-sm text-slate-500">The requested product could not be found.</p>
        </div>
      </div>
    );
  }

  // Format product to match the exact schema expected by ProductDetail
  const product = {
    id: rawProduct.id,
    name: rawProduct.name,
    sku: rawProduct.sku,
    brandId: rawProduct.brandId,
    brand: {
      id: rawProduct.brandId,
      name: rawProduct.brandName
    },
    category: {
      id: rawProduct.categoryId || "",
      name: rawProduct.categoryName || ""
    },
    attrValues: (rawProduct.attrValues || []).map((av: any) => ({
      attribute: {
        name: av.attribute?.name || "",
        code: av.attribute?.code || "",
        dataType: av.attribute?.dataType || "text",
        unit: av.attribute?.unit || null
      },
      option: av.option ? { optionValue: av.option.optionValue } : null
    })),
    // Convert location strings to the location hierarchy format expected
    copies: (rawProduct.locations || []).map((locStr: string, idx: number) => {
      const parts = locStr.split(" › ");
      return {
        id: `copy-${idx}`,
        location: {
          id: `loc-${idx}`,
          name: parts[parts.length - 1] || "",
          nodeType: "SHELF",
          parent: {
            id: `parent-${idx}`,
            name: parts[parts.length - 2] || "",
            nodeType: "RACK",
            parent: {
              id: `gparent-${idx}`,
              name: parts[parts.length - 3] || "",
              nodeType: "BLOCK",
              parent: null
            }
          }
        }
      };
    })
  };

  const similarProducts = rawProduct.similar || [];

  return (
    <ProductDetail
      token={params.token}
      productId={params.productId}
      product={product as any}
      similarProducts={similarProducts as any[]}
    />
  );
}

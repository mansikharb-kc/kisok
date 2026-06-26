import { prisma, serialize } from "@/lib/prisma";
import ProductDetail from "@/components/rms/ProductDetail";

export const dynamic = "force-dynamic";

export default async function RmsProductPage({
  params,
}: {
  params: { token: string; productId: string };
}) {
  const branchId = 1; // Default fallback branch ID
  
  // 1. Fetch screen and branch context
  const screen = await prisma.screen.findFirst({
    where: { token: params.token },
    include: {
      branch: { select: { id: true, name: true } },
    },
  });

  const activeBranchId = screen?.branch.id ?? branchId;

  // 2. Fetch BrandProduct
  const product = await prisma.brandProduct.findUnique({
    where: { id: BigInt(params.productId) },
    include: {
      brand: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      attrValues: {
        include: {
          attribute: { select: { name: true, code: true, dataType: true, unit: true } },
          option: { select: { optionValue: true } },
        },
      },
      copies: {
        where: { branchId: activeBranchId, status: "active" },
        include: {
          location: {
            select: {
              id: true,
              name: true,
              nodeType: true,
              parent: {
                select: {
                  id: true,
                  name: true,
                  nodeType: true,
                  parent: {
                    select: {
                      id: true,
                      name: true,
                      nodeType: true,
                      parent: {
                        select: {
                          id: true,
                          name: true,
                          nodeType: true,
                          parent: {
                            select: {
                              id: true,
                              name: true,
                              nodeType: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!product) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f5fa] p-8 text-center">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Product not found</h1>
          <p className="mt-2 text-sm text-slate-500">The requested product could not be found.</p>
        </div>
      </div>
    );
  }

  // 3. Fetch similar products (same brand, limit 4)
  const similarProducts = await prisma.brandProduct.findMany({
    where: {
      brandId: product.brandId,
      id: { not: product.id },
      status: "active",
      copies: {
        some: { branchId: activeBranchId, status: "active" },
      },
    },
    take: 8,
    select: {
      id: true,
      name: true,
      sku: true,
      copies: {
        where: { branchId: activeBranchId, status: "active" },
        select: {
          location: {
            select: {
              name: true,
              nodeType: true,
              parent: {
                select: {
                  name: true,
                  nodeType: true,
                  parent: { select: { name: true, nodeType: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const specs = (product.attrValues || []).map((av: any) => {
    const val = av.option?.optionValue ?? av.valueText ?? (av.valueNumber !== null ? String(av.valueNumber) : null) ?? "—";
    const unit = av.attribute.unit ? ` ${av.attribute.unit}` : "";
    return {
      name: av.attribute.name,
      value: `${val}${unit}`,
    };
  });

  const serializedProduct = serialize({
    id: product.id,
    name: product.name,
    sku: product.sku,
    brand: product.brand,
    category: product.category,
    specs,
    copies: product.copies,
  });

  const sSimilarProducts = serialize(similarProducts);

  return (
    <ProductDetail
      token={params.token}
      productId={params.productId}
      product={serializedProduct as any}
      similarProducts={sSimilarProducts}
    />
  );
}


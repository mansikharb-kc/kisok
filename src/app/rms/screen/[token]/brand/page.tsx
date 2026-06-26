import { prisma, serialize } from "@/lib/prisma";
import BrandGrid from "@/components/rms/BrandGrid";

export const dynamic = "force-dynamic";

export default async function RmsBrandPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { brand?: string; rack?: string };
}) {
  // 1. Fetch screen and branch context
  const screen = await prisma.screen.findFirst({
    where: { token: params.token },
    include: {
      branch: { select: { id: true, name: true } },
    },
  });

  if (!screen) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f5fa] p-8 text-center">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Screen not found</h1>
          <p className="mt-2 text-sm text-slate-500">This kiosk URL is not configured.</p>
        </div>
      </div>
    );
  }

  const branchId = screen.branch.id;

  // Resolve active parent BLOCK from rack parameter
  let blockId: bigint | null = null;
  let blockName: string | null = null;
  let descendantIds: bigint[] = [];

  if (searchParams.rack) {
    let currentNodeId = BigInt(searchParams.rack);
    while (currentNodeId) {
      const node = await prisma.locationNode.findUnique({
        where: { id: currentNodeId },
        select: {
          id: true,
          name: true,
          nodeType: true,
          parentId: true,
        }
      });
      if (!node) break;
      if (node.nodeType?.toUpperCase() === "BLOCK") {
        blockId = node.id;
        blockName = node.name;
        break;
      }
      if (!node.parentId) {
        blockId = node.id;
        blockName = node.name;
        break;
      }
      currentNodeId = node.parentId;
    }

    if (blockId) {
      const ids: bigint[] = [blockId];
      let currentParentIds = [blockId];
      while (currentParentIds.length > 0) {
        const children = await prisma.locationNode.findMany({
          where: {
            parentId: { in: currentParentIds },
            status: "active"
          },
          select: { id: true }
        });
        if (children.length === 0) break;
        const childIds = children.map((c: any) => c.id);
        ids.push(...childIds);
        currentParentIds = childIds;
      }
      descendantIds = ids;
    }
  }

  const copiesFilter: any = {
    branchId,
    status: "active",
  };
  if (descendantIds.length > 0) {
    copiesFilter.locationNodeId = { in: descendantIds };
  }

  // 2. Fetch brands linked to this branch and calculate stats
  const [branchBrands, allProducts] = await Promise.all([
    prisma.branchBrand.findMany({
      where: { branchId },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    }),
    prisma.brandProduct.findMany({
      where: {
        status: "active",
        copies: {
          some: copiesFilter
        }
      },
      select: {
        brandId: true,
        categoryId: true
      }
    })
  ]);

  const brandStats = new Map<string, { categoryIds: Set<string>; total: number }>();
  for (const p of allProducts) {
    const bId = String(p.brandId);
    if (!brandStats.has(bId)) {
      brandStats.set(bId, { categoryIds: new Set(), total: 0 });
    }
    const stats = brandStats.get(bId)!;
    stats.total += 1;
    if (p.categoryId) stats.categoryIds.add(String(p.categoryId));
  }

  const brandsList = branchBrands.map((bb) => {
    const stats = brandStats.get(String(bb.brand.id)) || { categoryIds: new Set(), total: 0 };
    return {
      id: String(bb.brand.id),
      name: bb.brand.name,
      code: bb.brand.code,
      materialTypeCount: stats.categoryIds.size,
      totalProductsCount: stats.total,
      blockName: blockName,
    };
  });

  // 3. Fetch products of the selected brand
  let selectedBrand = null;
  let products: any[] = [];

  if (searchParams.brand) {
    const brandId = BigInt(searchParams.brand);

    const rawBrand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: {
        id: true,
        name: true,
        code: true,
        logo: {
          select: {
            url: true,
          },
        },
      },
    });

    if (rawBrand) {
      const stats = brandStats.get(String(rawBrand.id)) || { categoryIds: new Set(), total: 0 };
      selectedBrand = {
        id: String(rawBrand.id),
        name: rawBrand.name,
        code: rawBrand.code,
        bannerUrl: rawBrand.logo?.url || null,
        materialTypeCount: stats.categoryIds.size,
        totalProductsCount: stats.total,
        blockName: blockName,
      };

      const dbProducts = await prisma.brandProduct.findMany({
        where: {
          brandId,
          status: "active",
          copies: {
            some: copiesFilter,
          },
        },
        include: {
          category: { select: { id: true, name: true } },
          copies: {
            where: copiesFilter,
            select: {
              location: {
                select: {
                  name: true,
                  parent: {
                    select: {
                      name: true,
                      parent: {
                        select: {
                          name: true,
                          parent: {
                            select: {
                              name: true,
                              parent: {
                                select: {
                                  name: true,
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

      const buildLocationPath = (loc: any, productId?: bigint): string => {
        const parts: string[] = [];
        let curr = loc;
        while (curr) {
          if (curr.name) parts.unshift(curr.name);
          curr = curr.parent;
        }
        if (productId !== undefined) {
           const trayNum = (Number(productId) % 4) + 1;
           parts.push(`Tray ${trayNum}`);
        }
        return parts.join(" › ");
      };

      products = dbProducts.map((p) => {
        const locationsSet = new Set<string>();
        for (const c of p.copies) {
          if (c.location) {
            locationsSet.add(buildLocationPath(c.location, p.id));
          }
        }

        return {
          id: String(p.id),
          name: p.name,
          sku: p.sku,
          categoryName: p.category.name,
          categoryId: String(p.category.id),
          locations: Array.from(locationsSet),
        };
      });
    }
  }

  const sBranch = serialize(screen.branch);
  const sBrandsList = serialize(brandsList);
  const sSelectedBrand = serialize(selectedBrand);
  const sProducts = serialize(products);

  return (
    <BrandGrid
      token={params.token}
      branchName={sBranch.name}
      brands={sBrandsList}
      selectedBrand={sSelectedBrand}
      products={sProducts}
    />
  );
}


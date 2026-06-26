import { prisma, serialize } from "@/lib/prisma";
import CategoryGrid from "@/components/rms/CategoryGrid";

export const dynamic = "force-dynamic";

export default async function RmsCategoryPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { cat?: string; brand?: string; rack?: string };
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
  const branchName = screen.branch.name;

  // 2. Fetch categories linked to the branch and brand statistics in branch
  const [allCategories, allProductsInBranch] = await Promise.all([
    prisma.category.findMany({
      where: { status: "active" },
      select: {
        id: true,
        name: true,
        code: true,
        parentId: true,
      },
    }),
    prisma.brandProduct.findMany({
      where: {
        status: "active",
        copies: {
          some: {
            branchId,
            status: "active"
          }
        }
      },
      select: {
        brandId: true,
        categoryId: true
      }
    })
  ]);

  const brandStats = new Map<string, { categoryIds: Set<string>; total: number }>();
  for (const p of allProductsInBranch) {
    const bId = String(p.brandId);
    if (!brandStats.has(bId)) {
      brandStats.set(bId, { categoryIds: new Set(), total: 0 });
    }
    const stats = brandStats.get(bId)!;
    stats.total += 1;
    if (p.categoryId) stats.categoryIds.add(String(p.categoryId));
  }

  // Extract all categories of interest
  let categoriesList = allCategories;

  // 3. Fetch selected category details if provided
  let selectedCategory = null;
  let products: any[] = [];
  let subCategories: any[] = [];
  let categoryBrands: any[] = [];
  let brandName = "";

  if (searchParams.cat || searchParams.brand) {
    let catId: bigint | null = null;
    if (searchParams.cat) {
      catId = BigInt(searchParams.cat);
      
      // Fetch current category info
      selectedCategory = await prisma.category.findUnique({
        where: { id: catId },
        include: {
          parent: { select: { id: true, name: true } },
        },
      });

      if (selectedCategory) {
        // Fetch subcategories
        subCategories = await prisma.category.findMany({
          where: { parentId: catId, status: "active" },
          select: { id: true, name: true, code: true },
        });
      }
    }

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
      if (searchParams.cat && searchParams.rack) {
        copiesFilter.locationNodeId = BigInt(searchParams.rack);
      } else if (descendantIds.length > 0) {
        copiesFilter.locationNodeId = { in: descendantIds };
      }

      const productWhere: any = {
        status: "active",
        copies: {
          some: copiesFilter,
        },
      };
      if (catId) {
        productWhere.categoryId = catId;
      }
      if (searchParams.brand) {
        productWhere.brandId = BigInt(searchParams.brand);
      }

      // Fetch products in this category (with copies available in the specific block/rack)
      const dbProducts = await prisma.brandProduct.findMany({
        where: productWhere,
        include: {
          brand: { select: { id: true, name: true, code: true } },
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

      // Fetch all products in this block/rack to compute brand stats
      const rackAllProducts = await prisma.brandProduct.findMany({
        where: {
          status: "active",
          copies: {
            some: copiesFilter,
          },
        },
        select: { brandId: true, categoryId: true },
      });

      // Build block/rack-specific brand stats (categories per brand within this block/rack)
      const rackBrandStats = new Map<string, { categoryIds: Set<string>; total: number }>();
      for (const p of rackAllProducts) {
        const bId = String(p.brandId);
        if (!rackBrandStats.has(bId)) rackBrandStats.set(bId, { categoryIds: new Set(), total: 0 });
        const s = rackBrandStats.get(bId)!;
        s.total += 1;
        if (p.categoryId) s.categoryIds.add(String(p.categoryId));
      }

      // Calculate brands available in this category
      const categoryBrandMap = new Map<string, { id: string; name: string; code: string; productCount: number }>();
      for (const p of dbProducts) {
        const bId = String(p.brand.id);
        if (!categoryBrandMap.has(bId)) {
          categoryBrandMap.set(bId, { id: bId, name: p.brand.name, code: p.brand.code || "", productCount: 0 });
        }
        categoryBrandMap.get(bId)!.productCount += 1;
      }

      categoryBrands = [...categoryBrandMap.values()].map((b) => ({
        id: b.id,
        name: b.name,
        code: b.code,
        // Use rack-specific category count so badge reflects this rack, not whole branch
        materialTypeCount: rackBrandStats.get(b.id)?.categoryIds.size || 1,
        totalProductsCount: b.productCount
      }));

      // Filter products by brand parameter if present
      let filteredDbProducts = dbProducts;
      if (searchParams.brand) {
        const brandId = BigInt(searchParams.brand);
        filteredDbProducts = dbProducts.filter((p) => p.brandId === brandId);
        
        const brand = await prisma.brand.findUnique({
          where: { id: brandId },
          select: { name: true }
        });
        brandName = brand?.name || "";
      }

      // Filter categoriesList to only include those that have products in this block/brand (and their parents)
      const validCategoryIds = new Set<string>();
      for (const p of filteredDbProducts) {
        let currentCatId = p.categoryId ? String(p.categoryId) : null;
        while (currentCatId) {
          validCategoryIds.add(currentCatId);
          const cat = categoriesList.find((c) => String(c.id) === currentCatId);
          currentCatId = cat?.parentId ? String(cat.parentId) : null;
        }
      }
      if (filteredDbProducts.length > 0) {
        categoriesList = categoriesList.filter((c) => validCategoryIds.has(String(c.id)));
      } else {
        categoriesList = [];
      }

      const buildLocationPath = (loc: any, productId?: bigint): string => {
        const parts: string[] = [];
        let curr = loc;
        while (curr) {
          if (curr.name) parts.unshift(curr.name);
          curr = curr.parent;
        }
        // Simulate Tray assignment for UI demo
        if (productId !== undefined) {
           const trayNum = (Number(productId) % 4) + 1;
           parts.push(`Tray ${trayNum}`);
        }
        return parts.join(" › ");
      };

      products = filteredDbProducts.map((p) => {
        // Group placement nodes for display
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
          brandId: String(p.brandId),
          brandName: p.brand.name,
          locations: Array.from(locationsSet),
        };
      });
  }

  const sBranch = serialize(screen.branch);
  const sCategoriesList = serialize(categoriesList);
  const sSelectedCategory = serialize(selectedCategory);
  const sSubCategories = serialize(subCategories);
  const sProducts = serialize(products);
  const sCategoryBrands = serialize(categoryBrands);

  return (
    <CategoryGrid
      token={params.token}
      branchName={sBranch.name}
      categories={sCategoriesList}
      selectedCategory={sSelectedCategory}
      subCategories={sSubCategories}
      products={sProducts}
      brandName={brandName}
      brands={sCategoryBrands}
    />
  );
}

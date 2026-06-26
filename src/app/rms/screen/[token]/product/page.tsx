import { prisma, serialize } from "@/lib/prisma";
import ProductGrid from "@/components/rms/ProductGrid";

export const dynamic = "force-dynamic";

export default async function RmsProductLandingPage({ params, searchParams }: { params: { token: string }, searchParams: any }) {
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
  let descendantIds: bigint[] = [];

  if (searchParams.rack) {
    let currentNodeId = BigInt(searchParams.rack);
    while (currentNodeId) {
      const node = await prisma.locationNode.findUnique({
        where: { id: currentNodeId },
        select: {
          id: true,
          nodeType: true,
          parentId: true,
        }
      });
      if (!node) break;
      if (node.nodeType?.toUpperCase() === "BLOCK") {
        blockId = node.id;
        break;
      }
      if (!node.parentId) {
        blockId = node.id;
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

  let copiesFilter: any = {
    branchId,
    status: "active",
  };
  if (descendantIds.length > 0) {
    copiesFilter.locationNodeId = { in: descendantIds };
  }

  const productWhere: any = {
    status: "active",
    copies: {
      some: copiesFilter,
    },
  };
  
  if (searchParams.brand) {
    productWhere.brandId = BigInt(searchParams.brand);
  }

  // 2. Fetch all products matching the criteria
  const dbProducts = await prisma.brandProduct.findMany({
    where: productWhere,
    include: {
      brand: { select: { name: true } },
      category: { select: { name: true } },
      copies: {
        where: copiesFilter,
        select: {
          location: {
            select: {
              name: true,
              parent: { select: { name: true, parent: { select: { name: true } } } },
            },
          },
        },
      },
    },
  });

  const products = dbProducts.map((p) => {
    const locationsSet = new Set<string>();
    for (const c of p.copies) {
      if (c.location) {
        const pathStr = [
          c.location.parent?.parent?.name,
          c.location.parent?.name,
          c.location.name,
          `Tray ${(Number(p.id) % 4) + 1}`
        ]
          .filter(Boolean)
          .join(" . ");
        locationsSet.add(pathStr);
      }
    }

    return {
      id: String(p.id),
      name: p.name,
      sku: p.sku,
      brandName: p.brand.name,
      categoryName: p.category.name,
      locations: Array.from(locationsSet),
    };
  });

  const sBranch = serialize(screen.branch);
  const sProducts = serialize(products);

  return (
    <ProductGrid
      token={params.token}
      branchName={sBranch.name}
      products={sProducts}
    />
  );
}

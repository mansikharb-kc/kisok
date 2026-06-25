// RMS Kiosk Home — "What's in this Rack": categories present across the screen's racks,
// each with product count, brand count, and the brands available. Phase: P1.2
import { prisma, serialize } from "@/lib/prisma";
import KioskHome from "@/components/rms/KioskHome";

export const dynamic = "force-dynamic";

export default async function RmsHomePage({ params }: { params: { token: string } }) {
  const screen = await prisma.screen.findFirst({
    where: { token: params.token },
    include: {
      branch: { select: { name: true } },
      racks: {
        include: {
          rack: {
            select: {
              id: true,
              name: true,
              parent: { select: { id: true, name: true, parent: { select: { name: true } } } },
              copies: {
                where: { status: "active" },
                select: {
                  product: {
                    select: {
                      brandId: true,
                      brand: { select: { name: true } },
                      category: { select: { id: true, name: true } },
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

  if (!screen) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f5fa] p-8 text-center">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Screen not found</h1>
          <p className="mt-2 text-sm text-slate-500">This kiosk URL is not configured. Check the token.</p>
        </div>
      </div>
    );
  }

  const s = serialize(screen) as any;

  // Per-rack categories (the kiosk lets the viewer pick a rack; "What's in this Rack"
  // shows the selected rack's categories with product/brand counts).
  const racks = (s.racks ?? []).map((sr: any) => {
    const rack = sr.rack;
    const block = rack?.parent ?? null;
    const catMap = new Map<string, { id: string; name: string; productCount: number; brands: Map<string, string> }>();
    for (const c of rack?.copies ?? []) {
      const cat = c.product?.category;
      if (!cat) continue;
      const key = String(cat.id);
      if (!catMap.has(key)) catMap.set(key, { id: key, name: cat.name, productCount: 0, brands: new Map() });
      const entry = catMap.get(key)!;
      entry.productCount += 1;
      if (c.product?.brandId) entry.brands.set(String(c.product.brandId), c.product.brand?.name ?? "Brand");
    }
    return {
      id: String(rack.id),
      name: rack.name,
      blockId: block?.id ? String(block.id) : null,
      blockName: block?.name ?? null,
      floorName: block?.parent?.name ?? null,
      categories: [...catMap.values()].map((c) => ({
        id: c.id,
        name: c.name,
        productCount: c.productCount,
        brandCount: c.brands.size,
        brands: [...c.brands.values()],
      })),
    };
  });

  return <KioskHome token={params.token} branchName={s.branch?.name ?? "KC"} racks={racks} />;
}

// Home screen — parses category names using "&" as parent/sub separator
// Loads data completely from static JSON file
import KioskHome from "@/components/rms/KioskHome";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export default async function RmsHomePage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { rack?: string };
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

  // 1. Parse category names using "&" to build a 2-level hierarchy
  type ParsedCat = {
    catId: string;
    rawName: string;
    parentName: string;
    subName: string | null;
  };

  const catParsedMap = new Map<string, ParsedCat>(); // catId → parsed
  for (const p of dbProducts) {
    if (!p.categoryId || !p.categoryName) continue;
    const cid = String(p.categoryId);
    if (catParsedMap.has(cid)) continue;
    const rawName = p.categoryName;
    const ampIdx = rawName.indexOf(" & ");
    if (ampIdx !== -1) {
      catParsedMap.set(cid, {
        catId: cid,
        rawName,
        parentName: rawName.slice(0, ampIdx).trim(),
        subName: rawName.slice(ampIdx + 3).trim(),
      });
    } else {
      catParsedMap.set(cid, {
        catId: cid,
        rawName,
        parentName: rawName.trim(),
        subName: null,
      });
    }
  }

  // 2. Build grouped parent → subcategory map with product/brand counts
  type SubCatInfo = {
    catId: string;
    name: string; // the sub name (or full name if no &)
    rawName: string;
    productCount: number;
    brandIds: Set<string>;
    brandNames: Map<string, string>;
  };
  type ParentCatInfo = {
    parentName: string;
    subCats: Map<string, SubCatInfo>; // subName (or catId) → info
    productCount: number;
    brandIds: Set<string>;
    brandNames: Map<string, string>;
  };

  const parentMap = new Map<string, ParentCatInfo>();

  for (const p of dbProducts) {
    if (!p.categoryId || !p.categoryName) continue;
    const cid = String(p.categoryId);
    const parsed = catParsedMap.get(cid);
    if (!parsed) continue;
    const bId = String(p.brandId);
    const bName = p.brandName ?? "";

    if (!parentMap.has(parsed.parentName)) {
      parentMap.set(parsed.parentName, {
        parentName: parsed.parentName,
        subCats: new Map(),
        productCount: 0,
        brandIds: new Set(),
        brandNames: new Map(),
      });
    }

    const parent = parentMap.get(parsed.parentName)!;
    parent.productCount++;
    parent.brandIds.add(bId);
    parent.brandNames.set(bId, bName);

    // Sub category key: use subName if present, else use catId for uniqueness
    const subKey = parsed.subName ?? cid;
    const subDisplayName = parsed.subName ?? parsed.parentName;

    if (!parent.subCats.has(subKey)) {
      parent.subCats.set(subKey, {
        catId: cid,
        name: subDisplayName,
        rawName: parsed.rawName,
        productCount: 0,
        brandIds: new Set(),
        brandNames: new Map(),
      });
    }
    const sub = parent.subCats.get(subKey)!;
    sub.productCount++;
    sub.brandIds.add(bId);
    sub.brandNames.set(bId, bName);
  }

  // 3. Build final categories array for KioskHome
  const categories = [...parentMap.values()]
    .map((parent) => {
      const subCats = [...parent.subCats.values()]
        .map((s) => ({
          catId: s.catId,
          name: s.name,
          rawName: s.rawName,
          productCount: s.productCount,
          brandCount: s.brandIds.size,
          brands: [...s.brandIds].slice(0, 3).map((bId) => ({
            id: bId,
            name: s.brandNames.get(bId) ?? "",
          })),
        }))
        .sort((a, b) => b.productCount - a.productCount);

      const topBrands = [...parent.brandIds].slice(0, 3).map((bId) => ({
        id: bId,
        name: parent.brandNames.get(bId) ?? "",
      }));

      // hasSubCategories: true if there is more than one sub OR the single sub has a different name than parent
      const hasSubCategories =
        subCats.length > 1 ||
        (subCats.length === 1 && subCats[0].name !== parent.parentName);

      return {
        id: `parent:${parent.parentName}`, // virtual ID for navigation
        name: parent.parentName,
        productCount: parent.productCount,
        brandCount: parent.brandIds.size,
        brands: topBrands,
        hasSubCategories,
        subCategories: hasSubCategories ? subCats : [],
        // If no sub, link directly to the single catId
        directCatId: !hasSubCategories && subCats.length === 1 ? subCats[0].catId : null,
      };
    })
    .sort((a, b) => b.productCount - a.productCount);

  // Group products by unique rack locations
  const rackMap = new Map<string, { id: string; displayName: string; products: typeof dbProducts }>();
  for (const p of dbProducts) {
    if (!p.locations) continue;
    for (const loc of p.locations) {
      if (!loc) continue;
      if (!rackMap.has(loc)) {
        rackMap.set(loc, {
          id: loc,
          displayName: loc.replace(/ › /g, " • "),
          products: [],
        });
      }
      rackMap.get(loc)!.products.push(p);
    }
  }

  const racks = [...rackMap.values()].map((r) => {
    // Group products in this rack by category
    const catMap = new Map<string, { id: string; name: string; products: typeof dbProducts; brandIds: Set<string>; brandNames: Map<string, string> }>();
    for (const p of r.products) {
      if (!p.categoryId || !p.categoryName) continue;
      const cid = String(p.categoryId);
      const bId = String(p.brandId);
      const bName = p.brandName ?? "";
      if (!catMap.has(cid)) {
        catMap.set(cid, {
          id: cid,
          name: p.categoryName,
          products: [],
          brandIds: new Set(),
          brandNames: new Map(),
        });
      }
      const c = catMap.get(cid)!;
      c.products.push(p);
      c.brandIds.add(bId);
      c.brandNames.set(bId, bName);
    }

    const categoriesInRack = [...catMap.values()].map((c) => ({
      id: c.id,
      name: c.name,
      productCount: c.products.length,
      brandCount: c.brandIds.size,
      brands: [...c.brandIds].slice(0, 3).map((bId) => ({
        id: bId,
        name: c.brandNames.get(bId) ?? "",
      })),
    })).sort((a, b) => b.productCount - a.productCount);

    return {
      id: r.id,
      displayName: r.displayName,
      categories: categoriesInRack,
    };
  }).sort((a, b) => a.id.localeCompare(b.id));

  return (
    <KioskHome
      token={params.token}
      branchName={branchName}
      categories={categories}
      racks={racks}
      initialRackId={searchParams.rack}
    />
  );
}

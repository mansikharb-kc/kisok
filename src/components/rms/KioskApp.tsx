"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Category = { id: string; name: string; parentId: string | null; productCount: number; brandCount: number };
type Brand = { id: string; name: string; categoryCount: number };
type Attribute = { name: string; value: string | number; unit: string };
type Product = {
  id: string; name: string; sku: string;
  brandId: string; brandName: string;
  categoryId: string; categoryName: string;
  location: string; instanceCode: string;
  attributes: Attribute[];
};

type View =
  | { type: "home"; parentId: string | null }
  | { type: "category"; catId: string }
  | { type: "brand"; brandId: string; catId?: string }
  | { type: "product"; productId: string };

// ─── Gradient palette ─────────────────────────────────────────────────────────
const GRADIENTS = [
  ["#1a052e","#4b1f7c"], ["#0f2027","#2d6186"], ["#2c3e50","#4a6274"],
  ["#3d1c6b","#7b4fa3"], ["#0d3b2f","#1a7a5e"], ["#1f1c2c","#5c5891"],
  ["#3b1e08","#8b5e3c"], ["#1b2838","#2d6186"], ["#4a0e3c","#8b1a5e"],
  ["#0a2342","#1b5e99"], ["#2d0a00","#6b3500"], ["#001f3f","#004080"],
];

function grad(idx: number) {
  const [a, b] = GRADIENTS[idx % GRADIENTS.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

function cleanCatName(name: string) {
  if (!name) return "";
  return name.split("/").pop()!.trim();
}

function cleanProductName(name: string) {
  if (!name) return "";
  let n = name;
  const colIdx = n.toLowerCase().indexOf(" a collection of");
  if (colIdx !== -1) n = n.slice(0, colIdx);
  const verIdx = n.toLowerCase().indexOf(" version");
  if (verIdx !== -1) n = n.slice(0, verIdx);
  return n.trim().replace(/[-–—\s]+$/, "");
}

// ─── Slide wrapper ────────────────────────────────────────────────────────────
function Slide({ children, visible, dir }: { children: React.ReactNode; visible: boolean; dir: "left" | "right" }) {
  return (
    <div
      className="absolute inset-0 transition-all duration-300 ease-in-out"
      style={{
        transform: visible ? "translateX(0)" : dir === "left" ? "translateX(-100%)" : "translateX(100%)",
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      {children}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function KioskApp({
  token, branchName, categories, products, brands,
}: {
  token: string; branchName: string;
  categories: Category[]; products: Product[]; brands: Brand[];
}) {
  const [history, setHistory] = useState<View[]>([{ type: "home", parentId: null }]);
  const [query, setQuery] = useState("");
  const [addedId, setAddedId] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const currentView = history[history.length - 1];
  const canGoBack = history.length > 1;

  function push(v: View) {
    setQuery("");
    setHistory((h) => [...h, v]);
    contentRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }
  function goBack() {
    setQuery("");
    setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
    contentRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }
  function goHome() {
    setQuery("");
    setHistory([{ type: "home", parentId: null }]);
    contentRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }

  // ── Compute active categories based on current hierarchy level ───────────
  const displayedCategories = useMemo(() => {
    if (currentView.type !== "home") return [];
    const currentParentId = currentView.parentId;
    // Show only direct children of currentParentId (null = root)
    return categories
      .filter((cat) => cat.parentId === currentParentId)
      .sort((a, b) => b.productCount - a.productCount);
  }, [categories, currentView]);

  // ── Data helpers ──────────────────────────────────────────────────────────
  const productsByCat = useMemo(() => {
    const m = new Map<string, Product[]>();
    for (const p of products) {
      if (!m.has(p.categoryId)) m.set(p.categoryId, []);
      m.get(p.categoryId)!.push(p);
    }
    return m;
  }, [products]);

  const productsByBrand = useMemo(() => {
    const m = new Map<string, Product[]>();
    for (const p of products) {
      if (!m.has(p.brandId)) m.set(p.brandId, []);
      m.get(p.brandId)!.push(p);
    }
    return m;
  }, [products]);

  // ── BOM helper ────────────────────────────────────────────────────────────
  function addToBom(p: Product) {
    try {
      const raw = localStorage.getItem("rms_bom");
      const list = raw ? JSON.parse(raw) : [];
      const idx = list.findIndex((x: any) => x.id === p.id);
      if (idx === -1) {
        list.push({ id: p.id, name: p.name, sku: p.sku, brandName: p.brandName, categoryName: p.categoryName, quantity: 1 });
      } else {
        list[idx].quantity += 1;
      }
      localStorage.setItem("rms_bom", JSON.stringify(list));
      window.dispatchEvent(new Event("bom-updated"));
      setAddedId(p.id);
      setTimeout(() => setAddedId(null), 1500);
    } catch {}
  }

  // ── Filtered results for search ───────────────────────────────────────────
  const q = query.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!q) return [];
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brandName.toLowerCase().includes(q) ||
        p.categoryName.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
    ).slice(0, 40);
  }, [products, q]);

  // ── Derive data for current view ──────────────────────────────────────────
  const catView = currentView.type === "category" ? currentView : null;
  const brandView = currentView.type === "brand" ? currentView : null;
  const productView = currentView.type === "product" ? currentView : null;

  const viewProducts = catView
    ? productsByCat.get(catView.catId) ?? []
    : brandView
    ? (productsByBrand.get(brandView.brandId) ?? []).filter(
        (p) => !brandView.catId || p.categoryId === brandView.catId
      )
    : [];

  const selectedProduct = productView
    ? products.find((p) => p.id === productView.productId)
    : null;

  const selectedCat = catView
    ? categories.find((c) => c.id === catView.catId)
    : null;

  const selectedBrand = brandView
    ? brands.find((b) => b.id === brandView.brandId)
    : null;

  // brands in current category
  const brandsInCat = useMemo(() => {
    if (!catView) return [];
    const prods = productsByCat.get(catView.catId) ?? [];
    const bm = new Map<string, { id: string; name: string; count: number }>();
    for (const p of prods) {
      if (!bm.has(p.brandId)) bm.set(p.brandId, { id: p.brandId, name: p.brandName, count: 0 });
      bm.get(p.brandId)!.count++;
    }
    return [...bm.values()].sort((a, b) => b.count - a.count);
  }, [catView, productsByCat]);

  // ── Filter products by query inside a view ────────────────────────────────
  const filteredViewProducts = useMemo(() => {
    if (!q) return viewProducts;
    return viewProducts.filter(
      (p) => p.name.toLowerCase().includes(q) || p.brandName.toLowerCase().includes(q)
    );
  }, [viewProducts, q]);

  // ── Breadcrumb label ──────────────────────────────────────────────────────
  function breadcrumb() {
    const parts: string[] = ["Home"];
    for (const v of history.slice(1)) {
      if (v.type === "home") {
        if (v.parentId) {
          const c = categories.find((c) => c.id === v.parentId);
          if (c) parts.push(cleanCatName(c.name));
        }
      } else if (v.type === "category") {
        const c = categories.find((c) => c.id === v.catId);
        if (c) parts.push(cleanCatName(c.name));
      } else if (v.type === "brand") {
        const b = brands.find((b) => b.id === v.brandId);
        if (b) parts.push(b.name);
      } else if (v.type === "product") {
        const p = products.find((p) => p.id === v.productId);
        if (p) {
          const shortName = cleanProductName(p.name);
          parts.push(shortName.slice(0, 20) + (shortName.length > 20 ? "…" : ""));
        }
      }
    }
    return parts;
  }

  const crumbs = breadcrumb();

  return (
    <div className="mx-auto flex min-h-screen max-w-[480px] flex-col bg-[#fbfaff]">

      {/* ── HEADER ────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-gradient-to-b from-[#1a052e] to-[#2d0f4d] px-4 pb-3 pt-3 text-white shadow-lg">
        {/* Top row: back + title + home */}
        <div className="flex items-center gap-2">
          {canGoBack ? (
            <button type="button" onClick={goBack}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-purple-200 hover:bg-white/20 active:scale-90 transition-all">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          ) : (
            <div className="h-7 w-7 shrink-0 rounded-full bg-white/5 flex items-center justify-center">
              <svg className="h-4 w-4 text-purple-300/60" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="text-[9px] uppercase tracking-widest text-purple-300/70 font-semibold">
              {branchName}
            </div>
            <div className="text-[11px] font-bold text-white truncate">
              {crumbs.join(" › ")}
            </div>
          </div>

          {canGoBack && (
            <button type="button" onClick={goHome}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-purple-200 hover:bg-white/20 active:scale-90 transition-all">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </button>
          )}
        </div>

        {/* Search bar — shown on all views except product detail */}
        {currentView.type !== "product" && (
          <div className="relative mt-2.5">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-purple-400">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                currentView.type === "home"
                  ? "Search all products, brands, categories…"
                  : currentView.type === "category"
                  ? `Search in ${cleanCatName(selectedCat?.name ?? "category")}…`
                  : "Search products…"
              }
              className="w-full rounded-full bg-white/10 py-1.5 pl-9 pr-8 text-[11px] text-white placeholder-purple-200/50 outline-none focus:bg-white/15 transition-colors"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-300/70">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
      </header>

      {/* ── CONTENT ───────────────────────────────────────────────────── */}
      <div ref={contentRef} className="flex-1 overflow-y-auto">

        {/* ── GLOBAL SEARCH RESULTS ── */}
        {q && currentView.type === "home" && (
          <div className="px-4 py-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-4 w-1 rounded-full bg-purple-600" />
              <h2 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-700">
                Results for "{query}"
              </h2>
              <span className="ml-auto rounded-full bg-purple-50 border border-purple-100 px-2 py-0.5 text-[9px] font-bold text-purple-500">
                {searchResults.length}
              </span>
            </div>
            {searchResults.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400">No products found.</div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {searchResults.map((p, i) => (
                  <ProductCard key={p.id} p={p} idx={i} onTap={() => push({ type: "product", productId: p.id })} onBom={() => addToBom(p)} addedId={addedId} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── HOME — Categories grid ── */}
        {!q && currentView.type === "home" && (
          <div className="pb-28">
            {/* Welcome */}
            <div className="px-8 py-6 text-center">
              <img src="/logo.png" alt="KC" className="mx-auto h-12 w-auto object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              <p className="mt-2 text-[11px] font-semibold text-purple-600 tracking-wider">
                Discover Products, Brands &amp; Materials
              </p>
            </div>

            <div className="px-4 mb-3 flex items-center gap-2">
              <span className="h-4 w-1 rounded-full bg-purple-600 shrink-0" />
              <h2 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-700">
                {currentView.parentId ? (cleanCatName(categories.find(c => c.id === currentView.parentId)?.name ?? "Subcategories")) : "All Categories"}
              </h2>
              <span className="ml-auto rounded-full bg-purple-50 border border-purple-100 px-2 py-0.5 text-[9px] font-bold text-purple-500">
                {displayedCategories.length}
              </span>
            </div>

            <div className="px-4 grid grid-cols-2 gap-3">
              {displayedCategories.map((cat, i) => (
                <button key={cat.id} type="button" onClick={() => {
                  const hasSub = categories.some((c) => c.parentId === cat.id);
                  if (hasSub) {
                    push({ type: "home", parentId: cat.id });
                  } else {
                    push({ type: "category", catId: cat.id });
                  }
                }}
                  className="overflow-hidden rounded-2xl border border-slate-100 bg-white text-left shadow-sm transition-all active:scale-[0.96] hover:shadow-md">
                  <div className="relative h-28 flex flex-col justify-between p-3"
                    style={{ background: grad(i) }}>
                    <span className="self-end rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-bold text-white/90">
                      {cat.productCount} products
                    </span>
                    <span className="text-[13px] font-extrabold text-white leading-tight drop-shadow-md line-clamp-2">
                      {cleanCatName(cat.name)}
                    </span>
                  </div>
                  <div className="p-2.5">
                    <div className="text-[9px] text-slate-500 truncate" title={categories.some((c) => c.parentId === cat.id) ? categories.filter((c) => c.parentId === cat.id).map((c) => cleanCatName(c.name)).join(", ") : undefined}>
                      {categories.some((c) => c.parentId === cat.id) ? (
                        <span className="text-purple-600 font-semibold truncate block">
                          {categories
                            .filter((c) => c.parentId === cat.id)
                            .map((c) => cleanCatName(c.name))
                            .join(", ")}
                        </span>
                      ) : (
                        <>
                          <span className="font-bold text-slate-700">{cat.brandCount}</span> Brands
                        </>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── CATEGORY VIEW ── brands grid ── */}
        {currentView.type === "category" && selectedCat && (
          <div className="pb-28">
            {/* Category hero */}
            <div className="h-32 flex flex-col justify-end p-5 relative"
              style={{ background: grad(categories.findIndex((c) => c.id === selectedCat.id)) }}>
              <p className="text-[10px] font-semibold text-white/60 uppercase tracking-wider">Category</p>
              <h1 className="text-xl font-extrabold text-white leading-tight">{cleanCatName(selectedCat.name)}</h1>
              <p className="text-[10px] text-white/70 mt-1">{selectedCat.productCount} products · {selectedCat.brandCount} brands</p>
            </div>

            {q ? (
              /* Search Results within category */
              <div className="px-4 pt-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-4 w-1 rounded-full bg-purple-600 shrink-0" />
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-700">
                    "{query}" results
                  </span>
                  <span className="ml-auto rounded-full bg-purple-50 border border-purple-100 px-2 py-0.5 text-[9px] font-bold text-purple-500">
                    {filteredViewProducts.length}
                  </span>
                </div>

                {filteredViewProducts.length === 0 ? (
                  <div className="py-16 text-center text-xs text-slate-400">No products found.</div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {filteredViewProducts.map((p, i) => (
                      <ProductCard key={p.id} p={p} idx={i}
                        onTap={() => push({ type: "product", productId: p.id })}
                        onBom={() => addToBom(p)} addedId={addedId} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Brands Grid */
              <div className="px-4 pt-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-4 w-1 rounded-full bg-purple-600 shrink-0" />
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-700">
                    Brands in this Category
                  </span>
                  <span className="ml-auto rounded-full bg-purple-50 border border-purple-100 px-2 py-0.5 text-[9px] font-bold text-purple-500">
                    {brandsInCat.length}
                  </span>
                </div>

                {brandsInCat.length === 0 ? (
                  <div className="py-16 text-center text-xs text-slate-400">No brands found.</div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {brandsInCat.map((b, idx) => (
                      <button key={b.id} type="button" onClick={() => push({ type: "brand", brandId: b.id, catId: selectedCat.id })}
                        className="overflow-hidden rounded-2xl border border-slate-100 bg-white text-left shadow-sm transition-all active:scale-[0.96] hover:shadow-md animate-fade-in">
                        <div className="relative h-24 flex flex-col justify-between p-3"
                          style={{ background: grad(idx + 6) }}>
                          <span className="self-end rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-bold text-white/90">
                            {b.count} products
                          </span>
                          <span className="text-[13px] font-extrabold text-white leading-tight drop-shadow-md line-clamp-2">
                            {b.name}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── BRAND VIEW ── products of this brand ── */}
        {currentView.type === "brand" && selectedBrand && (
          <div className="pb-28">
            {/* Brand hero */}
            <div className="h-32 flex flex-col justify-end p-5"
              style={{ background: grad(brands.findIndex((b) => b.id === selectedBrand.id) + 5) }}>
              <p className="text-[10px] font-semibold text-white/60 uppercase tracking-wider">Brand</p>
              <h1 className="text-xl font-extrabold text-white leading-tight">{selectedBrand.name}</h1>
              <p className="text-[10px] text-white/70 mt-1">
                {viewProducts.length} products · {selectedBrand.categoryCount} categories
              </p>
            </div>

            <div className="px-4 pt-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="h-4 w-1 rounded-full bg-purple-600 shrink-0" />
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-700">Products</span>
                <span className="ml-auto rounded-full bg-purple-50 border border-purple-100 px-2 py-0.5 text-[9px] font-bold text-purple-500">
                  {filteredViewProducts.length}
                </span>
              </div>

              {filteredViewProducts.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400">No products found.</div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {filteredViewProducts.map((p, i) => (
                    <ProductCard key={p.id} p={p} idx={i}
                      onTap={() => push({ type: "product", productId: p.id })}
                      onBom={() => addToBom(p)} addedId={addedId} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PRODUCT DETAIL ── */}
        {currentView.type === "product" && selectedProduct && (
          <ProductDetailView
            p={selectedProduct}
            onBom={() => addToBom(selectedProduct)}
            addedId={addedId}
            onBrandTap={() => push({ type: "brand", brandId: selectedProduct.brandId })}
            onCatTap={() => push({ type: "category", catId: selectedProduct.categoryId })}
            relatedProducts={
              (productsByCat.get(selectedProduct.categoryId) ?? [])
                .filter((rp) => rp.id !== selectedProduct.id)
                .slice(0, 6)
            }
            onRelatedTap={(id) => push({ type: "product", productId: id })}
          />
        )}
      </div>
    </div>
  );
}

// ─── Product Card ─────────────────────────────────────────────────────────────
function ProductCard({
  p, idx, onTap, onBom, addedId,
}: {
  p: Product; idx: number;
  onTap: () => void; onBom: () => void; addedId: string | null;
}) {
  const added = addedId === p.id;
  return (
    <div
      className="overflow-hidden rounded-2xl border border-slate-100 bg-white text-left shadow-sm transition-all hover:shadow-md active:scale-[0.97] cursor-pointer flex flex-col"
      onClick={onTap}
    >
      {/* Top gradient */}
      <div className="h-24 flex flex-col justify-end p-2.5" style={{ background: grad(idx + 3) }}>
        <span className="text-[11px] font-extrabold text-white leading-tight drop-shadow line-clamp-2">
          {cleanProductName(p.name)}
        </span>
      </div>
      <div className="p-2.5 flex flex-col flex-1">
        <span className="text-[9px] font-bold text-purple-600 truncate">{p.brandName}</span>
        <span className="text-[8.5px] text-slate-400 truncate">{cleanCatName(p.categoryName)}</span>
        {p.location && (
          <span className="mt-1 text-[8px] text-slate-400 truncate">📍 {p.location}</span>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onBom(); }}
          className={`mt-2 w-full rounded-full py-1 text-[8.5px] font-extrabold uppercase tracking-wide transition-all ${
            added
              ? "bg-green-100 text-green-600 border border-green-200"
              : "bg-purple-50 text-purple-700 border border-purple-200/60 hover:bg-purple-100"
          }`}
        >
          {added ? "✓ Added" : "+ Add to BOM"}
        </button>
      </div>
    </div>
  );
}

// ─── Product Detail ───────────────────────────────────────────────────────────
function ProductDetailView({
  p, onBom, addedId, onBrandTap, onCatTap, relatedProducts, onRelatedTap,
}: {
  p: Product; onBom: () => void; addedId: string | null;
  onBrandTap: () => void; onCatTap: () => void;
  relatedProducts: Product[]; onRelatedTap: (id: string) => void;
}) {
  const added = addedId === p.id;

  return (
    <div className="pb-32">
      {/* Hero */}
      <div className="h-48 flex flex-col justify-end p-5 relative" style={{ background: grad(parseInt(p.id) % GRADIENTS.length) }}>
        <div className="absolute top-3 right-3">
          <span className="rounded-full bg-white/20 px-2.5 py-1 text-[9px] font-bold text-white/90">
            {cleanCatName(p.categoryName)}
          </span>
        </div>
        <h1 className="text-xl font-extrabold text-white leading-tight drop-shadow-md">{cleanProductName(p.name)}</h1>
        <p className="text-[11px] font-bold text-white/80 mt-1">{p.brandName}</p>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* SKU + location */}
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">SKU</span>
            <span className="text-[11px] font-bold text-slate-700">{p.sku}</span>
          </div>
          {p.instanceCode && (
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Barcode</span>
              <span className="text-[11px] font-mono font-bold text-slate-700">{p.instanceCode}</span>
            </div>
          )}
          {p.location && (
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Location</span>
              <span className="text-[11px] font-bold text-purple-600">{p.location}</span>
            </div>
          )}
        </div>

        {/* Attributes */}
        {p.attributes.length > 0 && (
          <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-3">Specifications</div>
            <div className="space-y-2">
              {p.attributes.map((a, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <span className="text-[10px] text-slate-500">{a.name}</span>
                  <span className="text-[10px] font-bold text-slate-700">
                    {String(a.value)}{a.unit ? ` ${a.unit}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Brand + Category quick nav */}
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={onBrandTap}
            className="rounded-2xl bg-purple-50 border border-purple-100 p-3 text-left hover:bg-purple-100 active:scale-95 transition-all">
            <div className="text-[8.5px] font-bold uppercase tracking-wider text-purple-400 mb-1">Brand</div>
            <div className="text-[11px] font-extrabold text-purple-700 truncate">{p.brandName}</div>
            <div className="text-[8.5px] text-purple-400 mt-1">View all products →</div>
          </button>
          <button type="button" onClick={onCatTap}
            className="rounded-2xl bg-slate-50 border border-slate-100 p-3 text-left hover:bg-slate-100 active:scale-95 transition-all">
            <div className="text-[8.5px] font-bold uppercase tracking-wider text-slate-400 mb-1">Category</div>
            <div className="text-[11px] font-extrabold text-slate-700 truncate">{cleanCatName(p.categoryName)}</div>
            <div className="text-[8.5px] text-slate-400 mt-1">Browse category →</div>
          </button>
        </div>

        {/* Add to BOM */}
        <button
          type="button"
          onClick={onBom}
          className={`w-full rounded-2xl py-3.5 text-[12px] font-extrabold uppercase tracking-wider transition-all ${
            added
              ? "bg-green-500 text-white shadow-lg"
              : "bg-gradient-to-r from-[#3d1c6b] to-[#7b4fa3] text-white shadow-lg hover:shadow-xl active:scale-[0.98]"
          }`}
        >
          {added ? "✓ Added to BOM" : "+ Add to BOM List"}
        </button>

        {/* Related products */}
        {relatedProducts.length > 0 && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="h-4 w-1 rounded-full bg-purple-600 shrink-0" />
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-700">
                More in {cleanCatName(p.categoryName)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {relatedProducts.map((rp, i) => (
                <ProductCard key={rp.id} p={rp} idx={i + 2}
                  onTap={() => onRelatedTap(rp.id)}
                  onBom={() => {}} addedId={null} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

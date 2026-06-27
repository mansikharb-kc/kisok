"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RmsTopBar from "./RmsTopBar";

type BrandItem = { id: string; name: string; code: string; bannerUrl?: string | null; materialTypeCount: number; totalProductsCount: number; blockName?: string | null };
type ProductItem = { id: string; name: string; sku: string; categoryName: string; categoryId: string; locations: string[] };

export default function BrandGrid({
  token,
  branchName,
  brands,
  selectedBrand,
  products,
}: {
  token: string;
  branchName: string;
  brands: BrandItem[];
  selectedBrand: BrandItem | null;
  products: ProductItem[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rackId = searchParams.get("rack") || "";
  const [query, setQuery] = useState("");
  const [addedId, setAddedId] = useState<string | null>(null);

  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("rms_compare");
        return raw ? JSON.parse(raw) : [];
      } catch {}
    }
    return [];
  });
  const [compareMode, setCompareMode] = useState(false);

  const checkCompareMode = () => {
    try {
      const mode = localStorage.getItem("rms_compare_mode") === "true";
      setCompareMode(mode);
      const raw = localStorage.getItem("rms_compare");
      setSelectedProductIds(raw ? JSON.parse(raw) : []);
    } catch {
      setCompareMode(false);
    }
  };

  useEffect(() => {
    checkCompareMode();
    window.addEventListener("compare-mode-updated", checkCompareMode);
    window.addEventListener("compare-updated", checkCompareMode);
    return () => {
      window.removeEventListener("compare-mode-updated", checkCompareMode);
      window.removeEventListener("compare-updated", checkCompareMode);
    };
  }, []);

  function toggleSelectProduct(p: ProductItem) {
    setSelectedProductIds((prev) => {
      if (!prev.includes(p.id) && prev.length >= 4) {
        window.dispatchEvent(new CustomEvent("show-toast", { detail: "You have already selected 4. You can compare a maximum of 4 items." }));
        return prev;
      }
      const next = prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id];
      localStorage.setItem("rms_compare", JSON.stringify(next));
      
      try {
        const raw = localStorage.getItem("rms_compare_products");
        let products = raw ? JSON.parse(raw) : [];
        if (next.includes(p.id)) {
          if (!products.some((x: any) => x.id === p.id)) {
            products.push({
              id: p.id,
              name: p.name,
              sku: p.sku,
              brandName: selectedBrand?.name || "Brand",
              categoryName: p.categoryName || "Category",
              locations: p.locations || []
            });
          }
        } else {
          products = products.filter((x: any) => x.id !== p.id);
        }
        localStorage.setItem("rms_compare_products", JSON.stringify(products));
      } catch (e) { console.error(e); }
      
      window.dispatchEvent(new Event("compare-updated"));
      return next;
    });
  }

  function handleAddToBom(p: ProductItem) {
    try {
      const existing = localStorage.getItem("rms_bom");
      const list = existing ? JSON.parse(existing) : [];
      const idx = list.findIndex((x: any) => x.id === p.id);
      if (idx === -1) {
        list.push({
          id: p.id,
          name: p.name,
          sku: p.sku,
          brandName: selectedBrand?.name || "Brand",
          categoryName: p.categoryName || "Materials",
          quantity: 1,
        });
      } else {
        list[idx].quantity += 1;
      }
      localStorage.setItem("rms_bom", JSON.stringify(list));
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new Event("bom-updated"));
      setAddedId(p.id);
      setTimeout(() => setAddedId(null), 1500);
    } catch (e) {
      console.error(e);
    }
  }

  const filteredBrands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((b) => b.name.toLowerCase().includes(q));
  }, [brands, query]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.categoryName.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
    );
  }, [products, query]);

  // Extract unique categories from the brand's products
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.categoryName) set.add(p.categoryName);
    }
    return Array.from(set);
  }, [products]);

  function handleBrandClick(brandId: string) {
    setQuery("");
    router.push(`/rms/screen/${token}/brand?brand=${brandId}&rack=${rackId}`);
  }

  function handleBackClick() {
    setQuery("");
    router.back();
  }

  const cardGradients = [
    "from-[#d4c5a9] to-[#a89070]",
    "from-[#b8c4d4] to-[#7a90a8]",
    "from-[#c4d4b8] to-[#8aa870]",
    "from-[#d4b8c4] to-[#a87090]",
    "from-[#c4c0d4] to-[#8880a8]",
    "from-[#d4cdb8] to-[#a89a70]",
  ];

  return (
    <div className="mx-auto min-h-screen bg-[#fbfaff] pb-16">
      {/* Kiosk Header */}
      <RmsTopBar onBackClick={handleBackClick} />

      {/* Main Container */}
      <div className="px-4 pt-4">
        
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-purple-500/70 mb-3.5 px-0.5">
          <button 
            onClick={() => router.push(`/rms/screen/${token}?rack=${rackId}`)} 
            className="hover:text-purple-600 flex items-center gap-1"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>Home</span>
          </button>
          <span className="text-slate-300">›</span>
          <button onClick={() => router.push(`/rms/screen/${token}/brand?rack=${rackId}`)} className="hover:text-purple-600">
            Products
          </button>
          {selectedBrand && (
            <>
              <span className="text-slate-300">›</span>
              <span className="text-purple-700 font-extrabold">{selectedBrand.name}</span>
            </>
          )}
        </div>

        {/* Title */}
        <h1 className="text-lg font-black text-slate-800 mb-4 px-0.5">
          {selectedBrand ? selectedBrand.name : "Brands"}
        </h1>

        {/* Search */}
        <div className="relative mb-5">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-purple-500">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${selectedBrand ? "products" : "brands"}...`}
            className="w-full rounded-full border border-purple-300 py-2 pl-11 pr-4 text-xs text-slate-700 placeholder-slate-400 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-400/40"
          />
        </div>

        {/* Brands List */}
        {!selectedBrand && (
          <div>
            <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3 px-1">
              Available Brands
            </h3>
            {filteredBrands.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center text-xs font-semibold text-slate-400 border border-slate-100 shadow-sm">
                No brands found.
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-4">
                {filteredBrands.map((b, idx) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handleBrandClick(b.id)}
                    className="overflow-hidden rounded-[18px] border border-slate-100 bg-white text-left shadow-[0_4px_16px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] active:scale-[0.97] flex flex-col relative h-[270px]"
                  >
                    {/* Image / gradient area */}
                    <div className="relative h-32 w-full bg-gradient-to-b from-[#e3dac9] to-[#bca685] flex flex-col justify-end p-2.5 shrink-0">
                      <span className="text-[11px] font-extrabold text-white leading-tight drop-shadow-md line-clamp-2">{b.name}</span>
                    </div>
                    <div className="p-2.5 flex flex-col gap-1 flex-grow w-full justify-between">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center">
                          <span className="rounded-full bg-purple-50 px-1.5 py-0.5 text-[8px] font-bold text-purple-600 border border-purple-100/50 uppercase tracking-wide">
                            {b.materialTypeCount} Material type
                          </span>
                        </div>
                        <span className="text-[8px] font-bold text-slate-400 mt-1">
                          {b.totalProductsCount} Total Products
                        </span>
                      </div>
                      
                      <div className="w-full mt-2.5">
                        <span className="flex w-full items-center justify-center rounded-full bg-[#f3e8ff] py-1.5 text-[8.5px] font-extrabold text-[#9333ea] tracking-wide uppercase hover:bg-purple-100 transition-all">
                          View →
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Brand Detail/Landing Page Layout */}
        {selectedBrand && (
          <div className="space-y-6">
            
            {/* 1. Hero Layout Header */}
            <div className="flex gap-4 items-stretch bg-white p-3 border border-slate-100 rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.02)]">
              {/* Image (left) */}
              <div className="w-[50%] shrink-0">
                <img 
                  src={selectedBrand.bannerUrl || "/brand_showroom_banner.png"} 
                  alt={selectedBrand.name} 
                  className="w-full h-full min-h-[160px] object-cover rounded-[14px]"
                />
              </div>
              {/* Info (right) */}
              <div className="w-[50%] flex flex-col justify-between py-1">
                <div>
                  <h2 className="text-base font-black text-slate-800 leading-tight">{selectedBrand.name}</h2>
                  <p className="text-[8px] font-bold text-slate-400 mt-0.5">Featured Product Name</p>
                  <p className="text-[8.5px] text-slate-500 italic mt-2.5 leading-relaxed border-l-2 border-purple-400 pl-2">
                    "Beautiful Fabrics That Transform Spaces And Inspire Living."
                  </p>
                </div>
                <div className="mt-3.5 space-y-1.5 text-[8.5px] font-bold text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <svg className="h-3 w-3 text-purple-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10zM2 12h20" />
                    </svg>
                    <span>Origin: India</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg className="h-3 w-3 text-purple-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <path d="M16 2v4M8 2v4M3 10h18" />
                    </svg>
                    <span>Established 2008</span>
                  </div>
                   <div className="flex items-center gap-1.5">
                    <svg className="h-3 w-3 text-purple-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                    <span>{selectedBrand.materialTypeCount}+ Categories</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg className="h-3 w-3 text-purple-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <rect x="3" y="3" width="7" height="7" rx="1" />
                      <rect x="14" y="3" width="7" height="7" rx="1" />
                      <rect x="14" y="14" width="7" height="7" rx="1" />
                      <rect x="3" y="14" width="7" height="7" rx="1" />
                    </svg>
                    <span>{selectedBrand.totalProductsCount}+ Products</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Details Row (About Brand + Known For) */}
            <div className="grid grid-cols-2 gap-3.5">
              {/* About Brand */}
              <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
                <div>
                  <h4 className="text-[9.5px] font-black text-slate-800 uppercase tracking-wider mb-1.5">About Brand</h4>
                  <p className="text-[8px] text-slate-500 leading-relaxed font-semibold">
                    {selectedBrand.name} creates high-performance materials that combine timeless design, exceptional quality and sustainable practices. Crafted for beautiful spaces that last.
                  </p>
                </div>
              </div>
              {/* Known For */}
              <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                <h4 className="text-[9.5px] font-black text-slate-800 uppercase tracking-wider mb-2.5">Known For</h4>
                <div className="grid grid-cols-2 gap-2 text-[8px] font-extrabold text-slate-600">
                  {["Curtains", "Residentials", "Sheers", "Commercials"].map((item) => (
                    <div key={item} className="flex items-center gap-1">
                      <svg className="h-2.5 w-2.5 text-purple-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="truncate">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Categories List */}
            {uniqueCategories.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-xs font-black text-slate-800">Categories</h3>
                  <button
                    onClick={() => router.push(`/rms/screen/${token}/category?brand=${selectedBrand.id}&rack=${rackId}&view=categories`)}
                    className="text-purple-600 font-bold text-[9px] hover:underline"
                  >
                    View all Categories →
                  </button>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory">
                  {uniqueCategories.map((cat, idx) => {
                    const pMatch = products.find(p => p.categoryName === cat);
                    const catId = pMatch?.categoryId || "";
                    return (
                      <button
                        key={cat}
                        onClick={() => router.push(`/rms/screen/${token}/category?cat=${catId}&rack=${rackId}&brand=${selectedBrand.id}`)}
                        className="shrink-0 w-[110px] snap-start overflow-hidden rounded-[18px] border border-slate-100 bg-white shadow-sm hover:shadow active:scale-95 transition-all text-left flex flex-col"
                      >
                        <div className={`h-[90px] w-full bg-gradient-to-b ${cardGradients[idx % cardGradients.length]} flex flex-col justify-end p-2.5`}>
                          <span className="text-[11px] font-extrabold text-white leading-tight drop-shadow">{cat}</span>
                        </div>
                        <div className="p-2 text-right w-full bg-white">
                          <span className="text-[8.5px] font-bold text-purple-600">View →</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. Featured Products Grid */}
            <div>
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-black text-slate-800">Featured Products</h3>
                </div>
                <button
                  onClick={() => router.push(`/rms/screen/${token}/product?brand=${selectedBrand.id}&rack=${rackId}`)}
                  className="text-purple-600 font-bold text-[9px] hover:underline"
                >
                  View all Products →
                </button>
              </div>

              {filteredProducts.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center text-xs font-semibold text-slate-400 border border-slate-100 shadow-sm">
                  No products found.
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory px-0.5">
                  {filteredProducts.map((p, idx) => (
                    <div
                      key={p.id}
                      className="shrink-0 w-[130px] snap-start overflow-hidden rounded-[18px] bg-white border border-slate-100 shadow-[0_4px_14px_rgba(0,0,0,0.04)] flex flex-col"
                    >
                      {/* Gradient card image */}
                      <div className={`relative h-[90px] bg-gradient-to-b ${cardGradients[idx % cardGradients.length]} flex flex-col justify-end p-2`}>
                        {compareMode && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleSelectProduct(p); }}
                            className={`absolute top-1.5 right-1.5 z-20 h-7 w-7 rounded-full border-2 flex items-center justify-center shadow-md transition-all active:scale-90 ${
                              selectedProductIds.includes(p.id)
                                ? "bg-purple-600 border-purple-600 text-white"
                                : "bg-white/90 border-purple-400 text-purple-600"
                            }`}
                          >
                            {selectedProductIds.includes(p.id) ? (
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                              </svg>
                            )}
                          </button>
                        )}
                        <span className="text-[10px] font-extrabold text-white leading-tight drop-shadow line-clamp-2">{p.name}</span>
                      </div>
                      {/* Card Info */}
                      <div className="p-2 flex flex-col gap-1.5 flex-1">
                        <div className="flex items-center">
                          <span className="rounded-full bg-purple-50 px-1.5 py-0.5 text-[7px] font-bold text-purple-600 border border-purple-100/50 uppercase">
                            {p.categoryName}
                          </span>
                        </div>
                        
                        {p.locations.length > 0 && (
                          <div className="flex items-center gap-1 text-[7px] font-semibold text-slate-400">
                            <svg className="h-2 w-2 text-purple-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                              <circle cx="12" cy="11" r="2.5" />
                            </svg>
                            <span className="truncate">{p.locations[0].split(" › ").join(".")}</span>
                          </div>
                        )}
                        
                        <div className="flex-1" />
                        
                        {/* Add to Wishlist */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleAddToBom(p);
                          }}
                          className={`w-full rounded-full py-1.5 text-[8px] font-extrabold transition-all active:scale-[0.97] mb-1.5 ${
                            addedId === p.id
                              ? "bg-purple-100 text-purple-600 shadow-sm"
                              : "bg-[#9333ea] text-white hover:bg-purple-700 shadow-sm"
                          }`}
                        >
                          {addedId === p.id ? "✓ Added!" : "Add to Wishlist"}
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => {
                            let url = `/rms/screen/${token}/product/${p.id}?rack=${rackId}`;
                            if (selectedBrand?.id) url += `&brand=${selectedBrand.id}`;
                            router.push(url);
                          }}
                          className="w-full rounded-full bg-slate-100 py-1.5 text-[8px] font-extrabold text-slate-500 transition-all hover:bg-slate-200 active:scale-[0.97]"
                        >
                          View →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  );
}

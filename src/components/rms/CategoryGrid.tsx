"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RmsTopBar from "./RmsTopBar";

type CategoryItem = { id: string; name: string; code: string; parentId: string | null };
type BrandItem = { id: string; name: string; code: string; materialTypeCount: number; totalProductsCount: number };
type ProductItem = { id: string; name: string; sku: string; brandId: string; brandName: string; locations: string[] };

export default function CategoryGrid({
  token,
  branchName,
  categories,
  selectedCategory,
  subCategories,
  products,
  brandName,
  brands = [],
}: {
  token: string;
  branchName: string;
  categories: CategoryItem[];
  selectedCategory: { id: string; name: string; code: string; parent: { id: string; name: string } | null } | null;
  subCategories: CategoryItem[];
  products: ProductItem[];
  brandName?: string;
  brands?: BrandItem[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // rackId no longer used — all data is screen-wide
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

  // Determine root/display categories to show when no specific category is selected
  const displayCats = useMemo(() => {
    if (selectedCategory) {
      return subCategories;
    }
    const viewMode = searchParams.get("view");
    if (viewMode === "categories") {
      return categories;
    }
    return categories.filter((c) => !c.parentId || !categories.some((p) => p.id === c.parentId));
  }, [categories, selectedCategory, subCategories, searchParams]);

  // Filter display categories or products based on query
  const filteredCats = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return displayCats;
    return displayCats.filter((c) => c.name.toLowerCase().includes(q));
  }, [displayCats, query]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brandName.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
    );
  }, [products, query]);

  function handleCategoryClick(catId: string) {
    setQuery("");
    router.push(`/rms/screen/${token}/category?cat=${catId}`);
  }

  function handleBackClick() {
    setQuery("");
    router.back();
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
          brandName: p.brandName,
          categoryName: selectedCategory?.name || "Materials",
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

  function toggleSelectProduct(p: ProductItem) {
    setSelectedProductIds((prev) => {
      if (!prev.includes(p.id) && prev.length >= 4) {
        window.dispatchEvent(new CustomEvent("show-toast", { detail: "You have already selected 4. You can compare a maximum of 4 items." }));
        return prev;
      }
      const next = prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id];
      localStorage.setItem("rms_compare", JSON.stringify(next));
      
      // Update the full products object array for the drawer
      try {
        const raw = localStorage.getItem("rms_compare_products");
        let products = raw ? JSON.parse(raw) : [];
        if (next.includes(p.id)) {
          if (!products.some((x: any) => x.id === p.id)) {
            products.push(p);
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

  // Gradient palette for product cards (cycles through a set of warm/cool gradients)
  const cardGradients = [
    "from-[#d4c5a9] to-[#a89070]",
    "from-[#b8c4d4] to-[#7a90a8]",
    "from-[#c4d4b8] to-[#8aa870]",
    "from-[#d4b8c4] to-[#a87090]",
    "from-[#c4c0d4] to-[#8880a8]",
    "from-[#d4cdb8] to-[#a89a70]",
  ];

  const viewMode = searchParams.get("view");
  const showProductsGrid = viewMode !== "categories" && (selectedCategory || brandName) && (!brands || brands.length === 0 || brandName);

  return (
    <div className="mx-auto min-h-screen bg-[#fbfaff] pb-24 relative">
      {/* Kiosk Header */}
      <RmsTopBar onBackClick={handleBackClick} />

      {/* Main Container */}
      <div className="px-4 pt-4">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-purple-500/70 mb-3 px-0.5">
          <button 
            onClick={() => router.push(`/rms/screen/${token}`)} 
            className="hover:text-purple-600 flex items-center gap-1"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>Home</span>
          </button>
          <span className="text-slate-300">›</span>
          <button
            onClick={() => router.push(`/rms/screen/${token}/category`)}
            className="hover:text-purple-600"
          >
            Category
          </button>
          {selectedCategory && (
            <>
              <span className="text-slate-300">›</span>
              <span className="text-purple-700 font-extrabold max-w-[120px] truncate">{selectedCategory.name}</span>
            </>
          )}
        </div>

        {/* Title */}
        <h1 className="text-lg font-black text-slate-800 mb-4 px-0.5">
          {brandName ? `${brandName} Categories` : "Categories"}
        </h1>

        {/* Search Bar */}
        <div className="relative mb-5">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-purple-500">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by products, brands & categories..."
            className="w-full rounded-full border border-purple-200 py-2 pl-11 pr-4 text-xs text-slate-700 placeholder-slate-400 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-400/40"
          />
        </div>

        {/* Section Header with Stats */}
        <div className="flex items-start gap-2 mb-4 px-1">
          <span className="mt-1 text-slate-700">
            <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16M9 6v12" />
            </svg>
          </span>
          <div>
            <h2 className="text-sm font-black text-slate-800 leading-none flex items-center gap-1">
              {showProductsGrid ? (
                <>
                  Products <span className="text-slate-400">›</span>
                </>
              ) : selectedCategory ? (
                "Available Brands"
              ) : (
                `Categories of ${brandName || "Brand X"}`
              )}
            </h2>
            <p className="text-[9px] font-bold text-slate-400 mt-1">
              {showProductsGrid ? (
                `${filteredProducts.length} Products`
              ) : selectedCategory ? (
                `${brands.length} Brands Available`
              ) : (
                `${categories.length} Categories · ${subCategories.length} Subcategories · ${products.length} Products`
              )}
            </p>
          </div>
        </div>

        {/* Filter Dropdowns */}
        <div className="flex items-center gap-1.5 mb-5 px-0.5">
          <button className="flex items-center gap-1 bg-[#f3e8ff] px-2.5 py-1.5 rounded-lg text-[9px] font-extrabold text-[#9333ea]">
            {selectedCategory ? selectedCategory.name : "All Categories"}
            <span className="text-[7px]">▼</span>
          </button>
        </div>

        {/* Brand selection area if category is selected but brand is not */}
        {selectedCategory && !brandName && brands && brands.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2">
            {brands.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => router.push(`/rms/screen/${token}/category?cat=${selectedCategory.id}&brand=${b.id}`)}
                className="overflow-hidden rounded-[20px] border border-slate-100/80 bg-white text-left shadow-[0_4px_16px_rgba(0,0,0,0.03)] transition-all hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] active:scale-[0.98] flex flex-col relative h-[210px]"
              >
                <div className="relative h-[140px] w-full bg-gradient-to-b from-[#e3dac9] to-[#bca685] flex flex-col justify-end p-3 shrink-0">
                  <span className="text-[12px] sm:text-[13px] md:text-sm font-extrabold text-white leading-tight drop-shadow-md line-clamp-2">{b.name}</span>
                </div>
                <div className="p-3 flex flex-col justify-between flex-grow w-full">
                  <div className="flex items-center gap-1">
                    <span className="rounded-full bg-[#f3e8ff] px-2 py-0.5 text-[8px] sm:text-[9.5px] md:text-[10px] font-extrabold text-[#9333ea]">
                      {b.materialTypeCount} Finishes
                    </span>
                  </div>
                  <div className="flex justify-end w-full">
                    <span className="text-[9px] sm:text-[10.5px] md:text-[11px] font-extrabold text-[#9333ea] flex items-center gap-0.5">
                      View →
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Categories Grid (rendered when not viewing products) */}
        {!showProductsGrid && (!selectedCategory || (brands && brands.length === 0)) && (
          <div>
            {filteredCats.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center text-xs font-semibold text-slate-400 border border-slate-100 shadow-sm">
                No categories found.
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2">
                {filteredCats.map((cat, idx) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategoryClick(cat.id)}
                    className="overflow-hidden rounded-[20px] border border-slate-100/80 bg-white text-left shadow-[0_4px_16px_rgba(0,0,0,0.03)] transition-all hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] active:scale-[0.98] flex flex-col relative h-[210px]"
                  >
                    <div className={`relative h-[140px] w-full bg-gradient-to-b ${cardGradients[idx % cardGradients.length]} flex flex-col justify-end p-3 shrink-0`}>
                      <span className="text-[12px] sm:text-[13px] md:text-sm font-extrabold text-white leading-tight drop-shadow-md line-clamp-2">
                        {cat.name}
                      </span>
                    </div>
                    <div className="p-3 flex flex-col justify-between flex-grow w-full">
                      <div className="flex items-center">
                        <span className="rounded-full bg-[#f3e8ff] px-2 py-0.5 text-[8px] sm:text-[9.5px] md:text-[10px] font-extrabold text-[#9333ea]">
                          {categories.filter((c) => c.parentId === cat.id).length > 0
                            ? `${categories.filter((c) => c.parentId === cat.id).length} Subcategories`
                            : "Products"}
                        </span>
                      </div>
                      <div className="flex justify-end w-full">
                        <span className="text-[9px] sm:text-[10.5px] md:text-[11px] font-extrabold text-[#9333ea] flex items-center gap-0.5">
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

        {/* Products Grid */}
        {showProductsGrid && (
          <div>
            {filteredProducts.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center text-xs font-semibold text-slate-400 border border-slate-100 shadow-sm">
                No products found.
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">
                {filteredProducts.map((p, idx) => {
                  const isSelected = selectedProductIds.includes(p.id);
                  const isAdded = addedId === p.id;
                  const grad = cardGradients[idx % cardGradients.length];
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        let url = `/rms/screen/${token}/product/${p.id}?`;
                        const catId2 = searchParams.get("cat") || "";
                        const brandId2 = searchParams.get("brand") || "";
                        if (catId2) url += `cat=${catId2}&`;
                        if (brandId2) url += `brand=${brandId2}`;
                        router.push(url.replace(/[?&]$/, ""));
                      }}
                      className={`cursor-pointer overflow-hidden rounded-[18px] bg-white border shadow-[0_4px_16px_rgba(0,0,0,0.05)] flex flex-col relative transition-all duration-200 h-[225px] ${
                        isSelected
                          ? "border-purple-400 shadow-[0_0_0_2px_rgba(147,51,234,0.2),0_4px_16px_rgba(0,0,0,0.06)]"
                          : "border-slate-100"
                      }`}
                    >
                      {/* Gradient Card Area */}
                      <div className={`relative h-28 bg-gradient-to-b ${grad} flex flex-col justify-end p-2.5 shrink-0`}>
                        {/* Comparison Button */}
                        {compareMode && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleSelectProduct(p); }}
                            className={`absolute top-2 right-2 z-20 h-7 w-7 rounded-full border-2 flex items-center justify-center shadow-md transition-all active:scale-90 ${
                              isSelected
                                ? "bg-purple-600 border-purple-600 text-white"
                                : "bg-white/90 border-purple-400 text-purple-600"
                            }`}
                          >
                            {isSelected ? (
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
                        <span className="text-[11px] font-extrabold text-white leading-tight drop-shadow-md line-clamp-2">
                          {p.name}
                        </span>
                      </div>

                      {/* Card Content Info */}
                      <div className="flex flex-col gap-1 p-2.5 flex-grow justify-between">
                        <div>
                          <span className="text-[8px] font-bold text-slate-400">by {p.brandName || brandName || "Brand X"}</span>
                          <div className="flex items-center mt-1">
                            <span className="rounded-full bg-purple-50 px-1.5 py-0.5 text-[8px] font-bold text-purple-600 border border-purple-100/50 uppercase tracking-wide">
                              Finishes
                            </span>
                          </div>

                          {p.locations.length > 0 && (
                            <div className="flex items-center gap-0.5 mt-0.5 text-[7px] text-slate-500 font-semibold px-0.5">
                              <svg className="h-2 w-2 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="11" r="2.5"/><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"/></svg>
                              <span className="truncate">{p.locations[0].split(" › ").join(".")}</span>
                            </div>
                          )}
                        </div>

                        <div className="w-full">
                          {/* Add to Wishlist */}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleAddToBom(p); }}
                            className={`w-full rounded-full py-1.5 text-[8.5px] font-extrabold tracking-wide uppercase transition-all active:scale-[0.97] mt-1 ${
                              isAdded
                                ? "bg-emerald-500 text-white"
                                : "bg-[#9333ea] text-white hover:bg-purple-700 shadow-sm"
                            }`}
                          >
                            {isAdded ? "✓ Added!" : "Add to Wishlist"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


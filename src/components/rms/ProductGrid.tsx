"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RmsTopBar from "./RmsTopBar";

type ProductItem = { id: string; name: string; sku: string; brandName: string; categoryName: string; locations: string[] };

export default function ProductGrid({
  token,
  branchName,
  products,
}: {
  token: string;
  branchName: string;
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
      try {
        localStorage.setItem("rms_compare", JSON.stringify(next));
        const rawProducts = localStorage.getItem("rms_compare_products");
        let storedProducts = rawProducts ? JSON.parse(rawProducts) : [];
        if (next.includes(p.id)) {
          if (!storedProducts.find((x: any) => x.id === p.id)) storedProducts.push(p);
        } else {
          storedProducts = storedProducts.filter((x: any) => x.id !== p.id);
        }
        localStorage.setItem("rms_compare_products", JSON.stringify(storedProducts));
        window.dispatchEvent(new Event("compare-updated"));
      } catch (e) { console.error(e); }
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
          brandName: p.brandName || "Brand",
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

  const cardGradients = [
    "from-[#d4c5a9] to-[#a89070]",
    "from-[#b8c4d4] to-[#7a90a8]",
    "from-[#c4d4b8] to-[#8aa870]",
    "from-[#d4b8c4] to-[#a87090]",
    "from-[#c4c0d4] to-[#8880a8]",
    "from-[#d4cdb8] to-[#a89a70]",
  ];

  function handleBackClick() {
    setQuery("");
    router.back();
  }

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brandName.toLowerCase().includes(q) ||
        p.categoryName.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
    );
  }, [products, query]);

  return (
    <div className="mx-auto min-h-screen bg-[#fbfaff] pb-12">
      {/* Kiosk Header */}
      <RmsTopBar onBackClick={handleBackClick} />

      {/* Main Container */}
      <div className="px-4 pt-5">
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
            placeholder="Search all products..."
            className="w-full rounded-full border border-purple-300 py-3 pl-11 pr-4 text-xs text-slate-700 placeholder-slate-400 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-400/40"
          />
        </div>

        {/* Product List */}
        <div>
          <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3 px-1">
            Available Products ({filteredProducts.length})
          </h3>
          {filteredProducts.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-xs font-semibold text-slate-400 border border-slate-100 shadow-sm">
              No products found.
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-5">
              {filteredProducts.map((p, idx) => (
                <div
                  key={p.id}
                  onClick={() => router.push(`/rms/screen/${token}/product/${p.id}?rack=${rackId}`)}
                  className="cursor-pointer overflow-hidden rounded-[18px] bg-white border border-slate-100 shadow-[0_4px_16px_rgba(0,0,0,0.05)] flex flex-col relative h-[255px]"
                >
                  {/* Gradient Card Area */}
                  <div className={`relative h-32 bg-gradient-to-b ${cardGradients[idx % cardGradients.length]} flex flex-col justify-end p-2.5`}>
                    {/* Comparison Button */}
                    {compareMode && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleSelectProduct(p); }}
                        className={`absolute top-2 right-2 z-20 h-7 w-7 rounded-full border-2 flex items-center justify-center shadow-md transition-all active:scale-90 ${
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
                    <span className="text-[11px] sm:text-[13px] md:text-sm font-extrabold text-white leading-tight drop-shadow-md line-clamp-2">
                      {p.name}
                    </span>
                  </div>

                  {/* Card Content Info */}
                  <div className="flex flex-col gap-1 p-2.5 flex-grow">
                    <span className="text-[8px] sm:text-[10px] md:text-[11px] font-bold text-slate-400">by {p.brandName || "Brand X"}</span>
                    <div className="flex items-center mt-1">
                      <span className="rounded-full bg-purple-50 px-1.5 py-0.5 text-[8px] sm:text-[10px] md:text-[11px] font-bold text-purple-600 border border-purple-100/50 uppercase tracking-wide">
                        Finishes
                      </span>
                    </div>

                    {p.locations && p.locations.length > 0 && (
                      <div className="flex items-center gap-0.5 mt-0.5 text-[7px] sm:text-[9px] md:text-[10px] text-slate-500 font-semibold px-0.5">
                        <svg className="h-2 w-2 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="11" r="2.5"/><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"/></svg>
                        <span>{p.locations[0].split(" › ").join(".")}</span>
                      </div>
                    )}

                    <div className="flex-grow" />

                    {/* Add to Wishlist */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); }}
                      className={`w-full rounded-full py-1.5 text-[8.5px] sm:text-[10px] md:text-[11.5px] font-extrabold tracking-wide uppercase mt-2.5 ${
                        addedId === p.id
                          ? "bg-emerald-500 text-white"
                          : "bg-[#9333ea] text-white hover:bg-purple-700 shadow-sm"
                      }`}
                    >
                      {addedId === p.id ? "✓ Added!" : "Add to Wishlist"}
                    </button>
                    <span className="text-[5.5px] sm:text-[7px] md:text-[8px] text-slate-400 font-bold text-center mt-1 block leading-normal whitespace-nowrap">
                      "Add to Wishlist" coming soon
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

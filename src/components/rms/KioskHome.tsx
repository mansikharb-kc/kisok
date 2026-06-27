"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Brand = { id: string; name: string };
type SubCategory = {
  catId: string;
  name: string;
  rawName: string;
  productCount: number;
  brandCount: number;
  brands: Brand[];
};
type Category = {
  id: string;
  name: string;
  productCount: number;
  brandCount: number;
  brands: Brand[];
  hasSubCategories: boolean;
  subCategories: SubCategory[];
  directCatId: string | null;
};

// Category background gradients — cycling through beautiful soft palettes
const CAT_GRADIENTS = [
  "from-[#d4c5a9] to-[#a89070]",
  "from-[#b8c4d4] to-[#7a90a8]",
  "from-[#c4d4b8] to-[#8aa870]",
  "from-[#d4b8c4] to-[#a87090]",
  "from-[#c4c0d4] to-[#8880a8]",
  "from-[#d4cdb8] to-[#a89a70]",
];

export default function KioskHome({
  token,
  branchName,
  categories,
}: {
  token: string;
  branchName: string;
  categories: Category[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  // null = showing root categories, string = showing subcategories of that parent name
  const [expandedParent, setExpandedParent] = useState<Category | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.brands.some((b) => b.name.toLowerCase().includes(q)) ||
        c.subCategories?.some((s) => s.name.toLowerCase().includes(q))
    );
  }, [categories, query]);

  function handleCategoryClick(cat: Category) {
    if (cat.hasSubCategories) {
      // Show subcategory level
      setExpandedParent(cat);
      setQuery("");
    } else if (cat.directCatId) {
      // Go directly to category page
      router.push(`/rms/screen/${token}/category?cat=${cat.directCatId}`);
    }
  }

  function handleSubCategoryClick(sub: SubCategory) {
    router.push(`/rms/screen/${token}/category?cat=${sub.catId}`);
  }

  function handleBack() {
    setExpandedParent(null);
    setQuery("");
  }

  // Determine what to display
  const displayedList = expandedParent
    ? expandedParent.subCategories
    : filtered;

  const isSubLevel = expandedParent !== null;

  return (
    <div className="mx-auto min-h-screen bg-[#fbfaff] pb-28">
      {/* Header */}
      <header className="bg-gradient-to-b from-[#1a052e] to-[#2d0f4d] px-4 pb-5 pt-4 text-white shadow-lg">
        <div className="text-center text-[10px] uppercase tracking-[0.3em] text-purple-200/60 font-semibold">
          Welcome to
        </div>
        <div className="mt-1 text-center text-lg font-extrabold tracking-widest text-white uppercase">
          {branchName}
        </div>
        <div className="mt-3 flex items-center justify-center gap-1.5">
          <div className="h-px w-8 bg-purple-400/30 rounded" />
          <span className="text-[10px] font-semibold text-purple-300/70 tracking-wider">
            {categories.length} Categories • Browse All Products
          </span>
          <div className="h-px w-8 bg-purple-400/30 rounded" />
        </div>
      </header>

      {/* Logo + tagline */}
      <div className="px-8 pt-6 text-center">
        <img
          src="/logo.png"
          alt="KC Logo"
          className="mx-auto h-14 w-auto object-contain"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        <p className="mt-2 text-[11px] font-semibold text-purple-600 tracking-wider">
          Discover Products, Brands &amp; Materials
        </p>
      </div>

      {/* Search */}
      <div className="px-6 mt-5">
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-purple-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search categories, brands, materials..."
            className="w-full rounded-full border border-purple-200 bg-white py-2.5 pl-11 pr-4 text-xs text-slate-700 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-400/40"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Section heading */}
      <div className="px-6 mt-6 mb-3 flex items-center gap-2">
        {isSubLevel && (
          <button
            type="button"
            onClick={handleBack}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-700 hover:bg-purple-200 active:scale-90 transition-all"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <span className="h-4 w-1 rounded-full bg-purple-600 inline-block" />
        <h2 className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-700">
          {isSubLevel
            ? expandedParent!.name
            : query.trim()
            ? `Results for "${query.trim()}"`
            : "All Categories"}
        </h2>
        <span className="ml-auto text-[10px] font-bold text-purple-500 bg-purple-50 border border-purple-100 rounded-full px-2 py-0.5">
          {displayedList.length}
        </span>
      </div>

      {/* Category / SubCategory Grid */}
      {displayedList.length === 0 ? (
        <div className="mx-6 mt-4 rounded-2xl bg-white border border-slate-100 py-16 text-center shadow-sm">
          <svg className="mx-auto h-8 w-8 text-slate-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="mt-3 text-xs font-medium text-slate-400">No categories found</p>
        </div>
      ) : (
        <div className="px-4 grid grid-cols-3 gap-x-3 gap-y-6 relative py-2">
          {isSubLevel
            ? // --- SUB CATEGORY CARDS ---
              (displayedList as SubCategory[]).map((sub, idx) => (
                <button
                  key={sub.catId}
                  type="button"
                  onClick={() => handleSubCategoryClick(sub)}
                  className="overflow-hidden rounded-[20px] border border-slate-100 bg-white text-left shadow-[0_4px_16px_rgba(0,0,0,0.03)] transition-all hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] active:scale-[0.98] flex flex-col relative h-[220px]"
                >
                  {/* Gradient top */}
                  <div
                    className={`relative h-[110px] w-full bg-gradient-to-b ${
                      CAT_GRADIENTS[(idx + 4) % CAT_GRADIENTS.length]
                    } flex flex-col justify-end p-2.5 shrink-0`}
                  >
                    <span className="text-[11px] font-extrabold text-white leading-tight drop-shadow-md line-clamp-2">
                      {sub.name}
                    </span>
                  </div>

                  {/* Bottom info */}
                  <div className="p-2 flex flex-col justify-between flex-grow w-full bg-white">
                    <div className="text-[7.5px] text-slate-400 font-bold leading-none">
                      <span className="text-slate-800 font-black">{sub.productCount}</span> Products &nbsp;&nbsp;
                      <span className="text-slate-800 font-black">{sub.brandCount}</span> Brands
                    </div>
                    <div className="text-[7.5px] font-black text-slate-700 leading-none">
                      Brands Available
                    </div>
                    <div className="flex flex-wrap gap-0.5 mt-0.5 overflow-hidden max-h-[36px]">
                      {sub.brands.slice(0, 3).map((b) => (
                        <span
                          key={b.id}
                          className="rounded-full bg-slate-50 border border-slate-100 px-1 py-0.5 text-[6.5px] font-black text-slate-500 truncate max-w-[50px]"
                        >
                          {b.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              ))
            : // --- ROOT CATEGORY CARDS ---
              (displayedList as Category[]).map((cat, idx) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleCategoryClick(cat)}
                  className="overflow-hidden rounded-[20px] border border-slate-100 bg-white text-left shadow-[0_4px_16px_rgba(0,0,0,0.03)] transition-all hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] active:scale-[0.98] flex flex-col relative h-[220px]"
                >
                  {/* Gradient top area */}
                  <div
                    className={`relative h-[110px] w-full bg-gradient-to-b ${
                      CAT_GRADIENTS[idx % CAT_GRADIENTS.length]
                    } flex flex-col justify-end p-2.5 shrink-0`}
                  >
                    <span className="text-[11px] font-extrabold text-white leading-tight drop-shadow-md line-clamp-2">
                      {cat.name}
                    </span>
                  </div>

                  {/* Bottom info */}
                  <div className="p-2 flex flex-col justify-between flex-grow w-full bg-white">
                    <div className="text-[7.5px] text-slate-400 font-bold leading-none">
                      <span className="text-slate-800 font-black">{cat.productCount}</span> Products &nbsp;&nbsp;
                      <span className="text-slate-800 font-black">{cat.brandCount}</span> Brands
                    </div>
                    <div className="text-[7.5px] font-black text-slate-700 leading-none">
                      Brands Available
                    </div>
                    <div className="flex flex-wrap gap-0.5 mt-0.5 overflow-hidden max-h-[36px]">
                      {cat.brands.slice(0, 3).map((b) => (
                        <span
                          key={b.id}
                          className="rounded-full bg-slate-50 border border-slate-100 px-1 py-0.5 text-[6.5px] font-black text-slate-500 truncate max-w-[50px]"
                        >
                          {b.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              ))}
        </div>
      )}
    </div>
  );
}

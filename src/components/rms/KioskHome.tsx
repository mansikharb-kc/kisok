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

// Category background gradients — cycling through beautiful palettes
const CAT_GRADIENTS = [
  "from-[#1a052e] to-[#4b1f7c]",
  "from-[#0f2027] to-[#203a43]",
  "from-[#2c3e50] to-[#4a6274]",
  "from-[#3d1c6b] to-[#7b4fa3]",
  "from-[#0d3b2f] to-[#1a7a5e]",
  "from-[#1f1c2c] to-[#928dab]",
  "from-[#3b1e08] to-[#8b5e3c]",
  "from-[#1b2838] to-[#2d6186]",
  "from-[#4a0e3c] to-[#8b1a5e]",
  "from-[#0a2342] to-[#1b5e99]",
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
    <div className="mx-auto min-h-screen max-w-[480px] bg-[#fbfaff] pb-28">
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
        <div className="px-4 grid grid-cols-2 gap-3">
          {isSubLevel
            ? // --- SUB CATEGORY CARDS ---
              (displayedList as SubCategory[]).map((sub, idx) => (
                <button
                  key={sub.catId}
                  type="button"
                  onClick={() => handleSubCategoryClick(sub)}
                  className="overflow-hidden rounded-2xl border border-slate-100 bg-white text-left shadow-[0_4px_16px_rgba(0,0,0,0.05)] transition-all active:scale-[0.96] hover:shadow-[0_8px_24px_rgba(88,28,135,0.12)]"
                >
                  {/* Gradient top */}
                  <div
                    className={`relative h-28 bg-gradient-to-br ${
                      CAT_GRADIENTS[(idx + 4) % CAT_GRADIENTS.length]
                    } flex flex-col justify-between p-3`}
                  >
                    <div className="self-end rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-bold text-white/90 backdrop-blur-sm border border-white/10">
                      {sub.productCount} products
                    </div>
                    <span className="text-[13px] font-extrabold text-white leading-tight drop-shadow-md line-clamp-2">
                      {sub.name}
                    </span>
                  </div>

                  {/* Bottom info */}
                  <div className="p-2.5">
                    <div className="flex items-center gap-1 text-[9px] text-slate-500 font-medium">
                      <svg className="h-3 w-3 text-purple-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span className="font-bold text-slate-700">{sub.brandCount}</span> Brands
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {sub.brands.slice(0, 2).map((b) => (
                        <span
                          key={b.id}
                          className="rounded-full bg-purple-50 px-1.5 py-0.5 text-[8px] font-semibold text-purple-600 border border-purple-100/60"
                        >
                          {b.name}
                        </span>
                      ))}
                      {sub.brands.length > 2 && (
                        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[8px] font-semibold text-slate-500">
                          +{sub.brands.length - 2}
                        </span>
                      )}
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
                  className="overflow-hidden rounded-2xl border border-slate-100 bg-white text-left shadow-[0_4px_16px_rgba(0,0,0,0.05)] transition-all active:scale-[0.96] hover:shadow-[0_8px_24px_rgba(88,28,135,0.12)]"
                >
                  {/* Gradient top area */}
                  <div
                    className={`relative h-28 bg-gradient-to-br ${
                      CAT_GRADIENTS[idx % CAT_GRADIENTS.length]
                    } flex flex-col justify-between p-3`}
                  >
                    {/* Product count badge */}
                    <div className="self-end rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-bold text-white/90 backdrop-blur-sm border border-white/10">
                      {cat.productCount} products
                    </div>
                    {/* Sub indicator badge */}
                    {cat.hasSubCategories && (
                      <span className="absolute top-2 left-2 rounded-full bg-white/15 border border-white/25 px-1.5 py-0.5 text-[8px] font-bold text-white/80">
                        {cat.subCategories.length} subcategories
                      </span>
                    )}
                    {/* Category name */}
                    <span className="text-[13px] font-extrabold text-white leading-tight drop-shadow-md line-clamp-2">
                      {cat.name}
                    </span>
                  </div>

                  {/* Bottom info */}
                  <div className="p-2.5">
                    <div className="flex items-center gap-1 text-[9px] text-slate-500 font-medium">
                      <svg className="h-3 w-3 text-purple-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span className="font-bold text-slate-700">{cat.brandCount}</span> Brands
                    </div>

                    {/* Subcategory chips OR brand chips */}
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {cat.hasSubCategories ? (
                        <>
                          {cat.subCategories.slice(0, 2).map((s) => (
                            <span
                              key={s.catId}
                              className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[8px] font-semibold text-slate-600 border border-slate-200/60"
                            >
                              {s.name}
                            </span>
                          ))}
                          {cat.subCategories.length > 2 && (
                            <span className="rounded-full bg-purple-50 px-1.5 py-0.5 text-[8px] font-semibold text-purple-500">
                              +{cat.subCategories.length - 2} more
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          {cat.brands.slice(0, 2).map((b) => (
                            <span
                              key={b.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (cat.directCatId) {
                                  router.push(
                                    `/rms/screen/${token}/category?cat=${cat.directCatId}&brand=${b.id}`
                                  );
                                }
                              }}
                              className="cursor-pointer rounded-full bg-purple-50 px-1.5 py-0.5 text-[8px] font-semibold text-purple-600 border border-purple-100/60 hover:bg-purple-100 transition-colors"
                            >
                              {b.name}
                            </span>
                          ))}
                          {cat.brands.length > 2 && (
                            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[8px] font-semibold text-slate-500">
                              +{cat.brands.length - 2}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </button>
              ))}
        </div>
      )}
    </div>
  );
}

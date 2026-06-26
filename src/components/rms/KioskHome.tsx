"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Product = { id: string; name: string; sku: string; brandName: string; categoryName: string; };
type Category = { id: string; name: string; productCount: number; brandCount: number; brands: { id: string; name: string }[] };
type Rack = {
  id: string;
  name: string;
  blockId: string | null;
  blockName: string | null;
  floorName: string | null;
  categories: Category[];
  products: Product[];
};

export default function KioskHome({
  token,
  branchName,
  racks,
}: {
  token: string;
  branchName: string;
  racks: Rack[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [rackId, setRackId] = useState<string>(racks[0]?.id ?? "");
  const scrollRef = useRef<HTMLDivElement>(null);


  // Distinct blocks among this screen's racks (header Block selector).
  const blocks = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of racks) if (r.blockId) m.set(r.blockId, r.blockName ?? "Block");
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [racks]);

  const selectedRack = racks.find((r) => r.id === rackId) ?? racks[0] ?? null;
  const selectedBlockId = selectedRack?.blockId ?? "";
  const racksInBlock = racks.filter((r) => r.blockId === selectedBlockId);

  const filtered = useMemo(() => {
    const cats = selectedRack?.categories ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return cats;
    return cats.filter((c) => c.name.toLowerCase().includes(q) || c.brands.some((b) => b.name.toLowerCase().includes(q)));
  }, [selectedRack, query]);

  const productSearchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    
    const prodMap = new Map<string, { id: string, name: string, sku: string, brandName: string, categoryName: string, racks: { id: string, name: string }[] }>();
    
    for (const r of racksInBlock) {
      for (const p of r.products || []) {
        if (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.brandName.toLowerCase().includes(q) || p.categoryName.toLowerCase().includes(q)) {
          if (!prodMap.has(p.id)) {
            prodMap.set(p.id, { id: p.id, name: p.name, sku: p.sku, brandName: p.brandName, categoryName: p.categoryName, racks: [] });
          }
          const entry = prodMap.get(p.id)!;
          if (!entry.racks.some(rack => rack.id === r.id)) {
            entry.racks.push({ id: r.id, name: r.name });
          }
        }
      }
    }
    return Array.from(prodMap.values());
  }, [racksInBlock, query]);

  function onBlockChange(blockId: string) {
    const firstRack = racks.find((r) => r.blockId === blockId);
    if (firstRack) setRackId(firstRack.id);
  }

  function scrollBy(dir: number) {
    scrollRef.current?.scrollBy({ left: dir * 280, behavior: "smooth" });
  }

  // Navigate between racks using arrows
  const currentRackIndex = racksInBlock.findIndex((r) => r.id === rackId);
  function goToPrevRack() {
    if (currentRackIndex > 0) setRackId(racksInBlock[currentRackIndex - 1].id);
  }
  function goToNextRack() {
    if (currentRackIndex < racksInBlock.length - 1) setRackId(racksInBlock[currentRackIndex + 1].id);
  }



  return (
    <div className="mx-auto min-h-screen max-w-[480px] bg-[#fbfaff] pb-10">
      {/* Header — YOU ARE AT: Floor | Block ▼ | Rack ▼ */}
      <header className="bg-gradient-to-b from-[#1a052e] to-[#2d0f4d] px-4 pb-4 pt-3 text-white shadow-md">
        <div className="text-center text-[10px] uppercase tracking-[0.25em] text-purple-200/60 font-semibold">You are at</div>
        <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[13px] font-bold">
          {/* Floor */}
          <span className="inline-flex items-center gap-1.5 px-1 text-purple-100">
            <svg className="h-4 w-4 text-purple-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
              <circle cx="12" cy="11" r="2.5" />
            </svg>
            {selectedRack?.floorName ?? "—"}
          </span>

          <span className="text-purple-300/30 font-light">|</span>

          {/* Block ▼ */}
          <div className="relative inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1 text-purple-50 hover:bg-white/15 transition-colors">
            <svg className="h-4 w-4 text-purple-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M9 3v18" />
            </svg>
            <span>{selectedRack?.blockName ?? "—"}</span>
            {blocks.length > 1 ? (
              <>
                <div className="flex h-5 w-5 items-center justify-center rounded-md bg-purple-900/40 text-purple-200">
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                <select value={selectedBlockId} onChange={(e) => onBlockChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Select block">
                  {blocks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </>
            ) : (
              <div className="w-1" />
            )}
          </div>

          <span className="text-purple-300/30 font-light">|</span>

          {/* Rack ▼ */}
          <div className="relative inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1 text-purple-50 hover:bg-white/15 transition-colors">
            <svg className="h-4 w-4 text-purple-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span>{selectedRack?.name ?? "—"}</span>
            {racksInBlock.length > 1 ? (
              <>
                <div className="flex h-5 w-5 items-center justify-center rounded-md bg-purple-900/40 text-purple-200">
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                <select value={rackId} onChange={(e) => setRackId(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Select rack">
                  {racksInBlock.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </>
            ) : (
              <div className="w-1" />
            )}
          </div>
        </div>
      </header>

      {/* Welcome & Logo */}
      <div className="px-6 pt-7 text-center">
        <img src="/logo.png" alt="KC" className="mx-auto h-16 w-auto object-contain mb-2" />
        <h1 className="mt-4 text-2xl font-light tracking-wide text-slate-800 uppercase">
          WELCOME TO <span className="font-extrabold text-slate-900 tracking-wider">{branchName}</span>
        </h1>
        <p className="mt-1 text-xs font-semibold text-purple-600 tracking-wider">Discover Products, Brands &amp; Materials</p>

      </div>

      {/* Purple Border Search Bar */}
      <div className="px-10 mt-5">
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-purple-500">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by products, brands & materials..."
            className="w-full rounded-full border border-purple-300 py-2 pl-11 pr-4 text-xs text-slate-700 placeholder-slate-400 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-400/40" />
        </div>
      </div>

      {/* What's in this rack */}
      <div className="relative mt-6 px-10">
        <div className="relative rounded-[24px] bg-white py-4 px-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-purple-50">
          {/* Left Arrow — prev rack */}
          {racksInBlock.length > 1 && currentRackIndex > 0 && (
            <button type="button" onClick={goToPrevRack} aria-label="Previous rack"
              className="absolute -left-10 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[#f5ebff] text-purple-600 shadow-md border border-purple-100/50 active:scale-90 transition-all">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          <h2 className="text-center text-sm font-extrabold tracking-widest text-purple-700 uppercase">
            {query.trim().length > 0 ? `SEARCH RESULTS IN ${selectedRack?.blockName ?? "BLOCK"}` : "WHAT'S IN THIS RACK ?"}
          </h2>
          {/* Rack breadcrumb + navigation dots */}
          {selectedRack && !query.trim() && (
            <div className="mt-2.5 flex flex-col items-center gap-1.5">
              <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-purple-400/80">
                <span className="h-2 w-2 rounded-sm bg-purple-600" />
                {[
                  selectedRack.floorName?.replace(/\s+/g, ""),
                  selectedRack.blockName?.replace(/\s+/g, ""),
                  selectedRack.name?.replace(/\s+/g, "")
                ].filter(Boolean).join(".")}
              </div>
              {/* Rack dots indicator */}
              {racksInBlock.length > 1 && (
                <div className="flex items-center gap-1 mt-0.5">
                  {racksInBlock.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRackId(r.id)}
                      className={`h-1.5 rounded-full transition-all ${
                        r.id === rackId ? "w-4 bg-purple-600" : "w-1.5 bg-purple-200"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {query.trim().length > 0 ? (
            productSearchResults.length === 0 ? (
              <div className="py-14 text-center text-xs font-medium text-slate-400">No products found matching your search in this block.</div>
            ) : (
              <div className="mt-5 grid grid-cols-2 gap-3 relative z-10">
                {productSearchResults.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => router.push(`/rms/screen/${token}/product/${p.id}?rack=${p.racks[0].id}`)}
                    className="overflow-hidden rounded-[18px] bg-white border border-slate-100 shadow-[0_4px_16px_rgba(0,0,0,0.05)] flex flex-col text-left active:scale-[0.97] transition-all"
                  >
                    <div className="relative h-20 bg-gradient-to-b from-[#e3dac9] to-[#bca685] flex flex-col justify-end p-2.5">
                      <span className="text-[11px] font-extrabold text-white leading-tight drop-shadow-md line-clamp-2">{p.name}</span>
                    </div>
                    <div className="flex flex-col gap-1 p-2.5 flex-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider line-clamp-1">{p.brandName} • {p.categoryName}</span>
                      <span className="text-[8.5px] font-semibold text-slate-400">SKU: {p.sku}</span>
                      <div className="flex-1" />
                      <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex flex-wrap gap-1">
                        {p.racks.map(r => (
                          <span key={r.id} className="rounded-md bg-purple-50 px-1.5 py-0.5 text-[8.5px] font-extrabold text-purple-600 border border-purple-100/50">
                            Rack {r.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : (
            filtered.length === 0 ? (
              <div className="py-14 text-center text-xs font-medium text-slate-400">No products in this rack yet.</div>
            ) : (
              <div className="mt-5 relative">
                {/* Vertical divider between columns */}
                <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-purple-200/80 z-0 rounded-full" />
                {/* Horizontal divider between rows */}
                {(() => {
                  const numRows = Math.ceil(filtered.length / 2);
                  return Array.from({ length: Math.max(0, numRows - 1) }).map((_, idx) => {
                    const percentage = ((idx + 1) / numRows) * 100;
                    return (
                      <div
                        key={idx}
                        className="absolute inset-x-0 h-px bg-purple-200/80 z-0 rounded-full"
                        style={{ top: `calc(${percentage}% - 0.5px)` }}
                      />
                    );
                  });
                })()}
                <div className="relative grid grid-cols-2 gap-3 z-10">
                  {filtered.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => {
                        router.push(`/rms/screen/${token}/category?cat=${c.id}&rack=${selectedRack?.id}`);
                      }}
                      className="cursor-pointer overflow-hidden rounded-[18px] border border-slate-100 bg-white text-left shadow-[0_4px_16px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] active:scale-[0.97]"
                    >
                      {/* Image / gradient area */}
                      <div className="relative h-28 bg-gradient-to-b from-[#e3dac9] to-[#bca685] flex flex-col justify-end p-3">
                        <span className="text-[13px] font-extrabold text-white leading-tight drop-shadow-md">{c.name}</span>
                      </div>
                      <div className="p-2.5">
                        <div className="text-[9px] text-slate-500 font-medium">
                          <span className="font-extrabold text-slate-700">{c.productCount}</span> Products{" "}
                          <span className="mx-0.5 text-slate-300">|</span>{" "}
                          <span className="font-extrabold text-slate-700">{c.brandCount}</span> Brands
                        </div>
                        <div className="my-1.5 border-t border-slate-100" />
                        <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Brands Available</div>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {c.brands.slice(0, 2).map((b) => (
                            <button
                              key={b.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/rms/screen/${token}/category?cat=${c.id}&rack=${selectedRack?.id}&brand=${b.id}`);
                              }}
                              className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[8px] font-semibold text-slate-600 border border-slate-200/50 hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200 transition-colors z-20 relative"
                            >
                              {b.name}
                            </button>
                          ))}
                          {c.brands.length > 2 && (
                            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[8px] font-semibold text-slate-600">+{c.brands.length - 2}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}


          {/* Right Arrow — next rack */}
          {racksInBlock.length > 1 && currentRackIndex < racksInBlock.length - 1 && (
            <button type="button" onClick={goToNextRack} aria-label="Next rack"
              className="absolute -right-10 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[#f5ebff] text-purple-600 shadow-md border border-purple-100/50 active:scale-90 transition-all">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

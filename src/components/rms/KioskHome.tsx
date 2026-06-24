"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Category = { id: string; name: string; productCount: number; brandCount: number; brands: string[] };
type Rack = {
  id: string;
  name: string;
  blockId: string | null;
  blockName: string | null;
  floorName: string | null;
  categories: Category[];
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
    return cats.filter((c) => c.name.toLowerCase().includes(q) || c.brands.some((b) => b.toLowerCase().includes(q)));
  }, [selectedRack, query]);

  function onBlockChange(blockId: string) {
    const firstRack = racks.find((r) => r.blockId === blockId);
    if (firstRack) setRackId(firstRack.id);
  }

  function scrollBy(dir: number) {
    scrollRef.current?.scrollBy({ left: dir * 280, behavior: "smooth" });
  }

  return (
    <div className="mx-auto min-h-screen max-w-[480px] bg-white">
      {/* Header — YOU ARE AT: Floor | Block ▼ | Rack ▼ */}
      <header className="bg-gradient-to-b from-[#2e0a4f] to-[#4c1d95] px-3 pb-3 pt-2.5 text-white">
        <div className="text-center text-[9px] uppercase tracking-[0.3em] text-white/55">You are at</div>
        <div className="mt-2 flex items-center justify-center gap-2 text-sm font-semibold">
          {/* Floor (static) */}
          <span className="inline-flex items-center gap-1.5 px-1">
            <svg className="h-4 w-4 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" /><circle cx="12" cy="11" r="2.5" /></svg>
            {selectedRack?.floorName ?? "—"}
          </span>

          <span className="h-5 w-px bg-white/25" />

          {/* Block ▼ */}
          <div className="relative inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5">
            <svg className="h-4 w-4 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} /><path strokeWidth={2} d="M3 9h18M9 3v18" /></svg>
            <span>{selectedRack?.blockName ?? "—"}</span>
            {blocks.length > 1 && (
              <>
                <svg className="h-3.5 w-3.5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                <select value={selectedBlockId} onChange={(e) => onBlockChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Select block">
                  {blocks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </>
            )}
          </div>

          <span className="h-5 w-px bg-white/25" />

          {/* Rack ▼ */}
          <div className="relative inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5">
            <svg className="h-4 w-4 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            <span>{selectedRack?.name ?? "—"}</span>
            {racksInBlock.length > 1 && (
              <>
                <svg className="h-3.5 w-3.5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                <select value={rackId} onChange={(e) => setRackId(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Select rack">
                  {racksInBlock.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Welcome */}
      <div className="px-5 pt-6 text-center">
        <img src="/logo.jpeg" alt="KC" className="mx-auto h-12 w-auto object-contain" />
        <h1 className="mt-3 text-2xl font-light tracking-wide text-slate-800">
          WELCOME TO <span className="font-bold text-slate-900">{branchName}</span>
        </h1>
        <p className="mt-1 text-sm font-medium text-[#7c3aed]">Discover Products, Brands &amp; Materials</p>

        <div className="relative mt-5">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#7c3aed]">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by products, brands & materials..."
            className="w-full rounded-full border border-[#d8b4fe] py-3 pl-11 pr-4 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40" />
        </div>
      </div>

      {/* What's in this rack */}
      <div className="relative mt-6 px-3 pb-10">
        <div className="rounded-2xl bg-[#faf8ff] p-4 shadow-sm">
          <h2 className="text-center text-base font-bold tracking-wide text-[#7c3aed]">WHAT&apos;S IN THIS RACK ?</h2>
          {selectedRack && (
            <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#7c3aed]" />
              {[selectedRack.floorName, selectedRack.blockName, selectedRack.name].filter(Boolean).join(" · ")}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">No products in this rack yet.</div>
          ) : (
            <div ref={scrollRef} className="mt-4 flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {filtered.map((c) => (
                <button key={c.id} type="button" onClick={() => router.push(`/rms/screen/${token}/category?cat=${c.id}&rack=${selectedRack?.id}`)}
                  className="w-[170px] shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition-transform active:scale-[0.98]">
                  <div className="relative h-40 bg-gradient-to-br from-[#e7dccb] to-[#cbb89a]">
                    <span className="absolute bottom-2 left-3 text-lg font-bold text-white drop-shadow">{c.name}</span>
                  </div>
                  <div className="p-3">
                    <div className="text-xs text-slate-600">
                      <span className="font-bold text-slate-800">{c.productCount}</span> Products{" "}
                      <span className="ml-1 font-bold text-slate-800">{c.brandCount}</span> Brands
                    </div>
                    <div className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Brands Available</div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {c.brands.slice(0, 4).map((b) => (
                        <span key={b} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{b}</span>
                      ))}
                      {c.brands.length > 4 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">+{c.brands.length - 4}</span>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {filtered.length > 1 && (
          <>
            <button type="button" onClick={() => scrollBy(-1)} aria-label="Previous"
              className="absolute left-1 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#7c3aed] shadow">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button type="button" onClick={() => scrollBy(1)} aria-label="Next"
              className="absolute right-1 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#7c3aed] shadow">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

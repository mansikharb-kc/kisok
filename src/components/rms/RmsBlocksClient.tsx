"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Category = { id: string; name: string };
type ScreenRef = { id: string; name: string | null; token: string | null };
type Rack = { id: string; name: string; code: string | null; copyCount: number; screen: ScreenRef | null };
type Block = {
  id: string;
  name: string;
  code: string | null;
  programId: string | null;
  programName: string;
  copyCount: number;
  categories: Category[];
  racks: Rack[];
};
type Screen = { id: string; name: string | null; token: string | null; status: string };

export default function RmsBlocksClient({
  branchName,
  blocks,
  screens,
}: {
  branchName: string;
  blocks: Block[];
  screens: Screen[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, Set<string>>>({}); // blockId -> set of rackIds
  const [pickScreen, setPickScreen] = useState<Record<string, string>>({}); // blockId -> screenId
  const [busy, setBusy] = useState<string | null>(null);

  function toggle(blockId: string, rackId: string) {
    setSelected((prev) => {
      const set = new Set(prev[blockId] ?? []);
      if (set.has(rackId)) set.delete(rackId); else set.add(rackId);
      return { ...prev, [blockId]: set };
    });
  }

  async function postRackScreen(rackIds: string[], screenId: string | null, key: string) {
    if (rackIds.length === 0) return;
    setBusy(key);
    try {
      const res = await fetch("/api/rms/rack-screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rackIds, screenId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data.error || "Action failed"); return; }
      setSelected((prev) => ({ ...prev, [key]: new Set() }));
      router.refresh();
    } catch {
      alert("Request failed. Check your connection.");
    } finally {
      setBusy(null);
    }
  }

  function mapSelected(blockId: string) {
    const screenId = pickScreen[blockId];
    if (!screenId) { alert("Select a screen first"); return; }
    postRackScreen([...(selected[blockId] ?? [])], screenId, blockId);
  }

  function unmapSelected(blockId: string) {
    postRackScreen([...(selected[blockId] ?? [])], null, blockId);
  }

  // Blocks belong to a program (warehouse is per-program) — group them by program.
  const programGroups = (() => {
    const m = new Map<string, Block[]>();
    for (const b of blocks) {
      if (!m.has(b.programName)) m.set(b.programName, []);
      m.get(b.programName)!.push(b);
    }
    return [...m.entries()].map(([programName, items]) => ({ programName, blocks: items }));
  })();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Blocks</h1>
        <p className="text-sm text-slate-500 mt-1">
          Blocks of {branchName}. Select racks in a block and map them to a screen (a screen can cover many racks). Create screens on the <span className="font-semibold">RMS Screens</span> page first.
        </p>
      </div>

      {blocks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 backdrop-blur-md p-12 text-center text-sm text-slate-400">
          No blocks in this branch. Create blocks in Warehouse &amp; Locations first.
        </div>
      ) : (
        <div className="space-y-8">
          {programGroups.map((g) => (
            <div key={g.programName} className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1">{g.programName}</h2>
              <div className="space-y-4">
          {g.blocks.map((b) => {
            const sel = selected[b.id] ?? new Set<string>();
            return (
              <div key={b.id} className="rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-lg font-bold text-slate-900 truncate">{b.name}</div>
                    {b.code && <div className="font-mono text-[11px] text-slate-400">{b.code}</div>}
                  </div>
                  <div className="text-right text-[11px] text-slate-400 shrink-0">{b.racks.length} racks · {b.copyCount} items</div>
                </div>

                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Deals in (categories)</div>
                  {b.categories.length === 0 ? (
                    <span className="text-xs text-slate-400">No categories assigned to this block.</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {b.categories.map((c) => (
                        <span key={c.id} className="rounded-full bg-brand-50 border border-brand-200 text-brand-800 text-xs px-2.5 py-1">{c.name}</span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Racks — select & map to a screen</div>
                  {b.racks.length === 0 ? (
                    <p className="text-xs text-slate-400">No racks in this block. Add racks in Warehouse &amp; Locations.</p>
                  ) : (
                    <>
                      <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
                        {b.racks.map((r) => (
                          <label key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer">
                            <input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(b.id, r.id)} />
                            <span className="font-medium text-slate-800">{r.name}</span>
                            {r.code && <span className="font-mono text-[11px] text-slate-400">{r.code}</span>}
                            <span className="text-[11px] text-slate-400">· {r.copyCount} items</span>
                            <span className="ml-auto">
                              {r.screen ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                                  <span className="h-1.5 w-1.5 rounded-full bg-white" /> {r.screen.name || "Screen"}
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400">unmapped</span>
                              )}
                            </span>
                          </label>
                        ))}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-500">{sel.size} selected</span>
                        <select
                          value={pickScreen[b.id] ?? ""}
                          onChange={(e) => setPickScreen((p) => ({ ...p, [b.id]: e.target.value }))}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        >
                          <option value="">— Select screen —</option>
                          {screens.map((s) => <option key={s.id} value={s.id}>{s.name || `Screen ${s.id}`}</option>)}
                        </select>
                        <button type="button" onClick={() => mapSelected(b.id)} disabled={sel.size === 0 || busy === b.id}
                          className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                          {busy === b.id ? "Saving…" : "Map selected"}
                        </button>
                        <button type="button" onClick={() => unmapSelected(b.id)} disabled={sel.size === 0 || busy === b.id}
                          className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                          Unmap selected
                        </button>
                      </div>
                      {screens.length === 0 && (
                        <p className="mt-2 text-[11px] text-amber-600">No screens yet. Create one on the RMS Screens page first.</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

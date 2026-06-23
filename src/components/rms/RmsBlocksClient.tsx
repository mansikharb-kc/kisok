"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Category = { id: string; name: string };
type Block = {
  id: string;
  name: string;
  code: string | null;
  childCount: number;
  copyCount: number;
  categories: Category[];
};
type Screen = { id: string; name: string | null; token: string | null; status: string; locationNodeId: string | null };

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
  const screenByBlock = new Map(screens.filter((s) => s.locationNodeId).map((s) => [String(s.locationNodeId), s]));
  const unmapped = screens.filter((s) => !s.locationNodeId);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [pick, setPick] = useState<Record<string, string>>({}); // blockId -> screenId to map
  const [copied, setCopied] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const kioskUrl = (token: string | null) => (token ? `${origin}/rms/screen/${token}` : "—");

  async function mapScreen(blockId: string) {
    const screenId = pick[blockId];
    if (!screenId) return;
    setBusyId(blockId);
    try {
      const res = await fetch(`/api/rms/screens/${screenId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationNodeId: blockId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data.error || "Could not map screen"); return; }
      router.refresh();
    } catch {
      alert("Request failed. Check your connection.");
    } finally {
      setBusyId(null);
    }
  }

  async function unmap(screenId: string) {
    if (!confirm("Unmap this screen from the block?")) return;
    setBusyId(screenId);
    try {
      const res = await fetch(`/api/rms/screens/${screenId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationNodeId: null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data.error || "Could not unmap screen"); return; }
      router.refresh();
    } catch {
      alert("Request failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function copy(url: string, id: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Blocks</h1>
        <p className="text-sm text-slate-500 mt-1">
          Blocks of {branchName} — categories in each block, and map a screen to it. Create screens on the <span className="font-semibold">RMS Screens</span> page first.
        </p>
      </div>

      {blocks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 backdrop-blur-md p-12 text-center text-sm text-slate-400">
          No blocks in this branch. Create blocks in Warehouse &amp; Locations first.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {blocks.map((b) => {
            const screen = screenByBlock.get(String(b.id));
            return (
              <div key={b.id} className="rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-lg font-bold text-slate-900 truncate">{b.name}</div>
                    {b.code && <div className="font-mono text-[11px] text-slate-400">{b.code}</div>}
                  </div>
                  <div className="text-right text-[11px] text-slate-400 shrink-0">
                    <div>{b.childCount} sub-nodes</div>
                    <div>{b.copyCount} items</div>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Categories in this block</div>
                  {b.categories.length === 0 ? (
                    <span className="text-xs text-slate-400">No categories assigned.</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {b.categories.map((c) => (
                        <span key={c.id} className="rounded-full bg-brand-50 border border-brand-200 text-brand-800 text-xs px-2.5 py-1">
                          {c.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100 pt-3">
                  {screen ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                          <span className="h-1.5 w-1.5 rounded-full bg-white" /> {screen.name || "Screen"} mapped
                        </span>
                        <button
                          type="button"
                          onClick={() => unmap(screen.id)}
                          disabled={busyId === screen.id}
                          className="text-[11px] text-rose-600 hover:underline disabled:opacity-50"
                        >
                          Unmap
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-slate-500 truncate">{kioskUrl(screen.token)}</span>
                        {screen.token && (
                          <button
                            type="button"
                            onClick={() => copy(kioskUrl(screen.token), screen.id)}
                            className="shrink-0 rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50"
                          >
                            {copied === screen.id ? "Copied" : "Copy"}
                          </button>
                        )}
                      </div>
                    </div>
                  ) : unmapped.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      No unmapped screens. Create a screen on the <span className="font-semibold">RMS Screens</span> page first.
                    </p>
                  ) : (
                    <div className="flex items-center gap-2">
                      <select
                        value={pick[b.id] ?? ""}
                        onChange={(e) => setPick((p) => ({ ...p, [b.id]: e.target.value }))}
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="">— Select a screen —</option>
                        {unmapped.map((s) => (
                          <option key={s.id} value={s.id}>{s.name || `Screen ${s.id}`}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => mapScreen(b.id)}
                        disabled={!pick[b.id] || busyId === b.id}
                        className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                      >
                        {busyId === b.id ? "Mapping…" : "Map Screen"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

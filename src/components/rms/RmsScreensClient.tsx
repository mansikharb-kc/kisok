"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ScreenRackRef = { id: string; name: string; blockName: string | null };
type Screen = { id: string; name: string | null; token: string | null; status: string; racks: ScreenRackRef[] };

export default function RmsScreensClient({
  branchName,
  screens,
}: {
  branchName: string;
  screens: Screen[];
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const kioskUrl = (token: string | null) => (token ? `${origin}/rms/screen/${token}` : "—");

  async function createScreen(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/rms/screens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Could not create screen"); return; }
      setCreateOpen(false);
      setName("");
      router.refresh();
    } catch {
      setError("Request failed. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(url: string, id: string) {
    try { await navigator.clipboard.writeText(url); setCopied(id); setTimeout(() => setCopied(null), 1500); } catch { /* ignore */ }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">RMS Screens</h1>
          <p className="text-sm text-slate-500 mt-1">
            Screens of {branchName}. Add a screen here, then map it to racks on the <span className="font-semibold">Blocks</span> page.
          </p>
        </div>
        <button type="button" onClick={() => { setError(""); setName(""); setCreateOpen(true); }}
          className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          + Add Screen
        </button>
      </div>

      {screens.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 backdrop-blur-md p-12 text-center text-sm text-slate-400">
          No screens yet. Click “+ Add Screen”, then map it to racks on the Blocks page.
        </div>
      ) : (
        <div className="space-y-3">
          {screens.map((s) => (
            <div key={s.id} className="rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-slate-900">{s.name || `Screen ${s.id}`}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-[11px] text-slate-500 truncate">{kioskUrl(s.token)}</span>
                    {s.token && (
                      <button type="button" onClick={() => copy(kioskUrl(s.token), s.id)}
                        className="shrink-0 rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50">
                        {copied === s.id ? "Copied" : "Copy"}
                      </button>
                    )}
                  </div>
                </div>
                <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-white ${s.status === "active" ? "bg-emerald-600" : "bg-slate-500"}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-white" /><span className="capitalize">{s.status}</span>
                </span>
              </div>
              <div className="mt-3 border-t border-slate-100 pt-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Covers {s.racks.length} rack{s.racks.length !== 1 ? "s" : ""}
                </div>
                {s.racks.length === 0 ? (
                  <span className="text-xs text-slate-400">No racks mapped yet — map on the Blocks page.</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {s.racks.map((r) => (
                      <span key={r.id} className="rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs px-2.5 py-1">
                        {r.blockName ? `${r.blockName} / ` : ""}{r.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCreateOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900">Add Screen</h2>
            <p className="text-sm text-slate-500 mt-1">Create a screen, then map it to racks on the Blocks page.</p>
            {error && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <form onSubmit={createScreen} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-1">Screen name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Screen 1"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setCreateOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={busy} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{busy ? "Saving…" : "Create"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

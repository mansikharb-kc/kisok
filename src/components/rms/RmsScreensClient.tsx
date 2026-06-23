"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Screen = {
  id: string;
  name: string | null;
  token: string | null;
  viewDefault: string;
  status: string;
  deviceIdentifier: string | null;
  location: { name: string; code: string | null; path: string | null } | null;
};

export default function RmsScreensClient({
  branchName,
  screens,
}: {
  branchName: string;
  screens: Screen[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const kioskUrl = (token: string | null) => (token ? `${origin}/rms/screen/${token}` : "—");

  async function submit(e: React.FormEvent) {
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
      if (!res.ok) {
        setError(data.error || "Could not create screen");
        return;
      }
      setOpen(false);
      setName("");
      router.refresh();
    } catch {
      setError("Request failed. Check your connection.");
    } finally {
      setBusy(false);
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">RMS Screens</h1>
          <p className="text-sm text-slate-500 mt-1">
            Create kiosk screens for {branchName}. Map each to a block on the <span className="font-semibold">Blocks</span> page.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setError(""); setName(""); setOpen(true); }}
          className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          + Add Screen
        </button>
      </div>

      {screens.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 backdrop-blur-md p-12 text-center text-sm text-slate-400">
          No screens yet. Click “+ Add Screen” to create one, then map it to a block.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md overflow-hidden">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium w-[22%]">Screen</th>
                <th className="px-4 py-3 text-left font-medium w-[22%]">Block</th>
                <th className="px-4 py-3 text-left font-medium w-[34%]">Kiosk URL</th>
                <th className="px-4 py-3 text-left font-medium w-[10%]">View</th>
                <th className="px-4 py-3 text-left font-medium w-[12%]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {screens.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 align-middle">
                    <div className="font-semibold text-slate-900 truncate">{s.name || `Screen ${s.id}`}</div>
                  </td>
                  <td className="px-4 py-3 align-middle truncate">
                    {s.location ? (
                      <span className="text-slate-700">{s.location.name}{s.location.code ? ` (${s.location.code})` : ""}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">Unmapped</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-slate-500 truncate">{kioskUrl(s.token)}</span>
                      {s.token && (
                        <button
                          type="button"
                          onClick={() => copy(kioskUrl(s.token), s.id)}
                          className="shrink-0 rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50"
                        >
                          {copied === s.id ? "Copied" : "Copy"}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-white">{s.viewDefault}</span>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-white ${s.status === "active" ? "bg-emerald-600" : "bg-slate-500"}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      <span className="capitalize">{s.status}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900">Add Screen</h2>
            <p className="text-sm text-slate-500 mt-1">Create a screen, then map it to a block on the Blocks page.</p>

            {error && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            <form onSubmit={submit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-1">Screen name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  placeholder="e.g. Screen 1"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" disabled={busy} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                  {busy ? "Saving…" : "Create Screen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

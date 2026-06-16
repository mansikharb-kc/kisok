"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type SelectedProgramRow = {
  id: string;
  programId: string;
  name: string;
  code: string;
  status: string;
  approvalStatus: string;
  createdAt: string;
};

export type AvailableProgramRow = {
  id: string;
  name: string;
  code: string;
};

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rejected: "bg-rose-50 text-rose-700 border-rose-200",
  };
  const cls = map[status] ?? "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}

export default function BranchProgramsClient({
  selected,
  available,
}: {
  selected: SelectedProgramRow[];
  available: AvailableProgramRow[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return available;
    return available.filter((p) => `${p.name} ${p.code}`.toLowerCase().includes(q));
  }, [available, query]);

  async function request(programId: string) {
    setBusyId(programId);
    setError("");
    try {
      const res = await fetch("/api/branch-programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError((data && data.error) || "Failed to request program");
        return;
      }
      router.refresh();
    } catch {
      setError("Request failed. Check your session or network connection.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/branch-programs/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError((data && data.error) || "Failed to remove program");
        return;
      }
      router.refresh();
    } catch {
      setError("Request failed. Check your session or network connection.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      )}

      {/* Selected programs */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">Selected Programs</h3>
          <p className="mt-1 text-xs text-slate-500">Programs requested for your branch and their HO approval status.</p>
        </div>

        {selected.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-400">
            No programs selected yet. Request one from the list below.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Program</th>
                  <th className="px-4 py-3 text-left font-medium">Code</th>
                  <th className="px-4 py-3 text-left font-medium">Approval</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selected.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 align-middle font-semibold text-slate-900">{p.name}</td>
                    <td className="px-4 py-3 align-middle font-mono text-[11px] text-slate-600">{p.code}</td>
                    <td className="px-4 py-3 align-middle">
                      <StatusPill status={p.approvalStatus} />
                    </td>
                    <td className="px-4 py-3 align-middle text-right">
                      {p.approvalStatus === "approved" ? (
                        <span className="text-xs text-slate-400">Locked</span>
                      ) : (
                        <button
                          onClick={() => remove(p.id)}
                          disabled={busyId === p.id}
                          className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-60"
                        >
                          {busyId === p.id ? "Removing…" : "Remove"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Request a program */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">Request a Program</h3>
          <p className="mt-1 text-xs text-slate-500">Active HO programs not yet selected for your branch.</p>
        </div>

        <div className="px-6 py-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search programs or codes…"
            className="w-full max-w-md rounded-lg border border-slate-300 bg-white/60 backdrop-blur-md px-4 py-2.5 text-sm placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-400">
            {available.length === 0 ? "All active programs are already selected." : "No programs match your search."}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-6 py-3 hover:bg-slate-50/60">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900">{p.name}</div>
                  <div className="font-mono text-[11px] text-slate-500">{p.code}</div>
                </div>
                <button
                  onClick={() => request(p.id)}
                  disabled={busyId === p.id}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-60"
                >
                  {busyId === p.id ? "Requesting…" : "Request program"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

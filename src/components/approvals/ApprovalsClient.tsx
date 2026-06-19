"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/format";

export type ChangeRequestRow = {
  id: string;
  type: string;
  payload: any;
  branchId: string | null;
  branchName: string | null;
  requestedByName: string;
  status: "pending" | "approved" | "rejected";
  decidedAt: string | null;
  reason: string | null;
  createdAt: string;
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

function summarize(req: ChangeRequestRow): string {
  if (req.type === "BRANCH_PROGRAM") {
    const branch = req.branchName || (req.payload?.branchId ? `Branch ${req.payload.branchId}` : "A branch");
    const program = req.payload?.programName || (req.payload?.programId ? `Program ${req.payload.programId}` : "a program");
    return `${branch} wants ${program}`;
  }
  if (req.type === "NEW_BRAND") {
    const brand = req.payload?.brandName || (req.payload?.brandId ? `Brand ${req.payload.brandId}` : "a new brand");
    const code = req.payload?.brandCode ? ` (${req.payload.brandCode})` : "";
    return `${req.branchName || "Onboarding lead"} requested ${brand}${code}`;
  }
  if (req.type === "NEW_PROGRAM") {
    const branch = req.branchName || "A branch";
    const program = req.payload?.name || "a program";
    return `${branch} requested to create program "${program}"`;
  }
  return req.type.replace(/_/g, " ");
}

function formatTime(iso: string) {
  return formatDateTime(iso);
}

export default function ApprovalsClient({ initialRequests }: { initialRequests: ChangeRequestRow[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");

  const pending = useMemo(() => initialRequests.filter((r) => r.status === "pending"), [initialRequests]);
  const history = useMemo(() => initialRequests.filter((r) => r.status !== "pending"), [initialRequests]);

  const availableTypes = useMemo(() => {
    return Array.from(new Set(initialRequests.map((r) => r.type))).sort();
  }, [initialRequests]);

  const availableBranches = useMemo(() => {
    const names = initialRequests.map((r) => r.branchName).filter(Boolean) as string[];
    return Array.from(new Set(names)).sort();
  }, [initialRequests]);

  const visible = useMemo(() => {
    return initialRequests.filter((r) => {
      const matchesTab = tab === "pending" ? r.status === "pending" : r.status !== "pending";
      if (!matchesTab) return false;

      if (typeFilter && r.type !== typeFilter) return false;

      if (branchFilter && r.branchName !== branchFilter) return false;

      if (query.trim()) {
        const q = query.toLowerCase().trim();
        const typeStr = r.type.replace(/_/g, " ").toLowerCase();
        const summaryStr = summarize(r).toLowerCase();
        const requesterStr = r.requestedByName.toLowerCase();
        const branchStr = (r.branchName || "").toLowerCase();
        const reasonStr = (r.reason || "").toLowerCase();
        
        const matchesQuery = 
          typeStr.includes(q) ||
          summaryStr.includes(q) ||
          requesterStr.includes(q) ||
          branchStr.includes(q) ||
          reasonStr.includes(q) ||
          (r.payload?.remarks || "").toLowerCase().includes(q);
          
        if (!matchesQuery) return false;
      }

      return true;
    });
  }, [initialRequests, tab, typeFilter, branchFilter, query]);

  async function decide(req: ChangeRequestRow, decision: "approved" | "rejected") {
    let reason: string | null = null;
    if (decision === "rejected") {
      reason = window.prompt("Reason for rejection (optional):", "") ?? "";
    }
    setBusyId(req.id);
    setError("");
    try {
      const res = await fetch(`/api/change-requests/${req.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reason }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError((data && data.error) || "Failed to submit decision");
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
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      )}

      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-6">
          <button
            onClick={() => setTab("pending")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === "pending" ? "border-brand-600 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Pending ({pending.length})
          </button>
          <button
            onClick={() => setTab("history")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === "history" ? "border-brand-600 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Decision History ({history.length})
          </button>
        </nav>
      </div>

      {/* Filters */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search approvals..."
            className="w-full rounded-xl border border-slate-300 bg-white/60 backdrop-blur-md py-2.5 pl-10 pr-4 text-sm placeholder-slate-400 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        <div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white/60 backdrop-blur-md px-3 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            <option value="">All Request Types</option>
            {availableTypes.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white/60 backdrop-blur-md px-3 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            <option value="">All Branches</option>
            {availableBranches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md shadow-sm">
        {visible.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-slate-400">No change requests in this inbox.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">Summary</th>
                  <th className="px-4 py-3 text-left font-medium">Requester</th>
                  <th className="px-4 py-3 text-left font-medium">Submitted</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((req) => (
                  <tr key={req.id} className="align-middle hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <span className="inline-block rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                        {req.type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-800">
                      <div className="font-medium">{summarize(req)}</div>
                      {req.payload?.remarks && (
                        <div className="mt-1 text-xs text-slate-500 bg-slate-50/50 border border-slate-100 rounded p-1.5 font-normal max-w-md break-words">
                          <span className="font-semibold text-slate-600 block text-[10px] uppercase tracking-wider mb-0.5">Remarks:</span>
                          {req.payload.remarks}
                        </div>
                      )}
                      {req.status !== "pending" && req.reason && (
                        <div className="mt-0.5 text-xs text-slate-400">Reason: {req.reason}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{req.requestedByName}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatTime(req.createdAt)}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={req.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {req.status === "pending" ? (
                        <div className="inline-flex justify-end gap-2">
                          <button
                            onClick={() => decide(req, "rejected")}
                            disabled={busyId === req.id}
                            className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-60"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => decide(req, "approved")}
                            disabled={busyId === req.id}
                            className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                          >
                            {busyId === req.id ? "Saving…" : "Approve"}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">
                          {req.decidedAt ? formatTime(req.decidedAt) : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type BrandRow = {
  id: string;
  brandNo: string | null;
  name: string;
  code: string;
  brandType: string | null;
  logoUrl: string | null;
  categories: string[];
  approvalStatus: string;
  status: string;
  productCount: number;
  sellerCount: number;
  branchCount: number;
};

const APPROVAL_BADGE: Record<string, string> = {
  draft: "bg-amber-500 text-white",
  pending: "bg-amber-500 text-white",
  approved: "bg-emerald-600 text-white",
  rejected: "bg-rose-600 text-white",
};

function BrandLogo({ url, name }: { url: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const initials = name.trim().slice(0, 2).toUpperCase();

  if (url && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} onError={() => setFailed(true)} className="h-9 w-9 shrink-0 rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md object-contain" />;
  }

  return <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white">{initials}</div>;
}

export default function BrandsClient({ initial, readOnly = false }: { initial: BrandRow[]; readOnly?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [approval, setApproval] = useState<"all" | "approved" | "pending" | "rejected">("all");

  const visible = useMemo(() => initial.filter((b) => b.status !== "archived"), [initial]);
  const counts = useMemo(
    () => ({
      all: visible.length,
      approved: visible.filter((b) => b.approvalStatus === "approved").length,
      pending: visible.filter((b) => b.approvalStatus === "pending" || b.approvalStatus === "draft").length,
      rejected: visible.filter((b) => b.approvalStatus === "rejected").length,
    }),
    [visible]
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let base = visible;
    if (approval !== "all") {
      base = base.filter((b) =>
        approval === "pending" ? b.approvalStatus === "pending" || b.approvalStatus === "draft" : b.approvalStatus === approval
      );
    }
    if (q) base = base.filter((b) => b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q));
    return base;
  }, [visible, query, approval]);

  async function patch(b: BrandRow, body: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch(`/api/brands/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(b: BrandRow) {
    if (!confirm(`Archive brand "${b.name}"? You can restore it later from Archived.`)) return;
    setBusy(true);
    try {
      await fetch("/api/archive", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entity: "brand", id: b.id, action: "archive" }) });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const emptyState = (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 backdrop-blur-md p-12 text-center text-sm text-slate-400">
      No brands yet. Click <strong>New Brand</strong> to add one.
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative max-w-md flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search brands..." className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>

        <div className="flex items-center gap-3 lg:ml-auto">
          <span className="text-sm text-slate-500">{initial.length} total</span>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md p-1 shadow-sm">
            <button type="button" onClick={() => setViewMode("table")} className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === "table" ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
              Table
            </button>
            <button type="button" onClick={() => setViewMode("card")} className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === "card" ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
              Card
            </button>
          </div>
          {!readOnly && (
            <button type="button" onClick={() => router.push("/masters/brands/new")} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
              + New Brand
            </button>
          )}
        </div>
      </div>

      {/* Approval filter tabs */}
      <div className="flex flex-wrap gap-2">
        {([["all", "All"], ["approved", "Approved"], ["pending", "Pending"], ["rejected", "Rejected"]] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setApproval(key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              approval === key ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white/60 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {label} <span className="opacity-70">({counts[key]})</span>
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        emptyState
      ) : viewMode === "card" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((b) => (
            <div key={b.id} className={`group flex flex-col rounded border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300 ${b.status === "inactive" ? "opacity-70" : ""}`}>
              {/* Header */}
              <div className="flex items-start gap-3">
                <BrandLogo url={b.logoUrl} name={b.name} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-semibold text-slate-900">{b.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-white">{b.code}</span>
                    <span className="text-xs text-slate-500">{b.brandType ?? "—"}</span>
                  </div>
                </div>
                <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize text-white ${b.status === "active" ? "bg-emerald-600" : "bg-slate-500"}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  {b.status}
                </span>
              </div>

              {/* Categories */}
              <div className="mt-4">
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Categories</div>
                {b.categories.length === 0 ? (
                  <span className="text-xs text-slate-300">None mapped</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {b.categories.slice(0, 4).map((c) => (
                      <span key={c} className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] text-brand-700">{c}</span>
                    ))}
                    {b.categories.length > 4 ? <span title={b.categories.join(", ")} className="cursor-default self-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">+{b.categories.length - 4} more</span> : null}
                  </div>
                )}
              </div>

              {/* Usage stats */}
              <div className="mt-4 grid grid-cols-3 divide-x divide-slate-100 rounded-md border border-slate-100 bg-slate-50/60">
                <div className="px-2 py-2 text-center">
                  <div className="text-sm font-bold text-slate-800">{b.productCount}</div>
                  <div className="text-[10px] text-slate-400">Products</div>
                </div>
                <div className="px-2 py-2 text-center">
                  <div className="text-sm font-bold text-slate-800">{b.sellerCount}</div>
                  <div className="text-[10px] text-slate-400">Sellers</div>
                </div>
                <div className="px-2 py-2 text-center">
                  <div className="text-sm font-bold text-slate-800">{b.branchCount}</div>
                  <div className="text-[10px] text-slate-400">Branches</div>
                </div>
              </div>

              {/* Approval + approve/reject */}
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${APPROVAL_BADGE[b.approvalStatus] ?? "bg-slate-100 text-slate-500"}`}>{b.approvalStatus}</span>
                {!readOnly && b.approvalStatus !== "approved" && (
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => patch(b, { approvalStatus: "approved" })} disabled={busy} className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                      Approve
                    </button>
                    {b.approvalStatus !== "rejected" && (
                      <button type="button" onClick={() => patch(b, { approvalStatus: "rejected" })} disabled={busy} className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50">
                        Reject
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Row actions */}
              {!readOnly && (
                <div className="mt-3 flex items-center gap-2">
                  <button type="button" title="Edit" aria-label="Edit" onClick={() => router.push(`/masters/brands/${b.id}/edit`)} className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-brand-600 hover:bg-brand-50">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  </button>
                  <button type="button" title={b.status === "active" ? "Deactivate" : "Activate"} aria-label={b.status === "active" ? "Deactivate" : "Activate"} onClick={() => patch(b, { status: b.status === "active" ? "inactive" : "active" })} disabled={busy} className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" /></svg>
                  </button>
                  <button type="button" title="Archive" aria-label="Archive" onClick={() => remove(b)} disabled={busy} className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="22" height="5" rx="1" /><path d="M3 8v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8" /><line x1="10" y1="13" x2="14" y2="13" /></svg>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md overflow-hidden">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium w-[28%]">Brand</th>
                <th className="px-4 py-3 text-left font-medium w-[16%]">Brand ID</th>
                <th className="px-4 py-3 text-left font-medium w-[26%]">Categories</th>
                <th className="px-4 py-3 text-left font-medium w-[18%]">Usage</th>
                <th className="px-4 py-3 text-right font-medium w-[12%]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((b) => (
                <tr
                  key={b.id}
                  onClick={() => router.push(`/masters/brands/${b.id}`)}
                  className={`cursor-pointer hover:bg-slate-50 ${b.status === "inactive" ? "opacity-60" : ""}`}
                >
                  {/* Brand: logo with the name underneath */}
                  <td className="px-4 py-2.5 align-middle">
                    <div className="flex items-center gap-3">
                      <BrandLogo url={b.logoUrl} name={b.name} />
                      <span className="font-semibold text-slate-800 truncate">{b.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 align-middle">
                    <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-white">{b.code}</span>
                  </td>
                  <td className="px-4 py-2.5 align-middle">
                    {b.categories.length === 0 ? (
                      <span className="text-slate-300">—</span>
                    ) : (
                      <div className="flex flex-col gap-0.5 text-xs text-slate-600">
                        {b.categories.map((c) => <span key={c} className="truncate">{c}</span>)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 align-middle text-[11px] text-slate-500 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <span><span className="font-semibold text-slate-700">{b.productCount}</span> products</span>
                      <span className="text-slate-300">·</span>
                      <span><span className="font-semibold text-slate-700">{b.sellerCount}</span> sellers</span>
                      <span className="text-slate-300">·</span>
                      <span><span className="font-semibold text-slate-700">{b.branchCount}</span> branches</span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5 align-middle text-right" onClick={(e) => e.stopPropagation()}>
                    {readOnly ? (
                      <span className="text-xs text-slate-400 italic">View only</span>
                    ) : (
                      <div className="inline-flex justify-end gap-2">
                        <button type="button" title="Edit" aria-label="Edit" onClick={() => router.push(`/masters/brands/${b.id}/edit`)} className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-brand-600 hover:bg-slate-50">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                        </button>
                        <button type="button" title={b.status === "active" ? "Deactivate" : "Activate"} aria-label={b.status === "active" ? "Deactivate" : "Activate"} onClick={() => patch(b, { status: b.status === "active" ? "inactive" : "active" })} disabled={busy} className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" /></svg>
                        </button>
                        <button type="button" title="Archive" aria-label="Archive" onClick={() => remove(b)} disabled={busy} className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="22" height="5" rx="1" /><path d="M3 8v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8" /><line x1="10" y1="13" x2="14" y2="13" /></svg>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

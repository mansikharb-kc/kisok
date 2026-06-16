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
  draft: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
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

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return initial;
    return initial.filter((b) => b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q));
  }, [initial, query]);

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
    if (!confirm(`Delete brand "${b.name}"? If in use it will be deactivated instead.`)) return;
    setBusy(true);
    try {
      await fetch(`/api/brands/${b.id}`, { method: "DELETE" });
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
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">Search</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search brands..." className="w-full rounded-lg border border-slate-300 py-2 pl-16 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
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

      {rows.length === 0 ? (
        emptyState
      ) : viewMode === "card" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((b) => (
            <div key={b.id} className={`rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-md p-4 shadow-sm transition-colors hover:border-brand-200 ${b.status === "inactive" ? "opacity-60" : ""}`}>
              <div className="flex items-start gap-3">
                <BrandLogo url={b.logoUrl} name={b.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-slate-900">{b.name}</div>
                      <div className="font-mono text-[11px] text-slate-400">{b.code}</div>
                    </div>
                    {b.brandNo ? <span className="shrink-0 rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-white">{b.brandNo}</span> : null}
                  </div>
                  <div className="mt-2 text-sm text-slate-600">{b.brandType ?? "-"}</div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {b.categories.length === 0 ? (
                  <span className="text-sm text-slate-300">-</span>
                ) : (
                  <>
                    {b.categories.slice(0, 3).map((c) => (
                      <span key={c} className="rounded-full bg-brand-50 px-2.5 py-1 text-[10px] text-brand-700">
                        {c}
                      </span>
                    ))}
                    {b.categories.length > 3 ? <span className="self-center text-[10px] text-slate-400">+{b.categories.length - 3}</span> : null}
                  </>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Approval</div>
                  <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${APPROVAL_BADGE[b.approvalStatus] ?? "bg-slate-100 text-slate-500"}`}>{b.approvalStatus}</span>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Status</div>
                  <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${b.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${b.status === "active" ? "bg-emerald-500" : "bg-slate-300"}`} />
                    {b.status}
                  </span>
                </div>
                <div className="col-span-2 text-[11px] text-slate-500">
                  <div>{b.productCount} products</div>
                  <div>{b.sellerCount} sellers</div>
                  <div>{b.branchCount} branches</div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {!readOnly && b.approvalStatus !== "approved" ? (
                  <button type="button" onClick={() => patch(b, { approvalStatus: "approved" })} disabled={busy} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                    Approve
                  </button>
                ) : null}
                {!readOnly && b.approvalStatus !== "rejected" ? (
                  <button type="button" onClick={() => patch(b, { approvalStatus: "rejected" })} disabled={busy} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50">
                    Reject
                  </button>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                {!readOnly && (
                  <>
                    <button type="button" onClick={() => router.push(`/masters/brands/${b.id}/edit`)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50">
                      Edit
                    </button>
                    <button type="button" onClick={() => patch(b, { status: b.status === "active" ? "inactive" : "active" })} disabled={busy} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                      {b.status === "active" ? "Deactivate" : "Activate"}
                    </button>
                    <button type="button" onClick={() => remove(b)} disabled={busy} className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50">
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Brand</th>
                <th className="px-4 py-3 text-left font-medium">Brand ID</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Categories</th>
                <th className="px-4 py-3 text-left font-medium">Approval</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Usage</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((b) => (
                <tr key={b.id} className={`hover:bg-slate-50 ${b.status === "inactive" ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-3">
                      <BrandLogo url={b.logoUrl} name={b.name} />
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-800">{b.name}</div>
                        <div className="font-mono text-[11px] text-slate-400">{b.code}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    {b.brandNo ? <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-white">{b.brandNo}</span> : <span className="text-slate-300">-</span>}
                  </td>
                  <td className="px-4 py-3 align-middle text-slate-600">{b.brandType ?? "-"}</td>
                  <td className="px-4 py-3 align-middle">
                    {b.categories.length === 0 ? (
                      <span className="text-slate-300">-</span>
                    ) : (
                      <div className="flex max-w-[240px] flex-wrap gap-1">
                        {b.categories.slice(0, 3).map((c) => (
                          <span key={c} className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] text-brand-700">
                            {c}
                          </span>
                        ))}
                        {b.categories.length > 3 ? <span className="self-center text-[10px] text-slate-400">+{b.categories.length - 3}</span> : null}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="space-y-2">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${APPROVAL_BADGE[b.approvalStatus] ?? "bg-slate-100 text-slate-500"}`}>{b.approvalStatus}</span>
                      {!readOnly && (
                        <div className="flex flex-wrap gap-2 text-[11px]">
                          {b.approvalStatus !== "approved" ? (
                            <button type="button" onClick={() => patch(b, { approvalStatus: "approved" })} disabled={busy} className="text-emerald-600 hover:underline">
                              Approve
                            </button>
                          ) : null}
                          {b.approvalStatus !== "rejected" ? (
                            <button type="button" onClick={() => patch(b, { approvalStatus: "rejected" })} disabled={busy} className="text-rose-600 hover:underline">
                              Reject
                            </button>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${b.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${b.status === "active" ? "bg-emerald-500" : "bg-slate-300"}`} />
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-middle text-[11px] text-slate-500 whitespace-nowrap">
                    <div>{b.productCount} products</div>
                    <div>{b.sellerCount} sellers</div>
                    <div>{b.branchCount} branches</div>
                  </td>
                  <td className="px-4 py-3 align-middle text-right whitespace-nowrap">
                    <div className="inline-flex flex-wrap justify-end gap-2">
                      {readOnly ? (
                        <span className="text-xs text-slate-400 italic">View only</span>
                      ) : (
                        <>
                          <button type="button" onClick={() => router.push(`/masters/brands/${b.id}/edit`)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50">
                            Edit
                          </button>
                          <button type="button" onClick={() => patch(b, { status: b.status === "active" ? "inactive" : "active" })} disabled={busy} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                            {b.status === "active" ? "Deactivate" : "Activate"}
                          </button>
                          <button type="button" onClick={() => remove(b)} disabled={busy} className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50">
                            Delete
                          </button>
                        </>
                      )}
                    </div>
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

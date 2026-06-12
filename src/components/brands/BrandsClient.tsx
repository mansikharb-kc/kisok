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

const ICON_PATHS: Record<string, string> = {
  edit: "M12 20h9 M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z",
  power: "M12 2v10 M18.4 6.6a9 9 0 1 1-12.8 0",
  trash: "M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
  check: "M20 6 9 17l-5-5",
  x: "M18 6 6 18 M6 6l12 12",
};

function Icon({ name, className = "w-3.5 h-3.5" }: { name: keyof typeof ICON_PATHS; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {ICON_PATHS[name].split(" M").map((seg, i) => (
        <path key={i} d={(i === 0 ? "" : "M") + seg} />
      ))}
    </svg>
  );
}

function BrandLogo({ url, name }: { url: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const initials = name.trim().slice(0, 2).toUpperCase();
  if (url && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt={name}
        onError={() => setFailed(true)}
        className="w-9 h-9 rounded-lg object-contain border border-slate-200 bg-white shrink-0"
      />
    );
  }
  return (
    <div className="w-9 h-9 rounded-lg shrink-0 bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center text-xs font-bold">
      {initials}
    </div>
  );
}

export default function BrandsClient({ initial }: { initial: BrandRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? initial.filter((b) => b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q)) : initial;
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

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search brands…"
            className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <span className="text-sm text-slate-500">{initial.length} total</span>
        <button
          onClick={() => router.push("/masters/brands/new")}
          className="ml-auto rounded-lg bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700"
        >
          + New Brand
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-400">
          No brands yet. Click <strong>New Brand</strong> to add one.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Brand</th>
                <th className="text-left px-4 py-3 font-medium">Brand ID</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Categories</th>
                <th className="text-left px-4 py-3 font-medium">Approval</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Usage</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((b) => (
                <tr key={b.id} className={`hover:bg-slate-50 ${b.status === "inactive" ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <BrandLogo url={b.logoUrl} name={b.name} />
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 truncate">{b.name}</div>
                        <div className="font-mono text-[11px] text-slate-400">{b.code}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {b.brandNo ? (
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-white">{b.brandNo}</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{b.brandType ?? "—"}</td>
                  <td className="px-4 py-3">
                    {b.categories.length === 0 ? (
                      <span className="text-slate-300">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1 max-w-[220px]">
                        {b.categories.slice(0, 3).map((c) => (
                          <span key={c} className="text-[10px] px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">{c}</span>
                        ))}
                        {b.categories.length > 3 && <span className="text-[10px] text-slate-400 self-center">+{b.categories.length - 3}</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${APPROVAL_BADGE[b.approvalStatus] ?? "bg-slate-100 text-slate-500"}`}>
                      {b.approvalStatus}
                    </span>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                      {b.approvalStatus !== "approved" && (
                        <button
                          type="button"
                          onClick={() => patch(b, { approvalStatus: "approved" })}
                          disabled={busy}
                          className="text-emerald-600 hover:underline"
                        >
                          Approve
                        </button>
                      )}
                      {b.approvalStatus !== "rejected" && (
                        <button
                          type="button"
                          onClick={() => patch(b, { approvalStatus: "rejected" })}
                          disabled={busy}
                          className="text-rose-600 hover:underline"
                        >
                          Reject
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs ${b.status === "active" ? "text-emerald-600" : "text-slate-400"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${b.status === "active" ? "bg-emerald-500" : "bg-slate-300"}`} />
                      {b.approvalStatus}
                      </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs ${b.status === "active" ? "text-emerald-600" : "text-slate-400"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${b.status === "active" ? "bg-emerald-500" : "bg-slate-300"}`} />
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-slate-500 whitespace-nowrap">
                    <div>{b.productCount} products</div>
                    <div>{b.sellerCount} sellers</div>
                    <div>{b.branchCount} branches</div>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap space-x-3">
                    <button type="button" onClick={() => router.push(`/masters/brands/${b.id}/edit`)} className="text-brand-600 hover:underline text-xs">
                      Edit
                    </button>
                    <button onClick={() => patch(b, { status: b.status === "active" ? "inactive" : "active" })} disabled={busy} className="text-slate-500 hover:underline text-xs">
                      {b.status === "active" ? "Deactivate" : "Activate"}
                    </button>
                    <button onClick={() => remove(b)} disabled={busy} className="text-rose-600 hover:underline text-xs">
                      Delete
                    </button>
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

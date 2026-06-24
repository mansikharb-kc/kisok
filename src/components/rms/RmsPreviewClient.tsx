"use client";

import { useState } from "react";

type Product = {
  copyId: string;
  instanceCode: string;
  availability: string;
  productId: string | null;
  name: string;
  sku: string;
  brand: string;
  category: string;
};
type Rack = { id: string; name: string; code: string | null; blockName: string | null; products: Product[] };
type Screen = { id: string; name: string | null; token: string | null; status: string; racks: Rack[] };

export default function RmsPreviewClient({
  branchName,
  screens,
}: {
  branchName: string;
  screens: Screen[];
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const kioskUrl = (token: string | null) => (token ? `${origin}/rms/screen/${token}` : "");

  async function copy(url: string, id: string) {
    try { await navigator.clipboard.writeText(url); setCopied(id); setTimeout(() => setCopied(null), 1500); } catch { /* ignore */ }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Screen Preview</h1>
        <p className="text-sm text-slate-500 mt-1">
          Every screen of {branchName} and the products in its racks — which brand&apos;s product sits in which rack.
        </p>
      </div>

      {screens.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 backdrop-blur-md p-12 text-center text-sm text-slate-400">
          No screens yet. Create screens on the RMS Screens page and map racks on the Blocks page.
        </div>
      ) : (
        <div className="space-y-5">
          {screens.map((s) => {
            const url = kioskUrl(s.token);
            const totalProducts = s.racks.reduce((n, r) => n + r.products.length, 0);
            return (
              <div key={s.id} className="rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-lg font-bold text-slate-900">{s.name || `Screen ${s.id}`}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{s.racks.length} racks · {totalProducts} products</div>
                  </div>
                  {url && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button type="button" onClick={() => copy(url, s.id)}
                        className="rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50">
                        {copied === s.id ? "Copied" : "Copy URL"}
                      </button>
                      <a href={url} target="_blank" rel="noopener noreferrer"
                        className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
                        Open kiosk
                      </a>
                    </div>
                  )}
                </div>

                {s.racks.length === 0 ? (
                  <p className="text-xs text-slate-400 border-t border-slate-100 pt-3">No racks mapped. Map racks on the Blocks page.</p>
                ) : (
                  <div className="space-y-3 border-t border-slate-100 pt-3">
                    {s.racks.map((r) => (
                      <div key={r.id} className="rounded-xl border border-slate-200 bg-white/50 overflow-hidden">
                        <div className="bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                          {r.blockName ? `${r.blockName} › ` : ""}{r.name}
                          {r.code && <span className="font-mono text-[11px] text-slate-400 ml-2">{r.code}</span>}
                          <span className="text-[11px] text-slate-400 font-normal ml-2">· {r.products.length} products</span>
                        </div>
                        {r.products.length === 0 ? (
                          <div className="px-3 py-3 text-xs text-slate-400">No products placed in this rack yet.</div>
                        ) : (
                          <table className="w-full text-sm">
                            <thead className="text-[11px] uppercase tracking-wider text-slate-500">
                              <tr className="border-b border-slate-100">
                                <th className="px-3 py-2 text-left font-medium">Brand</th>
                                <th className="px-3 py-2 text-left font-medium">Product</th>
                                <th className="px-3 py-2 text-left font-medium">Category</th>
                                <th className="px-3 py-2 text-left font-medium">Instance</th>
                                <th className="px-3 py-2 text-left font-medium">Availability</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {r.products.map((p) => (
                                <tr key={p.copyId}>
                                  <td className="px-3 py-2 text-slate-700">{p.brand}</td>
                                  <td className="px-3 py-2">
                                    <span className="font-medium text-slate-800">{p.name}</span>
                                    {p.sku && <span className="font-mono text-[11px] text-slate-400 ml-2">{p.sku}</span>}
                                  </td>
                                  <td className="px-3 py-2 text-slate-600">{p.category}</td>
                                  <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{p.instanceCode}</td>
                                  <td className="px-3 py-2">
                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.availability === "IN" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                                      {p.availability === "IN" ? "In stock" : p.availability}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

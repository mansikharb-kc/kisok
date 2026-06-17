"use client";

import { useState } from "react";

type Row = {
  id: string;
  instanceCode: string;
  copyRole: string;
  availability: string;
  status: string;
  locationNodeId: string | null;
  product: { name: string; sku: string; brand?: { name: string } | null };
  location: { name: string; locationId: string | null; path: string | null } | null;
  size: { label: string } | null;
  qr: { url: string } | null;
  record: { seller: { name: string } };
};

export default function PlacementList({ rows }: { rows: Row[] }) {
  const [viewMode, setViewMode] = useState<"table" | "card">("table");

  return (
    <div className="bg-white/60 backdrop-blur-md rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-bold text-slate-800 text-sm">Physical Copy Catalogues</h2>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
            {rows.length} copies total
          </span>
        </div>

        {/* View Switcher Toggle */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 select-none">
          <button
            onClick={() => setViewMode("table")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              viewMode === "table"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span>Table</span>
          </button>
          <button
            onClick={() => setViewMode("card")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              viewMode === "card"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <span>Cards</span>
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="p-12 text-center text-slate-400 text-sm">
          No physical product copies have been placed at this branch yet.
        </div>
      ) : viewMode === "table" ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-5 py-3.5">QR & Instance Code</th>
                <th className="px-5 py-3.5">Product Details</th>
                <th className="px-5 py-3.5">Copy Role & Size</th>
                <th className="px-5 py-3.5">Physical Location</th>
                <th className="px-5 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-4 align-top">
                    <div className="flex items-start gap-3">
                      {c.qr?.url ? (
                        <img
                          src={c.qr.url}
                          alt={`QR for ${c.instanceCode}`}
                          className="w-12 h-12 rounded border border-slate-200 bg-white/60 backdrop-blur-md object-contain shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded border border-dashed border-slate-200 bg-slate-50 shrink-0" />
                      )}
                      <div>
                        <div className="font-mono text-xs font-semibold text-slate-800 break-all">{c.instanceCode}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">Instance ID: #{c.id}</div>
                        <div className="mt-1">
                          {c.qr?.url ? (
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 font-medium select-none">
                              QR ready
                            </span>
                          ) : (
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200 font-medium select-none">
                              No QR
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <div className="font-semibold text-slate-800">{c.product.name}</div>
                    {c.product.brand?.name && (
                      <div className="text-xs font-semibold text-brand-600 mt-0.5">{c.product.brand.name}</div>
                    )}
                    <div className="text-xs text-slate-500 mt-0.5">SKU: {c.product.sku}</div>
                    <div className="text-[10px] font-medium text-slate-400 mt-1">Seller: {c.record.seller.name}</div>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <div className="space-y-1">
                      <div>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            c.copyRole === "MASTER" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {c.copyRole}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 font-medium">Size: {c.size?.label || "—"}</div>
                    </div>
                  </td>
                  <td className="px-5 py-4 align-top">
                    {c.location ? (
                      <div className="space-y-1">
                        <div className="font-semibold text-slate-800 text-xs">{c.location.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">ID: {c.location.locationId}</div>
                        <div className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]" title={c.location.path ?? ""}>
                          Path: {c.location.path}
                        </div>
                      </div>
                    ) : (
                      <span className="text-amber-600 font-medium text-xs flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                        Unplaced / Stage Buffer
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 align-top">
                    <div className="space-y-1">
                      <div>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${
                            c.availability === "IN"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}
                        >
                          Availability: {c.availability}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">Status: {c.status}</div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-5 bg-slate-50/30">
          {rows.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 flex flex-col justify-between group"
            >
              <div className="space-y-3">
                {/* Header: Instance Code & Availability */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-bold text-slate-800 break-all">{c.instanceCode}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">ID: #{c.id}</div>
                  </div>
                  <div className="shrink-0">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded border text-[9px] font-bold uppercase select-none ${
                        c.availability === "IN"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-rose-50 text-rose-700 border-rose-200"
                      }`}
                    >
                      {c.availability}
                    </span>
                  </div>
                </div>

                {/* Product Box */}
                <div className="flex items-start gap-3 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                  {c.qr?.url ? (
                    <img
                      src={c.qr.url}
                      alt={`QR for ${c.instanceCode}`}
                      className="w-12 h-12 rounded border border-slate-200 bg-white object-contain shrink-0 group-hover:border-indigo-300 transition-colors shadow-sm"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded border border-dashed border-slate-200 bg-white shrink-0 flex items-center justify-center">
                      <span className="text-[8px] text-slate-400 font-semibold font-mono">No QR</span>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-800 text-xs truncate" title={c.product.name}>
                      {c.product.name}
                    </div>
                    {c.product.brand?.name && (
                      <div className="text-[10px] font-bold text-brand-600 truncate mt-0.5" title={c.product.brand.name}>
                        {c.product.brand.name}
                      </div>
                    )}
                    <div className="text-[10px] text-slate-500 mt-0.5 truncate">SKU: {c.product.sku}</div>
                    <div className="text-[9px] font-medium text-slate-400 mt-1 truncate">Seller: {c.record.seller.name}</div>
                  </div>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50/30 p-2 rounded border border-slate-100 flex flex-col justify-between gap-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Role & Size</span>
                    <div className="space-y-1">
                      <div>
                        <span
                          className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                            c.copyRole === "MASTER" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {c.copyRole}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-semibold">Size: {c.size?.label || "—"}</div>
                    </div>
                  </div>

                  <div className="bg-slate-50/30 p-2 rounded border border-slate-100 flex flex-col justify-between gap-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Status</span>
                    <div className="space-y-1">
                      <div className="text-[10px] text-slate-600 capitalize font-semibold">
                        {c.status}
                      </div>
                      <div className="text-[8px] text-slate-400 font-mono font-medium select-none">
                        {c.qr?.url ? "QR Ready" : "QR Pending"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Location Section */}
              <div className="mt-3 pt-3 border-t border-slate-100">
                {c.location ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                      <span>Physical Location</span>
                      <span className="font-mono lowercase text-[8px] bg-slate-100 text-slate-500 px-1 rounded border border-slate-150">
                        {c.location.locationId}
                      </span>
                    </div>
                    <div className="font-bold text-slate-800 text-xs flex items-center gap-1 mt-0.5">
                      <svg className="w-3.5 h-3.5 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="truncate" title={c.location.name}>{c.location.name}</span>
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono truncate" title={c.location.path ?? ""}>
                      Path: {c.location.path}
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50/50 border border-amber-100 p-2 rounded-lg text-center flex items-center justify-center gap-1.5 select-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                    <span className="text-amber-700 font-bold text-[10px]">Unplaced / Stage Buffer</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

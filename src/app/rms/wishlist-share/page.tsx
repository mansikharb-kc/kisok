"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

type WishlistItem = {
  id: string;
  name: string;
  sku: string;
  brand: string;
  category: string;
  qty: number;
};

export default function WishlistSharePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#fbfaff] flex flex-col items-center justify-center">
        <div className="h-8 w-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <WishlistShareContent />
    </Suspense>
  );
}

function WishlistShareContent() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [error, setError] = useState(false);
  const [token, setToken] = useState("");

  useEffect(() => {
    const data = searchParams.get("data");
    const tok = searchParams.get("token") || "";
    setToken(tok);
    if (!data) {
      setError(true);
      return;
    }
    try {
      const decoded = decodeURIComponent(escape(atob(data)));
      const parsed: WishlistItem[] = JSON.parse(decoded);
      setItems(parsed);
    } catch {
      setError(true);
    }
  }, [searchParams]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#fbfaff] flex flex-col items-center justify-center px-6 text-center">
        <div className="h-14 w-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <svg className="h-7 w-7 text-red-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-base font-black text-slate-700">Invalid QR Code</h1>
        <p className="text-xs text-slate-400 mt-2 font-semibold">This link appears to be expired or corrupted. Please generate a new QR code from the kiosk.</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-[#fbfaff] flex flex-col items-center justify-center">
        <div className="h-8 w-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalItems = items.reduce((sum, i) => sum + i.qty, 0);

  return (
    <div className="min-h-screen bg-[#fbfaff]">
      {/* Header */}
      <div className="bg-gradient-to-b from-[#1a052e] to-[#2d0f4d] px-5 pt-10 pb-8 text-white text-center relative overflow-hidden">
        {/* Background circles */}
        <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-purple-600/20" />
        <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-purple-500/10" />

        <div className="relative">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-purple-600/30 backdrop-blur-sm border border-purple-500/30 flex items-center justify-center mb-3">
            <svg className="h-7 w-7 text-purple-200" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <h1 className="text-xl font-black text-white">Your Wishlist</h1>
          <p className="text-purple-300 text-xs font-semibold mt-1">Scanned from kiosk</p>
          <div className="mt-3 inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 border border-white/10">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="text-[11px] font-bold text-white">{items.length} product{items.length !== 1 ? "s" : ""} · {totalItems} item{totalItems !== 1 ? "s" : ""} total</span>
          </div>
        </div>
      </div>

      {/* Products */}
      <div className="px-4 py-5 space-y-3 max-w-lg mx-auto">
        <p className="text-[9px] font-black text-purple-700 uppercase tracking-widest px-0.5">Selected Materials</p>

        {items.map((item, idx) => (
          <div
            key={idx}
            className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.05)] overflow-hidden"
          >
            {/* Color band */}
            <div
              className="h-1 w-full"
              style={{
                background: `hsl(${(idx * 67 + 250) % 360}, 60%, 60%)`,
              }}
            />
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black text-purple-600 uppercase tracking-wider">{item.brand}</p>
                  <h3 className="text-sm font-extrabold text-slate-800 mt-0.5 leading-snug">{item.name}</h3>
                  <p className="text-[10px] font-semibold text-slate-400 mt-1">SKU: {item.sku}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="inline-flex items-center justify-center h-8 w-8 rounded-xl bg-purple-50 border border-purple-100">
                    <span className="text-sm font-black text-purple-600">×{item.qty}</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-50">
                <span className="rounded-full bg-purple-50 px-2.5 py-1 text-[8.5px] font-bold text-purple-600 border border-purple-100 uppercase tracking-wide">
                  {item.category}
                </span>
                <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[8.5px] font-bold text-slate-500 border border-slate-100 uppercase tracking-wide">
                  Finishes
                </span>
              </div>
            </div>
          </div>
        ))}

        {/* Summary card */}
        <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl p-4 text-white mt-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-purple-200">Summary</p>
          <div className="mt-2 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-purple-200">Total Products</span>
              <span className="font-black">{items.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-purple-200">Total Items</span>
              <span className="font-black">{totalItems}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-purple-200">Categories</span>
              <span className="font-black">{[...new Set(items.map((i) => i.category))].length}</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-purple-500/40 text-center">
            <p className="text-[9px] font-bold text-purple-300 leading-relaxed">
              Visit your nearest KC store or contact us to proceed with your selection.
            </p>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-[9px] text-slate-400 font-semibold pb-4">
          Generated from KC IMS Kiosk · This is a product reference list only
        </p>
      </div>
    </div>
  );
}

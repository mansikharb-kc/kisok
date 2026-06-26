"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import QRCode from "qrcode";

interface BomDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BomDrawer({ isOpen, onClose }: BomDrawerProps) {
  const [bomList, setBomList] = useState<any[]>([]);
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const router = useRouter();
  const params = useParams();
  const token = params?.token as string;

  const loadBom = () => {
    try {
      const raw = localStorage.getItem("rms_bom");
      setBomList(raw ? JSON.parse(raw) : []);
    } catch {
      setBomList([]);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadBom();
      setShowQr(false);
      setQrDataUrl("");
    }
  }, [isOpen]);

  useEffect(() => {
    window.addEventListener("bom-updated", loadBom);
    window.addEventListener("storage", loadBom);
    return () => {
      window.removeEventListener("bom-updated", loadBom);
      window.removeEventListener("storage", loadBom);
    };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    for (const item of bomList) {
      const catName = item.categoryName || item.category?.name || "Materials";
      if (!map.has(catName)) map.set(catName, { name: catName, count: 0 });
      map.get(catName)!.count += 1;
    }
    return [...map.values()];
  }, [bomList]);

  if (!isOpen) return null;

  const totalMaterials = bomList.length;

  async function handleScanQr() {
    if (showQr) {
      setShowQr(false);
      setQrDataUrl("");
      return;
    }

    if (bomList.length === 0) return;

    setQrLoading(true);
    setShowQr(true);

    try {
      // Encode wishlist as compact payload
      const payload = bomList.map((item) => ({
        id: item.id,
        name: item.name,
        sku: item.sku,
        brand: item.brandName,
        category: item.categoryName,
        qty: item.quantity,
      }));
      const shareUrl = `https://knowledgecenter.club/`;

      const url = await QRCode.toDataURL(shareUrl, {
        width: 180,
        margin: 1,
        color: { dark: "#3b0764", light: "#ffffff" },
      });
      setQrDataUrl(url);
    } catch (err) {
      console.error("QR Error:", err);
    } finally {
      setQrLoading(false);
    }
  }

  const handleAction = (_action: string) => {
    onClose();
  };

  const handleClearWishlist = () => {
    try {
      localStorage.removeItem("rms_bom");
      setBomList([]);
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new Event("bom-updated"));
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveItem = (id: string, index: number) => {
    try {
      const existing = localStorage.getItem("rms_bom");
      if (!existing) return;
      const list = JSON.parse(existing);
      const updated = list.filter((item: any, idx: number) => {
        if (id && item.id) return item.id !== id;
        return idx !== index;
      });
      localStorage.setItem("rms_bom", JSON.stringify(updated));
      setBomList(updated);
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new Event("bom-updated"));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col select-none bg-white shadow-[6px_0_32px_rgba(0,0,0,0.12)] animate-slide-in-left overflow-y-auto border-r border-slate-200/60">

      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex flex-col items-center border-b border-slate-100 relative bg-white">
        {/* Back */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 left-3 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 active:scale-95 transition-all"
          aria-label="Go back"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 active:scale-95 transition-all"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <img src="/logo.png" alt="KC" className="h-8 w-auto object-contain mt-1" />
        <h2 className="text-base font-black text-slate-800 mt-2 leading-none">Wishlist</h2>
        <div className="text-[8px] font-black text-purple-600 tracking-wider mt-1 uppercase text-center leading-tight">
          Save, Organize &amp; Share
        </div>
        <p className="text-slate-500 text-[10px] mt-1.5 font-bold">
          You selected {totalMaterials} {totalMaterials === 1 ? "material" : "materials"}
        </p>
      </div>

      {/* Content */}
      <div className="px-3 py-3 space-y-4 flex-1">

        {/* Your Materials */}
        <div>
          <div className="flex items-center justify-between mb-2 px-0.5">
            <h3 className="text-[9px] font-black text-purple-700 tracking-widest uppercase">Your Materials</h3>
            {bomList.length > 0 && (
              <button
                type="button"
                onClick={handleClearWishlist}
                className="text-[9px] font-black text-red-500 hover:text-red-700 uppercase tracking-widest transition-colors active:scale-95"
              >
                Clear All
              </button>
            )}
          </div>
          <div className="bg-[#faf8ff] p-2 rounded-2xl border border-purple-50 space-y-1.5">
            {bomList.length === 0 ? (
              <div className="py-5 text-center text-[10px] font-bold text-slate-400">No materials selected yet.</div>
            ) : (
              bomList.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="w-full bg-white rounded-xl border border-slate-100 px-3 py-2 flex items-center justify-between text-left shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
                >
                  <div className="flex flex-col gap-0.5 min-w-0 pr-2">
                    <span className="text-[10px] font-bold text-slate-700 line-clamp-1">{item.name}</span>
                    <span className="text-[8px] font-semibold text-slate-400">{item.sku}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.id, idx)}
                    className="text-slate-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-50/50 transition-colors active:scale-90 shrink-0"
                    aria-label={`Remove ${item.name}`}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))
            )}

            <button
              type="button"
              onClick={() => onClose()}
              className="mt-1 w-full py-2 bg-white border border-purple-400 text-purple-600 font-extrabold text-[9px] uppercase tracking-widest rounded-full hover:bg-purple-50 active:scale-95 transition-all flex items-center justify-center gap-1 shadow-sm"
            >
              <span className="text-sm font-black leading-none">+</span> Add Materials
            </button>
          </div>
        </div>

        {/* Continue or Share Wishlist */}
        <div>
          <h3 className="text-[9px] font-black text-purple-700 tracking-widest uppercase mb-2 px-0.5">Continue or Share Wishlist</h3>
          <div className="space-y-2">
            {/* Scan QR */}
            <button
              type="button"
              onClick={handleScanQr}
              disabled={bomList.length === 0}
              className={`w-full bg-white rounded-2xl border-2 px-3 py-2.5 flex items-center gap-3 text-left active:scale-[0.98] transition-all shadow-[0_2px_8px_rgba(0,0,0,0.02)] ${
                showQr ? "border-purple-400 bg-purple-50/40" : "border-purple-100 hover:border-purple-200"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <div className="h-9 w-9 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <path d="M14 14h3v3h-3zm3 3h4v4h-4z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-[11px] font-black text-slate-800 leading-tight">Scan QR to Continue</h4>
                <p className="text-[9px] text-slate-400 font-semibold mt-0.5">
                  {showQr ? "Tap again to hide QR code" : "Access your Wishlist on Phone"}
                </p>
              </div>
              {showQr && (
                <svg className="h-4 w-4 text-purple-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                </svg>
              )}
            </button>

            {/* QR Code Panel */}
            {showQr && (
              <div className="mx-1 rounded-2xl border-2 border-purple-100 bg-gradient-to-b from-purple-50 to-white p-4 flex flex-col items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                {qrLoading ? (
                  <div className="h-[120px] flex items-center justify-center">
                    <div className="h-8 w-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : qrDataUrl ? (
                  <>
                    <div className="bg-white p-2 rounded-xl shadow-[0_4px_20px_rgba(88,28,220,0.15)] border border-purple-100">
                      <img src={qrDataUrl} alt="Wishlist QR" className="h-[150px] w-[150px] object-contain" />
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-black text-purple-700 uppercase tracking-wider">Scan to open on your phone</p>
                      <p className="text-[8.5px] text-slate-400 font-semibold mt-1 leading-snug max-w-[200px]">
                        Opens your full wishlist with all {bomList.length} product{bomList.length !== 1 ? "s" : ""} &amp; details
                      </p>
                    </div>
                    {/* Product summary */}
                    <div className="w-full bg-white rounded-xl border border-purple-50 divide-y divide-slate-50 overflow-hidden">
                      {bomList.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-1.5">
                          <div className="h-1.5 w-1.5 rounded-full bg-purple-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="text-[9px] font-bold text-slate-700 line-clamp-1">{item.name}</span>
                          </div>
                          <span className="text-[8px] font-black text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full shrink-0">
                            ×{item.quantity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-[10px] text-red-400 font-bold">Failed to generate QR. Please try again.</p>
                )}
              </div>
            )}

            {/* Export Wishlist */}
            <button
              type="button"
              onClick={() => handleAction("export")}
              className="w-full bg-white rounded-2xl border-2 border-purple-100 px-3 py-2.5 flex items-center gap-3 text-left active:scale-[0.98] transition-all shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:border-purple-200"
            >
              <div className="h-9 w-9 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h4 className="text-[11px] font-black text-slate-800 leading-tight">Export Wishlist</h4>
                <p className="text-[9px] text-slate-400 font-semibold mt-0.5">Send to email or number</p>
              </div>
            </button>
          </div>
        </div>

        {/* Benefits */}
        <div>
          <h3 className="text-[9px] font-black text-purple-700 tracking-widest uppercase mb-2 px-0.5">Benefits of creating a Wishlist</h3>
          <div className="bg-[#faf8ff] p-3 rounded-2xl border border-purple-50 space-y-2.5">
            {[
              { text: "Save your materials in one place", icon: "M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" },
              { text: "Compare Products easily", icon: "M4 6h16M4 12h16M4 18h16" },
              { text: "Export professional specifications", icon: "M9 13h6m-6-4h6m-6 8h3M4 19V5a2 2 0 012-2h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2z" },
              { text: "Share with your team", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" },
            ].map((b) => (
              <div key={b.text} className="flex items-center gap-2.5 px-0.5">
                <div className="text-purple-600 shrink-0">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d={b.icon} />
                  </svg>
                </div>
                <span className="text-[10px] font-bold text-slate-600 leading-tight">{b.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes slideInLeft {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-left {
          animation: slideInLeft 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}



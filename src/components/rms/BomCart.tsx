"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import QRCode from "qrcode";

type BomItem = {
  id: string;
  name: string;
  sku: string;
  brandName: string;
  categoryName: string;
  quantity: number;
};

export default function BomCart({ token }: { token: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rackId = searchParams.get("rack") || "";

  const [items, setItems] = useState<BomItem[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quoteSuccess, setQuoteSuccess] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");

  // Load items from localStorage
  useEffect(() => {
    try {
      const existing = localStorage.getItem("rms_bom");
      if (existing) {
        setItems(JSON.parse(existing));
      }
    } catch (e) {
      console.error("Error loading BOM:", e);
    }
  }, []);

  // Update item quantity
  function updateQuantity(id: string, delta: number) {
    const updated = items
      .map((item) => {
        if (item.id === id) {
          const qty = item.quantity + delta;
          return { ...item, quantity: qty };
        }
        return item;
      })
      .filter((item) => item.quantity > 0);

    setItems(updated);
    localStorage.setItem("rms_bom", JSON.stringify(updated));
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new Event("bom-updated"));
  }

  // Remove item
  function removeItem(id: string) {
    const updated = items.filter((item) => item.id !== id);
    setItems(updated);
    localStorage.setItem("rms_bom", JSON.stringify(updated));
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new Event("bom-updated"));
  }

  // Handle Checkout / Quote submission
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0 || !name || !email) return;

    setIsSubmitting(true);
    // Simulate API request to save BOM quote
    setTimeout(() => {
      // Generate handoff QR code for the saved quote
      const quoteId = Math.random().toString(36).substr(2, 9).toUpperCase();
      const mobileUrl = `${window.location.origin}/rms/screen/${token}/bom?quote=${quoteId}`;
      QRCode.toDataURL(mobileUrl, { width: 140, margin: 1 })
        .then((url) => setQrCodeUrl(url))
        .catch((err) => console.error("QR Code Error:", err));

      setIsSubmitting(false);
      setQuoteSuccess(true);
      // Clear cart
      localStorage.removeItem("rms_bom");
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new Event("bom-updated"));
      setItems([]);
    }, 1500);
  }

  return (
    <div className="mx-auto min-h-screen bg-[#fbfaff] pb-12">
      {/* Kiosk Header */}
      <header className="bg-gradient-to-b from-[#1a052e] to-[#2d0f4d] px-4 py-3.5 text-white shadow-md flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push(`/rms/screen/${token}?rack=${rackId}`)}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 active:scale-95 transition-all"
        >
          <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-[12px] font-extrabold tracking-widest uppercase text-purple-200">
          Wishlist
        </span>
        <button
          type="button"
          onClick={() => router.push(`/rms/screen/${token}`)}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 active:scale-95 transition-all"
        >
          <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
          </svg>
        </button>
      </header>

      <div className="px-4 mt-5">
        {quoteSuccess ? (
          /* Success Screen */
          <div className="bg-white rounded-3xl p-6 border border-purple-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-center space-y-5 animate-in fade-in duration-300">
            <div className="mx-auto h-12 w-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-800 uppercase tracking-widest">Quote Requested!</h2>
              <p className="mt-1 text-xs text-slate-400 font-semibold leading-relaxed">
                We have received your Wishlist request. A details sheet (without prices) has been dispatched to your email.
              </p>
            </div>

            {/* QR Handoff */}
            {qrCodeUrl && (
              <div className="bg-purple-50/50 rounded-2xl p-4 border border-purple-100 flex flex-col items-center">
                <img src={qrCodeUrl} alt="Handoff QR" className="h-32 w-32 object-contain border border-purple-100 rounded-lg shadow-sm" />
                <span className="text-[10px] font-black uppercase text-purple-600 tracking-wider mt-3">Scan to open on Mobile</span>
                <p className="text-[8px] text-slate-400 font-bold leading-normal mt-1 max-w-[200px]">
                  Keep a digital copy of your selected materials and physical placements on your phone.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => router.push(`/rms/screen/${token}?rack=${rackId}`)}
              className="w-full py-3 bg-purple-600 text-white font-bold text-xs uppercase tracking-widest rounded-2xl active:scale-95 transition-all shadow-md"
            >
              Back to Catalog
            </button>
          </div>
        ) : items.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-3xl p-10 text-center border border-slate-100 shadow-sm">
            <div className="mx-auto h-12 w-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5h6.75" />
              </svg>
            </div>
            <h3 className="text-sm font-extrabold text-slate-700 uppercase tracking-widest">Wishlist is Empty</h3>
            <p className="mt-1.5 text-[10px] text-slate-400 font-semibold leading-relaxed">
              Explore products in the catalog and click the "+ Add To Wishlist" button to collect materials.
            </p>
            <button
              type="button"
              onClick={() => router.push(`/rms/screen/${token}?rack=${rackId}`)}
              className="mt-6 px-6 py-2.5 bg-purple-600 text-white font-bold text-xs uppercase tracking-widest rounded-xl active:scale-95 transition-all shadow-md"
            >
              Browse Products
            </button>
          </div>
        ) : (
          /* Cart Listing + Form */
          <div className="space-y-5">
            {/* Items List */}
            <div className="bg-white rounded-3xl border border-slate-100 p-4 shadow-sm space-y-3.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Selected Materials ({items.length})</span>
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center py-2.5 border-b border-slate-50 last:border-0 last:pb-0">
                    <div className="max-w-[240px]">
                      <span className="text-[9px] font-bold text-purple-600 uppercase tracking-wider">{item.brandName}</span>
                      <h4 className="text-xs font-bold text-slate-800 mt-0.5 line-clamp-1">{item.name}</h4>
                      <span className="text-[9px] text-slate-400 font-semibold block mt-0.5">SKU: {item.sku}</span>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-2.5 shrink-0 bg-slate-50 px-2 py-1 rounded-xl border border-slate-100">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, -1)}
                        className="h-5 w-5 rounded bg-white text-slate-600 flex items-center justify-center font-bold text-xs shadow-sm border border-slate-200/50 active:scale-90"
                      >
                        -
                      </button>
                      <span className="text-xs font-extrabold text-slate-700 w-4 text-center">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, 1)}
                        className="h-5 w-5 rounded bg-white text-slate-600 flex items-center justify-center font-bold text-xs shadow-sm border border-slate-200/50 active:scale-90"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="ml-1 text-slate-300 hover:text-rose-500 active:scale-90"
                        aria-label="Remove item"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Lead Capture Form */}
            <div className="bg-white rounded-3xl border border-purple-50 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
              <span className="text-[10px] font-black uppercase tracking-widest text-purple-600 block mb-4">Request a Quote</span>
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label htmlFor="fullName" className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Full Name</label>
                  <input
                    id="fullName"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-400/40"
                  />
                </div>
                <div>
                  <label htmlFor="emailAddress" className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Email Address</label>
                  <input
                    id="emailAddress"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. john@example.com"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-400/40"
                  />
                </div>
                <div>
                  <label htmlFor="phoneNumber" className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Phone Number (Optional)</label>
                  <input
                    id="phoneNumber"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-400/40"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-4 py-3.5 bg-purple-600 text-white font-bold text-xs uppercase tracking-widest rounded-2xl active:scale-[0.98] transition-all disabled:bg-purple-300 shadow-md flex items-center justify-center"
                >
                  {isSubmitting ? (
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "Submit Quote Request"
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

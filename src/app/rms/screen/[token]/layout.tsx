"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import NeedHelpDrawer from "@/components/rms/NeedHelpDrawer";
import BomDrawer from "@/components/rms/BomDrawer";
import CompareDrawer from "@/components/rms/CompareDrawer";

const INACTIVITY_MS = 10 * 60 * 1000; // 10 minutes
const WISHLIST_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export default function ScreenLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = params?.token;
  const isBomPage = pathname?.endsWith("/bom");
  const rackId = searchParams?.get("rack") || "";

  const [needHelpOpen, setNeedHelpOpen] = useState(false);
  const [bomOpen, setBomOpen] = useState(false);
  const [compareCount, setCompareCount] = useState(0);
  const [compareMode, setCompareMode] = useState(false);
  const [compareDrawerOpen, setCompareDrawerOpen] = useState(false);
  const [compareProducts, setCompareProducts] = useState<any[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Inactivity + Wishlist popup state
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showWishlistPopup, setShowWishlistPopup] = useState(false);
  const [wishlistDismissCountdown, setWishlistDismissCountdown] = useState(15);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wishlistInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const wishlistCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Inactivity: reset to home after 10 min ───────────────────────────────
  const clearBomAndGoHome = useCallback(() => {
    localStorage.removeItem("rms_bom");
    localStorage.removeItem("rms_compare");
    localStorage.removeItem("rms_compare_mode");
    window.dispatchEvent(new Event("bom-updated"));
    window.dispatchEvent(new Event("compare-updated"));
    if (token) {
      router.push(`/rms/screen/${token}?rack=${rackId}`);
    }
  }, [token, rackId, router]);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      clearBomAndGoHome();
    }, INACTIVITY_MS);
  }, [clearBomAndGoHome]);

  useEffect(() => {
    const events = ["mousemove", "click", "keydown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, resetInactivityTimer, { passive: true }));
    resetInactivityTimer(); // start timer on mount
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetInactivityTimer));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [resetInactivityTimer]);

  // ─── Wishlist popup every 5 min ───────────────────────────────────────────
  const openWishlistPopup = useCallback(() => {
    setWishlistDismissCountdown(15);
    setShowWishlistPopup(true);
    // Start auto-dismiss countdown
    if (wishlistCountdownRef.current) clearInterval(wishlistCountdownRef.current);
    wishlistCountdownRef.current = setInterval(() => {
      setWishlistDismissCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(wishlistCountdownRef.current!);
          setShowWishlistPopup(false);
          return 15;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Disable wishlist export popup for now
  // useEffect(() => {
  //   wishlistInterval.current = setInterval(openWishlistPopup, WISHLIST_INTERVAL_MS);
  //   return () => {
  //     if (wishlistInterval.current) clearInterval(wishlistInterval.current);
  //     if (wishlistCountdownRef.current) clearInterval(wishlistCountdownRef.current);
  //   };
  // }, [openWishlistPopup]);

  const handleExportWishlist = () => {
    setBomOpen(true);
    setShowWishlistPopup(false);
    if (wishlistCountdownRef.current) clearInterval(wishlistCountdownRef.current);
  };

  const dismissWishlistPopup = () => {
    setShowWishlistPopup(false);
    if (wishlistCountdownRef.current) clearInterval(wishlistCountdownRef.current);
  };

  // ─── Compare helpers ──────────────────────────────────────────────────────
  const checkCompareItems = () => {
    try {
      const raw = localStorage.getItem("rms_compare");
      const list = raw ? JSON.parse(raw) : [];
      setCompareCount(list.length);
      
      // Update full products state for drawer
      const rawProducts = localStorage.getItem("rms_compare_products");
      const productsList = rawProducts ? JSON.parse(rawProducts) : list.map((id: string) => ({ id, name: `Product ${id}` }));
      setCompareProducts(productsList);

      // Auto-open drawer when 4 items selected
      if (list.length === 4) {
        setCompareDrawerOpen(true);
      }
      // Auto-close drawer when no items left
      if (list.length === 0) {
        setCompareDrawerOpen(false);
      }
    } catch { 
      setCompareCount(0);
      setCompareProducts([]);
    }
  };

  const checkCompareMode = () => {
    try {
      const mode = localStorage.getItem("rms_compare_mode") === "true";
      setCompareMode(mode);
    } catch { setCompareMode(false); }
  };

  const toggleCompareMode = () => {
    if (compareCount > 1) {
      // Already have 2+ items — open the drawer to show them
      setCompareDrawerOpen(true);
      return;
    }

    if (compareCount === 1) {
      // Only 1 item selected: show toast instructing them to select the next product
      window.dispatchEvent(new CustomEvent("show-toast", { detail: "Please select 1 more product to compare." }));
      return;
    }
    
    try {
      const currentMode = localStorage.getItem("rms_compare_mode") === "true";
      const nextMode = !currentMode;
      localStorage.setItem("rms_compare_mode", String(nextMode));
      setCompareMode(nextMode);
      if (!nextMode) {
        // Turning OFF — clear all selections
        localStorage.removeItem("rms_compare");
        localStorage.removeItem("rms_compare_products");
        setCompareCount(0);
        setCompareProducts([]);
        window.dispatchEvent(new Event("compare-updated"));
      }
      window.dispatchEvent(new Event("compare-mode-updated"));
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    checkCompareItems();
    checkCompareMode();
    window.addEventListener("storage", checkCompareItems);
    window.addEventListener("compare-updated", checkCompareItems);
    window.addEventListener("compare-mode-updated", checkCompareMode);
    return () => {
      window.removeEventListener("storage", checkCompareItems);
      window.removeEventListener("compare-updated", checkCompareItems);
      window.removeEventListener("compare-mode-updated", checkCompareMode);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (token === "scr-b") {
      const hadDark = document.documentElement.classList.contains("dark");
      document.documentElement.classList.remove("dark");
      return () => { if (hadDark) document.documentElement.classList.add("dark"); };
    }
  }, [token]);

  useEffect(() => {
    function handleNeedHelp() {
      setNeedHelpOpen(true);
      setBomOpen(false);
      setTimeout(() => {
        if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
        window.scrollTo(0, 0);
      }, 0);
    }
    function handleBom() {
      setBomOpen(true);
      setNeedHelpOpen(false);
      setTimeout(() => {
        if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
        window.scrollTo(0, 0);
      }, 0);
    }
    window.addEventListener("open-need-help", handleNeedHelp);
    window.addEventListener("open-bom-drawer", handleBom);
    return () => {
      window.removeEventListener("open-need-help", handleNeedHelp);
      window.removeEventListener("open-bom-drawer", handleBom);
    };
  }, []);

  useEffect(() => {
    const handleToast = (e: Event) => {
      const msg = (e as CustomEvent).detail;
      setToastMessage(msg);
      setTimeout(() => {
        setToastMessage((curr) => curr === msg ? null : curr);
      }, 3000);
    };
    window.addEventListener("show-toast", handleToast);
    return () => {
      window.removeEventListener("show-toast", handleToast);
    };
  }, []);

  const openWishlist = () => {
    setBomOpen(true);
    setNeedHelpOpen(false);
    setTimeout(() => {
      if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
      window.scrollTo(0, 0);
    }, 0);
  };

  const openNeedHelp = () => {
    setNeedHelpOpen(true);
    setBomOpen(false);
    setTimeout(() => {
      if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
      window.scrollTo(0, 0);
    }, 0);
  };

  return (
    <div className="min-h-screen w-full bg-[#f1f5f9] flex justify-center items-stretch">
      <div className="relative w-full bg-[#fbfaff] shadow-2xl flex flex-col justify-between overflow-hidden border-x border-slate-200/60">
        <div ref={scrollContainerRef} className="flex-1 w-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{children}</div>

        {!isBomPage && (
          <div className="w-full bg-[#fbfaff]">
            <div className="mt-4 px-6 pb-6 flex justify-between gap-3 w-full">
              {/* Bill of Materials Button */}
              <button
                type="button"
                className="w-[220px] flex items-center gap-2.5 p-2 bg-white rounded-full border border-purple-100 shadow-[0_4px_12px_rgba(0,0,0,0.03)] text-left cursor-default shrink-0"
              >
                <div className="h-8 w-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <div>
                  <div className="text-[10px] font-extrabold text-slate-800 leading-none">Start your Wishlist</div>
                  <div className="text-[6.5px] font-bold text-slate-400 mt-0.5 leading-none">(coming soon)</div>
                </div>
              </button>

              {/* Bill of Concierge Button */}
              <button
                type="button"
                onClick={openNeedHelp}
                className="w-[220px] flex items-center gap-2.5 p-2 bg-white rounded-full border border-purple-100 shadow-[0_4px_12px_rgba(0,0,0,0.03)] text-left hover:bg-purple-50/20 active:scale-[0.98] transition-all shrink-0"
              >
                <div className="h-8 w-8 rounded-full bg-purple-600 flex items-center justify-center text-white shrink-0">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 18v-6a9 9 0 0118 0v6M4 16h2a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3a1 1 0 011-1zm14 0h2a1 1 0 011 1v3a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3a1 1 0 011-1z" />
                  </svg>
                </div>
                <div>
                  <div className="text-[10px] font-extrabold text-slate-800 leading-none">Need help?</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Wishlist: slides in from LEFT | Need Help: slides in from RIGHT */}
        <>
          {needHelpOpen && (
            <>
              <button
                type="button"
                aria-label="Close drawer"
                onClick={() => setNeedHelpOpen(false)}
                className="absolute inset-y-0 left-0 w-1/2 z-40 cursor-pointer bg-transparent"
              />
              <div className="absolute inset-y-0 right-0 w-1/2 z-50">
                <NeedHelpDrawer isOpen={needHelpOpen} onClose={() => setNeedHelpOpen(false)} />
              </div>
            </>
          )}
          {bomOpen && (
            <>
              <div className="absolute inset-y-0 left-0 w-1/2 z-50">
                <BomDrawer isOpen={bomOpen} onClose={() => setBomOpen(false)} />
              </div>
              <button
                type="button"
                aria-label="Close drawer"
                onClick={() => setBomOpen(false)}
                className="absolute inset-y-0 right-0 w-1/2 z-40 cursor-pointer bg-transparent"
              />
            </>
          )}
          
          {compareDrawerOpen && (
            <CompareDrawer 
              isOpen={compareDrawerOpen} 
              onClose={() => setCompareDrawerOpen(false)} 
              products={compareProducts}
            />
          )}
        </>

        {/* ── Toast Notification ─────────────────────────── */}
        {toastMessage && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-[110] w-[88%] max-w-[360px] bg-white/75 text-slate-900 backdrop-blur-lg rounded-full py-2.5 px-4 shadow-[0_10px_30px_rgba(0,0,0,0.08)] flex items-center gap-2.5 border border-slate-200/50 animate-toast-slide-down">
            <div className="h-6 w-6 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
              <svg className="h-3.5 w-3.5 text-amber-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <span className="text-[10px] font-extrabold tracking-wide leading-tight text-slate-800">{toastMessage}</span>
          </div>
        )}

        {/* ── Export Wishlist Popup (every 5 min) ─────────────────────────── */}
        {showWishlistPopup && (
          <div className="absolute inset-0 z-[60] flex items-end justify-center pb-24 px-5">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
              onClick={dismissWishlistPopup}
            />

            {/* Card */}
            <div className="relative w-full max-w-sm animate-[slideUp_0.35s_cubic-bezier(0.34,1.56,0.64,1)_both]">
              {/* Gradient border wrapper */}
              <div className="p-[1.5px] rounded-3xl bg-gradient-to-br from-purple-400 via-violet-500 to-indigo-500 shadow-[0_20px_60px_rgba(147,51,234,0.35)]">
                <div className="bg-[#faf8ff] rounded-[22px] overflow-hidden">

                  {/* Top shimmer bar */}
                  <div className="h-1 w-full bg-gradient-to-r from-purple-400 via-violet-500 to-indigo-400" />

                  {/* Content */}
                  <div className="px-6 pt-5 pb-6">
                    {/* Icon + heading row */}
                    <div className="flex items-start gap-3.5 mb-4">
                      <div className="shrink-0 h-11 w-11 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-purple-200">
                        <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </div>
                      <div className="flex-1 pt-0.5">
                        <div className="text-[9px] font-bold text-purple-500 uppercase tracking-[0.12em] leading-none mb-1">Your Wishlist</div>
                        <div className="text-[15px] font-extrabold text-slate-900 leading-snug">Save before you go!</div>
                      </div>
                      {/* Countdown ring */}
                      <div className="shrink-0 relative h-9 w-9">
                        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="15" fill="none" stroke="#ede9fe" strokeWidth="3" />
                          <circle
                            cx="18" cy="18" r="15" fill="none"
                            stroke="#9333ea" strokeWidth="3"
                            strokeDasharray={`${2 * Math.PI * 15}`}
                            strokeDashoffset={`${2 * Math.PI * 15 * (1 - wishlistDismissCountdown / 15)}`}
                            strokeLinecap="round"
                            style={{ transition: "stroke-dashoffset 1s linear" }}
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-purple-700">{wishlistDismissCountdown}</span>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-[11px] text-slate-500 leading-relaxed mb-5">
                      Export your selected products as a wishlist and take it with you — share it, save it, or revisit anytime.
                    </p>

                    {/* Dashed divider */}
                    <div className="border-t border-dashed border-purple-100 mb-5" />

                    {/* Action buttons */}
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={dismissWishlistPopup}
                        className="flex-1 py-2.5 rounded-full border border-slate-200 text-[11px] font-semibold text-slate-500 hover:bg-slate-50 active:scale-95 transition-all"
                      >
                        Maybe later
                      </button>
                      <button
                        type="button"
                        onClick={handleExportWishlist}
                        className="flex-[2] py-2.5 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 text-white text-[11px] font-extrabold shadow-md shadow-purple-200 hover:shadow-lg hover:shadow-purple-300 active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                        </svg>
                        Export Wishlist
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(32px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

export default function RmsTopBar({
  onBackClick,
  currentWarehouse,
  currentBlock,
  currentRack,
}: {
  onBackClick: () => void;
  currentWarehouse?: string;
  currentBlock?: string;
  currentRack?: string;
}) {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const [showLocateModal, setShowLocateModal] = useState(false);

  const token = params?.token;
  const rackId = searchParams.get("rack") || "";

  const handleLogoClick = () => {
    if (token) {
      router.push(`/rms/screen/${token}?rack=${rackId}`);
    }
  };

  return (
    <>
      <header className="bg-[#1a052e] px-3 py-3 text-white flex items-center justify-between z-10 relative">
        <div className="flex items-center gap-0">
          <button
            type="button"
            onClick={onBackClick}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div
            role="button"
            tabIndex={0}
            onClick={handleLogoClick}
            className="flex items-center justify-center h-16 -ml-1 cursor-pointer outline-none select-none"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <img 
              src="/logo.jpeg" 
              alt="KC" 
              className="h-16 w-auto object-contain mix-blend-screen"
              style={{ filter: "contrast(2.5) brightness(0.95)", transform: "translateY(2px)" }}
            />
          </div>
        </div>
        <button
          onClick={() => setShowLocateModal(true)}
          className="flex items-center gap-2 text-[10px] font-bold hover:bg-white/10 px-2 py-1.5 rounded-lg active:scale-95 transition-all cursor-pointer"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <div className="flex items-center gap-1">
            <svg className="h-3 w-3 text-purple-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
              <circle cx="12" cy="11" r="2.5" />
            </svg>
            <span>{currentWarehouse || "Floor"}</span>
          </div>
          <span className="text-white/30">|</span>
          <div className="flex items-center gap-1">
            <svg className="h-3 w-3 text-purple-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M9 3v18" />
            </svg>
            <span>{currentBlock || "Block"}</span>
          </div>
          <span className="text-white/30">|</span>
          <div className="flex items-center gap-1">
            <svg className="h-3 w-3 text-purple-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span>{currentRack || "Rack"}</span>
          </div>
        </button>
      </header>

      {/* Locate Sample Modal */}
      {showLocateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-white rounded-3xl p-6 max-w-[360px] w-full shadow-2xl border border-purple-50">
            <h3 className="text-center font-extrabold text-sm uppercase tracking-widest text-purple-600">Locate Sample</h3>

            <div className="mt-5 bg-purple-50/50 rounded-2xl p-5 border border-purple-100 text-center">
              <span className="text-[10px] font-black uppercase text-purple-600 tracking-wider">Path Guide</span>
              <div className="mt-3 flex flex-col items-center gap-1.5">
                <div className="text-[10px] font-bold text-slate-400">Warehouse</div>
                <div className="text-sm font-extrabold text-slate-800">{currentWarehouse || "Main"}</div>
                <div className="text-purple-300">↓</div>
                <div className="text-[10px] font-bold text-slate-400">Block</div>
                <div className="text-sm font-extrabold text-slate-800 bg-purple-100/50 px-3 py-1 rounded-lg border border-purple-200/50">{currentBlock || "Block"}</div>
                <div className="text-purple-300">↓</div>
                <div className="text-[10px] font-bold text-slate-400">Rack Location</div>
                <div className="text-base font-black bg-purple-600 text-white px-5 py-1.5 rounded-xl shadow-sm">{currentRack || "Rack"}</div>
              </div>
            </div>

            <p className="mt-4 text-[10px] text-slate-400 font-semibold text-center leading-relaxed">
              Walk to the designated block and locate the marked rack to pull your physical sample.
            </p>

            <button
              onClick={() => setShowLocateModal(false)}
              className="mt-6 w-full py-3 bg-slate-900 text-white font-bold text-xs uppercase tracking-widest rounded-2xl active:scale-95 transition-all shadow-md"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}

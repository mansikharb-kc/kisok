"use client";

import { useRouter, useParams } from "next/navigation";
import { useState } from "react";

interface NeedHelpDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NeedHelpDrawer({ isOpen, onClose }: NeedHelpDrawerProps) {
  const router = useRouter();
  const params = useParams();
  const token = params?.token as string;
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelfHelp = (action: string) => {
    onClose();
    if (action === "find") {
      router.push(`/rms/screen/${token}/product`);
    } else if (action === "locate") {
      window.dispatchEvent(new CustomEvent("trigger-locate"));
    } else if (action === "bom") {
      // bom page removed — just close drawer
    } else if (action === "directions") {
      alert("Floor map wayfinding simulation: Head to Block B, Rack 1.");
    }
  };

  const selfHelpItems = [
    { action: "find",       label: "Find Material",    icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
    { action: "locate",     label: "Locate Sample",    icon: "M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" },
    { action: "bom",        label: "Add to Wishlist",       icon: "M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" },
    { action: "directions", label: "Floor Directions", icon: "M13 5l7 7-7 7M5 5l7 7-7 7" },
  ];

  const faqs = [
    {
      q: "How do I search for a product?",
      a: "Type the name, brand, or category in the search bar at the top of the screen."
    },
    {
      q: "How do I compare products?",
      a: "Click 'Compare Products' at the bottom, select up to 4 items using checkboxes, and they will display side-by-side automatically."
    },
    {
      q: "How do I remove an item from comparison?",
      a: "Simply uncheck the product checkbox on the grid, or click the 'X' button next to the product in the comparison drawer."
    },
    {
      q: "How do I save items to my Wishlist?",
      a: "Click the 'Start Wishlist' button at the bottom of the screen, or add individual items. You can view and export it from the wishlist drawer."
    },
    {
      q: "Can I add all compared items to my Wishlist?",
      a: "Yes! Open the comparison drawer and click 'Add all to Wishlist' at the bottom."
    },
    {
      q: "How do I go back or return Home?",
      a: "Tap the back arrow at the top left to go back one page, or tap the Home icon at the top to return to the main categories screen."
    }
  ];

  return (
    <div className="relative w-full h-full flex flex-col select-none bg-white shadow-[-6px_0_32px_rgba(0,0,0,0.12)] animate-slide-in overflow-y-auto border-l border-slate-200/60">

      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex flex-col items-center border-b border-slate-100 relative bg-white">
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
        <h2 className="text-base font-black text-slate-800 mt-2 leading-none">Need Help?</h2>
        <div className="text-[8px] font-black text-purple-600 tracking-wider mt-1 uppercase">
          We are here for you
        </div>
        <p className="text-slate-400 text-[10px] mt-1.5 font-semibold text-center leading-tight">
          Choose how you&apos;d like the assistance today
        </p>
      </div>

      {/* Content */}
      <div className="px-3 py-3 space-y-4 flex-1">



        {/* Human Help */}
        <div>
          <h3 className="text-[9px] font-black text-purple-700 tracking-widest uppercase mb-2 px-0.5">Human Help</h3>
          <div className="bg-[#faf8ff] p-2 rounded-2xl border border-purple-50">
            <div className="bg-white rounded-xl border border-slate-100 px-3 py-2.5 flex items-center justify-between shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
              <div className="flex items-center gap-2">
                <div className="relative h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-green-500 border border-white animate-pulse" />
                </div>
                <span className="text-[11px] font-bold text-slate-700">Assistance</span>
              </div>
              <button
                type="button"
                onClick={() => alert("Calling store representative... Please wait at the kiosk.")}
                className="bg-purple-600 text-white font-bold text-[9px] py-1.5 px-3 rounded-full flex items-center gap-1 active:scale-95 transition-all shrink-0"
              >
                <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24">
                  <path d="M21.384 17.791l-4.148-2.074c-.452-.226-1-.136-1.353.217l-1.927 1.927c-3.149-1.636-5.719-4.206-7.355-7.355l1.927-1.927c.353-.353.443-.901.217-1.353L6.673 3.081c-.244-.488-.748-.795-1.291-.795H3.6C2.716 2.286 2 3.003 2 3.887C2 13.339 9.661 21 19.113 21c.884 0 1.601-.716 1.601-1.6v-1.782c.001-.543-.306-1.047-.795-1.291z" />
                </svg>
                Call now
              </button>
            </div>
          </div>
        </div>

        {/* Popular Questions */}
        <div>
          <h3 className="text-[9px] font-black text-purple-700 tracking-widest uppercase mb-2 px-0.5">Popular Questions</h3>
          <div className="bg-[#faf8ff] p-2 rounded-2xl border border-purple-50 space-y-1.5">
            {faqs.map((faq) => {
              const isExpanded = expandedFaq === faq.q;
              return (
                <div
                  key={faq.q}
                  className="w-full bg-white rounded-xl border border-slate-100 p-2.5 flex flex-col justify-between shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedFaq(isExpanded ? null : faq.q)}
                    className="w-full flex items-start justify-between text-left focus:outline-none"
                  >
                    <div className="flex items-center gap-2.5">
                      {/* Light-purple rounded box containing document/page outline icon */}
                      <div className="h-7 w-7 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <span className="text-[10.5px] font-bold text-purple-700 leading-snug">{faq.q}</span>
                    </div>
                    <span className="text-purple-600 shrink-0 ml-2 mt-1">
                      {isExpanded ? (
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                        </svg>
                      ) : (
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="mt-2 pl-[36px] text-[10px] text-slate-500 font-semibold leading-normal pr-1">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}

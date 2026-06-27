"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";

interface CompareDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  products: any[];
}

export default function CompareDrawer({ isOpen, onClose, products }: CompareDrawerProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "specifications" | "characteristics">("overview");
  
  // Drag to close logic
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only allow drag from the top handle area
    const target = e.target as HTMLElement;
    if (!target.closest(".drag-handle")) return;
    
    setIsDragging(true);
    const startY = e.clientY;
    const initialY = dragY;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaY = moveEvent.clientY - startY;
      if (deltaY > 0) { // Only allow dragging downwards
        setDragY(initialY + deltaY);
      }
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      setIsDragging(false);
      const deltaY = upEvent.clientY - startY;
      
      // If dragged down more than 100px, close it
      if (deltaY > 100) {
        onClose();
      } else {
        // Snap back
        setDragY(0);
      }
      
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };
  
  // Reset drag position when reopened
  useEffect(() => {
    if (isOpen) setDragY(0);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRemoveProduct = (productId: string) => {
    try {
      const rawIds = localStorage.getItem("rms_compare");
      let ids = rawIds ? JSON.parse(rawIds) : [];
      ids = ids.filter((id: string) => id !== productId);
      localStorage.setItem("rms_compare", JSON.stringify(ids));

      const rawProducts = localStorage.getItem("rms_compare_products");
      let storedProducts = rawProducts ? JSON.parse(rawProducts) : [];
      storedProducts = storedProducts.filter((p: any) => p.id !== productId);
      localStorage.setItem("rms_compare_products", JSON.stringify(storedProducts));

      window.dispatchEvent(new Event("compare-updated"));
      
      if (ids.length === 0) {
        onClose();
      }
    } catch (e) { console.error(e); }
  };

  const handleAddAllToWishlist = () => {
    try {
      const existing = localStorage.getItem("rms_bom");
      const list = existing ? JSON.parse(existing) : [];
      
      products.forEach((p) => {
        if (!p || !p.id) return;
        const idx = list.findIndex((x: any) => x.id === p.id);
        if (idx === -1) {
          list.push({
            id: p.id,
            name: p.name,
            sku: p.sku || "Unknown",
            brandName: p.brandName || "Brand",
            categoryName: p.categoryName || "Category",
            quantity: 1,
          });
        } else {
          list[idx].quantity += 1;
        }
      });
      
      localStorage.setItem("rms_bom", JSON.stringify(list));
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new Event("bom-updated"));
      
      // Close compare drawer and open wishlist drawer
      onClose();
      window.dispatchEvent(new Event("open-bom-drawer"));
    } catch (e) {
      console.error(e);
    }
  };

  // Mock Attributes for matching UI
  const mockOverview = [
    { label: "Brand", values: ["100% Polyester", "Natural Marble", "Wood Veneer", "Easy"] },
    { label: "Category", values: ["Easy", "Easy", "Easy", "Easy"] },
    { label: "Finish", values: ["Easy", "Easy", "Easy", "Easy"] },
    { label: "Colour Family", values: ["Colour 1", "Colour 2", "Colour 3", "Colour 4"] },
    { label: "Material type", values: ["Easy", "Easy", "Easy", "Easy"] },
    { label: "Sample Location", values: ["Easy", "Easy", "Easy", "Easy"] }
  ];

  const mockSpecs = [
    { label: "Composition", values: ["100% Polyester", "Natural Marble", "Wood Veneer", "Easy"] },
    { label: "Width / Size", values: ["Easy", "Easy", "Easy", "Easy"] },
    { label: "Thickness", values: ["Easy", "Easy", "Easy", "Easy"] },
    { label: "Abrasion / Martindale", values: ["Easy", "Easy", "Easy", "Easy"] },
    { label: "Water absorption", values: ["Easy", "Easy", "Easy", "Easy"] }
  ];

  const mockCharacteristics = [
    { label: "Durability", rating: [5, 5, 5, 5] },
    { label: "Maintenance", rating: [5, 3, 5, 5], text: ["Easy", "Medium", "Easy", "Easy"] },
    { label: "Water Resistance", rating: [0, 0, 0, 0] },
    { label: "Scratch Resistance", rating: [0, 0, 0, 0] },
    { label: "Stain Resistance", rating: [0, 0, 0, 0] },
    { label: "Heat Resistance", rating: [0, 0, 0, 0] },
    { label: "UV Resistance", rating: [0, 0, 0, 0] },
    { label: "Fire Rating", values: ["Class A1", "Class B", "Class A1", "Class A1"] },
    { label: "Sustainability", values: ["Good", "Excellent", "Good", "Good"] },
    { label: "Indoor / Outdoor", values: ["Indoor", "Indoor", "Indoor", "Both"] }
  ];

  const renderStars = (rating: number = 0) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} className={`h-2 w-2 ${s <= rating ? "text-purple-500 fill-current" : "text-slate-200"}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="10" />
        </svg>
      ))}
    </div>
  );

  return (
    <div 
      className="fixed inset-0 z-[100] flex flex-col justify-end pointer-events-none"
    >
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto transition-opacity"
        onClick={onClose}
      />
      
      <div 
        ref={drawerRef}
        onPointerDown={handlePointerDown}
        style={{
          transform: `translateY(${dragY}px)`,
          transition: isDragging ? "none" : "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)"
        }}
        className="w-full h-[85vh] bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.15)] flex flex-col pointer-events-auto relative mx-auto overflow-hidden animate-[slideUp_0.4s_cubic-bezier(0.16,1,0.3,1)]"
      >
        {/* Handle for Dragging */}
        <div className="drag-handle w-full flex justify-center pt-4 pb-3 cursor-grab active:cursor-grabbing relative z-10 bg-white">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
        </div>

        {/* Content Container */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 pt-0 custom-scrollbar">
          
          {/* Selected Products Headers */}
          <div 
            className="grid gap-2 mb-4"
            style={{ gridTemplateColumns: `repeat(${Math.max(1, products.length)}, minmax(0, 1fr))` }}
          >
            {products.map((p, index) => {
              if (!p) return null;
              return (
                <div key={index} className="relative bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                  {/* Remove Button */}
                  {products[index] && (
                    <button 
                      onClick={() => handleRemoveProduct(products[index].id)}
                      className="absolute top-1 right-1 h-4 w-4 bg-black/20 hover:bg-black/40 text-white rounded-full flex items-center justify-center z-10 transition-colors"
                    >
                      <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                  {/* Image Placeholder */}
                  <div className="h-20 w-full bg-gradient-to-br from-stone-200 to-stone-400 shrink-0" />
                  
                  {/* Info */}
                  <div className="p-1.5 flex flex-col flex-1">
                    <span className="text-[9px] font-extrabold text-slate-800 leading-tight line-clamp-2">{p.name}</span>
                    <span className="text-[7px] text-purple-600 font-bold uppercase mt-auto pt-1">Finishes</span>
                    <div className="flex items-center gap-0.5 mt-0.5 text-[7px] text-slate-500 font-semibold">
                      <svg className="h-2 w-2 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="11" r="2.5"/><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"/></svg>
                      <span className="truncate">D1-F1-T01</span>
                    </div>
                    {/* Swatches */}
                    <div className="flex gap-0.5 mt-1">
                      <div className="w-2.5 h-2.5 bg-stone-300 rounded-[2px]" />
                      <div className="w-2.5 h-2.5 bg-stone-400 rounded-[2px]" />
                      <div className="w-2.5 h-2.5 bg-stone-500 rounded-[2px]" />
                      <div className="w-2.5 h-2.5 bg-rose-200/50 rounded-[2px] flex items-center justify-center text-[5px] text-rose-500 font-bold">+5</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tabs */}
          <div className="flex bg-slate-50 p-1 rounded-full mb-5 border border-slate-100">
            {[
              { id: "overview", label: "Overview", icon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
              { id: "specifications", label: "Specifications", icon: "M4 6h16M4 10h16M4 14h16M4 18h16" },
              { id: "characteristics", label: "Characteristics", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex justify-center items-center gap-1.5 py-1.5 rounded-full text-[9px] font-bold transition-all ${
                  activeTab === tab.id 
                    ? "bg-purple-100 text-purple-700 shadow-sm" 
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/50"
                }`}
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
                </svg>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="border border-slate-100 rounded-2xl p-3 bg-white mb-20">
            <div className="flex items-start gap-2 mb-4">
              <svg className="h-4 w-4 text-purple-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <div>
                <h3 className="text-[10px] font-black text-purple-700 leading-tight">
                  {activeTab === "overview" && "Overview"}
                  {activeTab === "specifications" && "Technical specifications"}
                  {activeTab === "characteristics" && "Material Characteristics"}
                </h3>
                <p className="text-[8px] text-slate-400 font-medium">Performance that helps you decide</p>
              </div>
            </div>

            {/* Data Table */}
            <div className="w-full border-t border-slate-100">
              {((activeTab === "overview" ? mockOverview : activeTab === "specifications" ? mockSpecs : mockCharacteristics) as any[])
                .filter((row) => {
                  const numCols = products.length;
                  if (numCols <= 1) return true;
                  
                  if (row.values) {
                    const firstVal = row.values[0];
                    return row.values.slice(0, numCols).some((v: any) => v !== firstVal);
                  }
                  if (row.rating) {
                    const firstRating = row.rating[0];
                    const firstText = row.text ? row.text[0] : null;
                    for (let i = 1; i < numCols; i++) {
                      if (row.rating[i] !== firstRating) return true;
                      if (row.text && row.text[i] !== firstText) return true;
                    }
                    return false;
                  }
                  return true;
                })
                .map((row, i) => (
                <div key={i} className="flex items-center border-b border-slate-100 min-h-[32px] py-1">
                  <div className="w-1/4 pr-2">
                    <span className="text-[8px] font-bold text-slate-600">{row.label}</span>
                  </div>
                  <div className="w-3/4 flex h-full">
                    {products.map((_, col) => (
                      <div key={col} className="flex-1 flex items-center justify-center border-l border-slate-100/50 px-1 py-1">
                        {row.values && <span className="text-[7.5px] font-medium text-slate-500 text-center">{row.values[col]}</span>}
                        {row.rating && (
                          <div className="flex flex-col items-center gap-0.5">
                            {renderStars(row.rating[col])}
                            {row.text && <span className="text-[7px] text-slate-400 font-semibold">{row.text[col]}</span>}
                          </div>
                        )}
                        {!row.values && !row.rating && <span className="text-[7.5px] text-slate-300">-</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
        </div>

        {/* Sticky Bottom Action */}
        <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-100 p-4 pb-6 flex justify-center shadow-[0_-4px_12px_rgba(0,0,0,0.02)]">
          <button 
            onClick={handleAddAllToWishlist}
            className="flex items-center gap-2 px-8 py-2.5 rounded-full border border-purple-200 text-purple-600 hover:bg-purple-50 active:scale-95 transition-all text-[10px] font-bold shadow-sm bg-white"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            Add Selected to Wishlist
          </button>
        </div>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
      `}</style>
    </div>
  );
}

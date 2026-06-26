"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import RmsTopBar from "./RmsTopBar";

type SpecItem = { name: string; value: string };

type CopyItem = {
  id: string;
  instanceCode: string;
  location: {
    id: string;
    name: string;
    nodeType: string;
    parent: {
      id: string;
      name: string;
      nodeType: string;
      parent: { id: string; name: string; nodeType: string } | null;
    } | null;
  } | null;
};

type ProductItem = {
  id: string;
  name: string;
  sku: string;
  brand: { id: string; name: string };
  category: { id: string; name: string };
  specs: SpecItem[];
  copies: CopyItem[];
};

type SimilarItem = { 
  id: string; 
  name: string; 
  sku: string;
  copies?: { location: any }[];
};

// Cycling gradients for product cards
const GRADIENTS = [
  "from-[#d4c5a9] to-[#a89070]",
  "from-[#b8c4d4] to-[#7a90a8]",
  "from-[#c4d4b8] to-[#8aa870]",
  "from-[#d4b8c4] to-[#a87090]",
  "from-[#c4c0d4] to-[#8880a8]",
];

export default function ProductDetail({
  token,
  productId,
  product,
  similarProducts,
}: {
  token: string;
  productId: string;
  product: ProductItem;
  similarProducts: SimilarItem[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rackId = searchParams.get("rack") || "";
  const catId = searchParams.get("cat") || "";
  const brandId = searchParams.get("brand") || "";

  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [showLocateModal, setShowLocateModal] = useState(false);
  const [addedToBom, setAddedToBom] = useState(false);
  const [addedSimilarId, setAddedSimilarId] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [isOverviewOpen, setIsOverviewOpen] = useState(true);
  
  const [compareMode, setCompareMode] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("rms_compare");
        return raw ? JSON.parse(raw) : [];
      } catch {}
    }
    return [];
  });

  const checkCompareMode = () => {
    try {
      const mode = localStorage.getItem("rms_compare_mode") === "true";
      setCompareMode(mode);
      const raw = localStorage.getItem("rms_compare");
      setSelectedProductIds(raw ? JSON.parse(raw) : []);
    } catch {
      setCompareMode(false);
    }
  };

  useEffect(() => {
    checkCompareMode();
    window.addEventListener("compare-mode-updated", checkCompareMode);
    window.addEventListener("compare-updated", checkCompareMode);
    return () => {
      window.removeEventListener("compare-mode-updated", checkCompareMode);
      window.removeEventListener("compare-updated", checkCompareMode);
    };
  }, []);

  // Generate QR code for physical sample sticker mapping
  useEffect(() => {
    const qrData = product.copies[0]?.instanceCode || product.sku || productId;
    QRCode.toDataURL(qrData, { width: 140, margin: 1 })
      .then((url) => setQrCodeUrl(url))
      .catch((err) => console.error("QR Code Error:", err));
  }, [product, productId]);

  // Location info
  const loc = product.copies[0]?.location;

  const buildFullLocationPath = (node: any): string => {
    const parts: string[] = [];
    let curr = node;
    while (curr) {
      if (curr.name) parts.unshift(curr.name);
      curr = curr.parent;
    }
    return parts.join(" › ");
  };

  const findNodeByType = (node: any, type: string): any => {
    let curr = node;
    while (curr) {
      if (curr.nodeType === type) return curr;
      curr = curr.parent;
    }
    return null;
  };

  const locationPath = loc ? buildFullLocationPath(loc) : null;

  const rackNode = findNodeByType(loc, "RACK");
  const blockNode = findNodeByType(loc, "BLOCK");
  const warehouseNode = findNodeByType(loc, "WAREHOUSE");

  const currentRack = rackNode?.name ?? (loc?.nodeType === "RACK" ? loc.name : "");
  const currentBlock = blockNode?.name ?? "";
  const currentWarehouse = warehouseNode?.name ?? "";
  const simulatedTray = `Tray ${(Number(product.id) % 4) + 1}`;

  function handleAddToBom(item?: SimilarItem) {
    try {
      const targetId = item ? item.id : product.id;
      const targetName = item ? item.name : product.name;
      const targetSku = item ? item.sku : product.sku;
      const targetBrand = product.brand.name;
      const targetCategory = product.category.name;

      const existing = localStorage.getItem("rms_bom");
      const list = existing ? JSON.parse(existing) : [];
      const idx = list.findIndex((x: any) => x.id === targetId);
      if (idx === -1) {
        list.push({
          id: targetId,
          name: targetName,
          sku: targetSku,
          brandName: targetBrand,
          categoryName: targetCategory,
          quantity: 1,
        });
      } else {
        list[idx].quantity += 1;
      }
      localStorage.setItem("rms_bom", JSON.stringify(list));
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new Event("bom-updated"));
      
      if (item) {
        setAddedSimilarId(item.id);
        setTimeout(() => setAddedSimilarId(null), 1500);
      } else {
        setAddedToBom(true);
        setTimeout(() => setAddedToBom(false), 2000);
      }
    } catch (e) {
      console.error(e);
    }
  }

  function toggleSelectProduct(p: SimilarItem | ProductItem) {
    setSelectedProductIds((prev) => {
      if (!prev.includes(p.id) && prev.length >= 4) {
        window.dispatchEvent(new CustomEvent("show-toast", { detail: "You have already selected 4. You can compare a maximum of 4 items." }));
        return prev;
      }
      const next = prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id];
      localStorage.setItem("rms_compare", JSON.stringify(next));
      
      try {
        const raw = localStorage.getItem("rms_compare_products");
        let products = raw ? JSON.parse(raw) : [];
        if (next.includes(p.id)) {
          if (!products.some((x: any) => x.id === p.id)) {
            // For ProductDetail, the product object might not have brandName flatly, so we map it
            products.push({
              id: p.id,
              name: p.name,
              sku: p.sku,
              brandName: "brandName" in p ? p.brandName : ("brand" in p ? p.brand.name : "Brand"),
              categoryName: "categoryName" in p ? p.categoryName : ("category" in p ? p.category.name : "Category"),
              locations: [] // simplified for compare drawer
            });
          }
        } else {
          products = products.filter((x: any) => x.id !== p.id);
        }
        localStorage.setItem("rms_compare_products", JSON.stringify(products));
      } catch (e) { console.error(e); }
      
      window.dispatchEvent(new Event("compare-updated"));
      return next;
    });
  }

  function handleBackClick() {
    router.back();
  }

  return (
    <div className="mx-auto min-h-screen max-w-[480px] bg-[#f6f5fa] pb-20">
      {/* ── Header ── */}
      <RmsTopBar 
        onBackClick={handleBackClick}
        currentWarehouse={currentWarehouse}
        currentBlock={currentBlock}
        currentRack={currentRack}
      />

      {/* ── Breadcrumb & Search ── */}
      <div className="px-4 pt-3 pb-2 bg-white">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-purple-500/70">
          <button 
            onClick={() => router.push(`/rms/screen/${token}?rack=${rackId}`)} 
            className="hover:text-purple-600 flex items-center gap-1"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>Home</span>
          </button>
          <span className="text-slate-300">›</span>
          <button onClick={() => router.push(`/rms/screen/${token}/brand`)} className="hover:text-purple-600">Brands</button>
        </div>
        <h1 className="mt-1 text-[17px] font-black text-slate-900 leading-tight">
          <span className="text-purple-600">{product.brand.name}</span> Product
        </h1>

      </div>

      {/* ── Product Section Top (Category/Location) ── */}
      <div className="px-4 pt-4 pb-2 bg-[#f6f5fa]">
        <h2 className="text-[15px] font-black text-purple-600">{product.category.name}</h2>
        <div className="mt-1 flex items-center gap-1.5 text-[9px] font-bold text-slate-400">
          <span className="h-2 w-1.5 rounded-sm bg-red-500 inline-block" />
          {[currentWarehouse, currentBlock, currentRack, simulatedTray].filter(Boolean).map((seg, i, arr) => (
            <span key={i} className="flex items-center gap-1">
              <span>{seg}</span>
              {i < arr.length - 1 && <span className="text-slate-300 font-light">•</span>}
            </span>
          ))}
        </div>
      </div>

      {/* ── Main Product Area (2 Columns) ── */}
      <div className="mx-4 mt-3 flex items-start gap-4">
        
        {/* ── LEFT COLUMN: Images & Actions ── */}
        <div className="w-[57%] flex flex-col shrink-0 bg-white border border-slate-200 rounded-[16px] p-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.03)] gap-2">
          {/* Main Image */}
          <div className="relative aspect-[1.2] w-full rounded-[12px] bg-gradient-to-b from-[#e3dac9] to-[#bca685] overflow-hidden">
            {compareMode && (
              <div className="absolute top-2 right-2 z-10">
                <input
                  type="checkbox"
                  checked={selectedProductIds.includes(product.id)}
                  onChange={() => toggleSelectProduct(product)}
                  className="h-6 w-6 rounded-md border-white/50 text-purple-600 focus:ring-purple-500 bg-white/50 cursor-pointer backdrop-blur-sm"
                />
              </div>
            )}
            <div className="absolute top-2 left-2 bg-green-100 text-green-600 border border-green-200 text-[8px] font-extrabold tracking-wide px-2 py-0.5 rounded-full shadow-sm">
              In Stock
            </div>
            <button
              onClick={() => setShowQr(!showQr)}
              className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm rounded-lg p-1 shadow-md border border-white/50 active:scale-95 transition-all"
              title="Show QR Code"
            >
              {qrCodeUrl ? (
                <img src={qrCodeUrl} alt="QR" className="h-8 w-8 object-contain" />
              ) : (
                <div className="h-8 w-8 bg-slate-100 rounded-md animate-pulse" />
              )}
              <p className="text-[5px] font-bold text-slate-400 text-center mt-0.5 uppercase tracking-widest">Scan</p>
            </button>
          </div>

          {/* Thumbnails */}
          <div className="grid grid-cols-6 gap-1.5 mt-0.5">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={`w-full aspect-[1.1] rounded-md border ${
                  i === 0
                    ? "bg-gradient-to-b from-[#e3dac9] to-[#bca685] border-purple-400"
                    : "bg-gradient-to-b from-[#e8e0d1] to-[#cfc1ac] opacity-70 border-slate-200"
                }`}
              />
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="flex justify-center mt-2 pb-1 w-full">
            <button
              type="button"
              onClick={() => handleAddToBom()}
              className={`w-full py-1.5 rounded-full font-bold text-[9px] transition-all active:scale-[0.98] ${
                addedToBom
                  ? "bg-emerald-500 text-white"
                  : "bg-[#a855f7] text-white hover:bg-[#9333ea]"
              }`}
            >
              {addedToBom ? "✓ Added!" : "Add to Wishlist"}
            </button>
          </div>
        </div>

        {/* ── RIGHT COLUMN: Product Details ── */}
        <div className="w-[43%] flex flex-col">
          <div>
            <h2 className="text-[17px] font-black text-slate-900 leading-tight">{product.name}</h2>
            <p className="text-[10px] font-semibold text-slate-500 mt-1">by <span className="text-slate-800">{product.brand.name}</span></p>
          </div>

          {/* Material type tags */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {product.specs.slice(0, 4).map((spec, i) => (
              <span key={i} className="rounded-full bg-purple-50 border border-purple-100/60 px-2 py-0.5 text-[8px] font-bold text-purple-700">
                {spec.value}
              </span>
            ))}
            {product.specs.length === 0 && (
              <>
                <span className="rounded-full bg-purple-50 border border-purple-100/60 px-2 py-0.5 text-[8px] font-bold text-purple-700">Natural</span>
                <span className="rounded-full bg-purple-50 border border-purple-100/60 px-2 py-0.5 text-[8px] font-bold text-purple-700">Textile</span>
              </>
            )}
          </div>

          {/* About this product */}
          <div className="bg-white rounded-[12px] p-3 border border-slate-200 shadow-sm mt-4">
            <h4 className="text-[10px] font-bold text-slate-800 mb-1.5">About this product</h4>
            <p className="text-[9px] text-slate-500 leading-relaxed font-medium">
              {product.category.name} product by {product.brand.name}. SKU: {product.sku}.<br/>
              Available in {product.copies.length} location{product.copies.length !== 1 ? "s" : ""}.
            </p>
          </div>

          {/* Overview table */}
          <div className="rounded-[12px] border border-purple-200 overflow-hidden shadow-sm mt-3 transition-all">
            <div 
              className={`flex items-center justify-between px-3 py-2 bg-white cursor-pointer active:bg-slate-50 ${isOverviewOpen ? "border-b border-purple-100" : ""}`}
              onClick={() => setIsOverviewOpen(!isOverviewOpen)}
            >
              <span className="text-[10px] font-black text-[#a855f7] uppercase tracking-wider select-none">Overview</span>
              <svg className={`h-3 w-3 text-[#a855f7] transition-transform duration-200 ${isOverviewOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            
            {isOverviewOpen && (
              <div className="bg-white divide-y divide-purple-50">
                <div className="flex justify-between px-3 py-2 text-[9px]">
                  <span className="text-slate-500 font-semibold">Material type</span>
                  <span className="text-slate-700 font-bold truncate max-w-[80px] text-right">{product.category.name}</span>
                </div>
                <div className="flex justify-between px-3 py-2 text-[9px]">
                  <span className="text-slate-500 font-semibold">Category</span>
                  <span className="text-slate-700 font-bold truncate max-w-[80px] text-right">{product.brand.name}</span>
                </div>
                {product.specs.slice(0, 2).map((spec, i) => (
                  <div key={i} className="flex justify-between px-3 py-2 text-[9px]">
                    <span className="text-slate-500 font-semibold">{spec.name}</span>
                    <span className="text-slate-700 font-bold truncate max-w-[80px] text-right">{spec.value}</span>
                  </div>
                ))}
                <div className="flex justify-between px-3 py-2 text-[9px]">
                  <span className="text-slate-500 font-semibold">SKU</span>
                  <span className="text-slate-700 font-bold font-mono truncate max-w-[80px] text-right">{product.sku}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── More from Brand ── */}
      {similarProducts.length > 0 && (
        <div className="mt-6 px-4">
          {/* Section header */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] font-bold text-slate-800">
              More from {product.brand.name}
            </h3>
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => router.push(`/rms/screen/${token}/brand?brand=${product.brand.id}&rack=${rackId}`)}
                className="text-[#a855f7] font-bold text-[10px] ml-1 cursor-pointer hover:underline active:scale-95 transition-all"
              >
                Explore Brand →
              </button>
            </div>
          </div>

          {/* Horizontal scroll product cards */}
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {similarProducts.map((sp, idx) => (
              <div
                key={sp.id}
                className="shrink-0 w-[130px] snap-start overflow-hidden rounded-[16px] bg-white border border-slate-100 shadow-[0_4px_14px_rgba(0,0,0,0.05)] flex flex-col"
              >
                {/* Card image */}
                <div className={`relative h-[90px] bg-gradient-to-b ${GRADIENTS[idx % GRADIENTS.length]} flex flex-col justify-end p-2`}>
                  {compareMode && (
                    <div className="absolute top-2 right-2 z-10">
                      <input
                        type="checkbox"
                        checked={selectedProductIds.includes(sp.id)}
                        onChange={() => toggleSelectProduct(sp)}
                        className="h-4.5 w-4.5 rounded border-purple-300 text-purple-600 focus:ring-purple-500 bg-white cursor-pointer"
                      />
                    </div>
                  )}
                  <span className="text-[10px] font-extrabold text-white leading-tight drop-shadow line-clamp-2">{sp.name}</span>
                </div>
                {/* Card info */}
                <div className="flex flex-col gap-1.5 p-2 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="rounded-full bg-purple-50 px-1.5 py-0.5 text-[7.5px] font-bold text-purple-600 border border-purple-100/50 uppercase">
                      Finishes
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[7.5px] font-semibold text-slate-400">
                    <svg className="h-2 w-2 text-purple-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                      <circle cx="12" cy="11" r="2.5" />
                    </svg>
                    <span className="truncate">
                      {sp.copies?.[0]?.location 
                        ? `${buildFullLocationPath(sp.copies[0].location)} › Tray ${(Number(sp.id) % 4) + 1}`.split(" › ").join(".")
                        : "Location unknown"}
                    </span>
                  </div>
                  <div className="flex-1" />
                  <button
                    type="button"
                    className={`w-full rounded-full py-1.5 text-[8px] font-bold transition-all active:scale-[0.97] ${
                      addedSimilarId === sp.id
                        ? "bg-emerald-500 text-white"
                        : "bg-[#a855f7] text-white hover:bg-purple-600"
                    }`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleAddToBom(sp);
                    }}
                  >
                    {addedSimilarId === sp.id ? "✓ Added!" : "Add to Wishlist"}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/rms/screen/${token}/product/${sp.id}?rack=${rackId}`)}
                    className="w-full rounded-full bg-[#f3e8ff] py-1.5 text-[8px] font-bold text-[#a855f7] transition-all hover:bg-purple-100 active:scale-[0.97]"
                  >
                    View →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Locate Sample Modal ── */}
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

    </div>
  );
}

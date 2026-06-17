"use client";

import { useState } from "react";
import BrandDetailsModal from "@/components/brands/BrandDetailsModal";

interface SellerBrandsListProps {
  sellerBrands: {
    brandId: string;
    brand: {
      id: string;
      name: string;
      code: string;
    };
  }[];
}

export default function SellerBrandsList({ sellerBrands }: SellerBrandsListProps) {
  const [selectedBrandDetailsId, setSelectedBrandDetailsId] = useState<string | null>(null);

  const card = "bg-white/60 backdrop-blur-md rounded-2xl border border-slate-200 p-6 shadow-sm";

  return (
    <div className={card}>
      <h3 className="font-bold text-slate-950 mb-4 pb-2 border-b border-slate-100">
        Associated Brands
      </h3>
      {sellerBrands.length === 0 ? (
        <p className="text-sm text-slate-400">No brands associated with this seller.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {sellerBrands.map((sb: any) => (
            <button
              key={sb.brand.code}
              type="button"
              onClick={() => setSelectedBrandDetailsId(sb.brand.id)}
              className="text-xs px-2.5 py-1 rounded-full bg-brand-50 hover:bg-brand-100 border border-brand-200 text-brand-700 hover:text-brand-800 font-semibold transition-all hover:scale-[1.03] text-left shadow-sm"
            >
              {sb.brand.name}
            </button>
          ))}
        </div>
      )}

      <BrandDetailsModal
        brandId={selectedBrandDetailsId}
        onClose={() => setSelectedBrandDetailsId(null)}
      />
    </div>
  );
}

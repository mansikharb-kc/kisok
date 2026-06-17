"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Globe, Phone, Mail, User, MapPin, Calendar, FileText, Tag } from "lucide-react";
import { formatDate } from "@/lib/format";

interface BrandDetailsModalProps {
  brandId: string | null;
  onClose: () => void;
}

export default function BrandDetailsModal({ brandId, onClose }: BrandDetailsModalProps) {
  const [brand, setBrand] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!brandId) {
      setBrand(null);
      return;
    }

    async function fetchBrand() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/brands/${brandId}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to fetch brand details");
          return;
        }
        setBrand(data.brand);
      } catch (err) {
        setError("Network error fetching brand details");
      } finally {
        setLoading(false);
      }
    }

    fetchBrand();
  }, [brandId]);

  if (!brandId) return null;

  return (
    <div className="fixed inset-0 bg-black/45 flex items-center justify-center z-[100] px-4 py-10 overflow-y-auto">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Brand Details</h3>
            <p className="text-xs text-slate-500 mt-0.5">Basic profile and categories</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-650 transition-colors p-1.5 rounded-lg hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
              <span className="text-sm text-slate-500 font-medium">Loading brand details...</span>
            </div>
          ) : error ? (
            <div className="rounded-xl bg-red-50 border border-red-205 text-red-700 text-sm p-4 text-center">
              {error}
            </div>
          ) : brand ? (
            <div className="space-y-6">
              {/* Brand Header Card */}
              <div className="flex items-start gap-4 bg-slate-50/60 p-4 rounded-xl border border-slate-200/60">
                {brand.logo?.url ? (
                  <img
                    src={brand.logo.url}
                    alt={brand.name}
                    className="w-14 h-14 rounded-lg object-contain bg-white border border-slate-200"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-lg uppercase shrink-0">
                    {brand.name.slice(0, 2)}
                  </div>
                )}
                <div className="min-w-0">
                  <h4 className="text-xl font-bold text-slate-900 truncate">{brand.name}</h4>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="font-mono text-xs text-slate-550 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-wider font-semibold">
                      {brand.code}
                    </span>
                    {brand.brandType && (
                      <span className="text-xs text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full font-semibold border border-brand-200">
                        {brand.brandType}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Description */}
              {brand.description && (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> Description
                  </span>
                  <p className="text-sm text-slate-600 font-medium bg-slate-50/50 p-3 rounded-lg border border-slate-100 leading-relaxed">
                    {brand.description}
                  </p>
                </div>
              )}

              {/* Grid Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Contact Info */}
                <div className="space-y-3">
                  <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">
                    Contact Details
                  </h5>
                  <div className="space-y-2.5 text-sm">
                    {brand.contactPerson && (
                      <div className="flex items-center gap-2.5 text-slate-700 font-medium">
                        <User className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{brand.contactPerson}</span>
                      </div>
                    )}
                    {(brand.phone || brand.phoneCc) && (
                      <div className="flex items-center gap-2.5 text-slate-700 font-medium">
                        <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{brand.phoneCc ? `+${brand.phoneCc} ` : ""}{brand.phone}</span>
                      </div>
                    )}
                    {brand.email && (
                      <div className="flex items-center gap-2.5 text-slate-700 font-medium">
                        <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                        <a href={`mailto:${brand.email}`} className="hover:text-brand-700 transition hover:underline truncate">{brand.email}</a>
                      </div>
                    )}
                    {brand.website && (
                      <div className="flex items-center gap-2.5 text-slate-700 font-medium">
                        <Globe className="w-4 h-4 text-slate-400 shrink-0" />
                        <a href={brand.website.startsWith("http") ? brand.website : `https://${brand.website}`} target="_blank" rel="noopener noreferrer" className="hover:text-brand-700 transition hover:underline truncate">{brand.website}</a>
                      </div>
                    )}
                    {!brand.contactPerson && !brand.phone && !brand.email && !brand.website && (
                      <span className="text-slate-400 text-xs italic">No contact details provided</span>
                    )}
                  </div>
                </div>
                {/* Address Details */}
                <div className="space-y-3">
                  <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0" /> Address Details
                  </h5>
                  <div className="space-y-2 text-sm text-slate-700 font-medium">
                    {brand.address && (
                      <div className="text-slate-650 leading-relaxed">{brand.address}</div>
                    )}
                    {(brand.city || brand.state || brand.pincode) ? (
                      <div className="font-semibold text-slate-800">
                        {[brand.city, brand.state, brand.pincode].filter(Boolean).join(", ")}
                      </div>
                    ) : (
                      !brand.address && (
                        <span className="text-slate-400 text-xs italic">No address details provided</span>
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* Categories Operated In */}
              <div className="space-y-3">
                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1 flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-slate-400" /> Deals In Categories
                </h5>
                {(!brand.brandCategories || brand.brandCategories.length === 0) ? (
                  <p className="text-sm text-slate-455 italic">No associated categories for this brand.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {brand.brandCategories.map((bc: any) => (
                      <span
                        key={bc.category.id}
                        className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-semibold"
                      >
                        {bc.category.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-slate-450 text-sm">
              No details found
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end bg-slate-50/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white text-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-50 shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

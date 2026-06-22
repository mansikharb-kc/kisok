"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Loader2, Tag, Search } from "lucide-react";
import { buildParentOptions, FlatCat } from "@/lib/categoryTree";
import { LEVELS, levelMeta } from "@/lib/categoryLevels";

interface BrandCategoryEditModalProps {
  brandId: string | null;
  flatCategories: FlatCat[];
  onClose: () => void;
  onSave?: () => void;
}

export default function BrandCategoryEditModal({
  brandId,
  flatCategories,
  onClose,
  onSave,
}: BrandCategoryEditModalProps) {
  const [brand, setBrand] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [categorySearch, setCategorySearch] = useState("");

  const parents = useMemo(() => buildParentOptions(flatCategories), [flatCategories]);
  const byId = useMemo(() => new Map(parents.map((p) => [p.id, p])), [parents]);

  const [sel, setSel] = useState<Record<number, string>>({});
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    if (!brandId) {
      setBrand(null);
      setPicked([]);
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
        const catIds = data.brand.brandCategories?.map((bc: any) => String(bc.categoryId)) ?? [];
        setPicked(catIds);
      } catch (err) {
        setError("Network error fetching brand details");
      } finally {
        setLoading(false);
      }
    }

    fetchBrand();
  }, [brandId]);

  function optionsForLevel(k: number) {
    let opts;
    if (k === 1) opts = parents.filter((p) => p.level === 1);
    else {
      const parentSel = sel[k - 1];
      if (!parentSel) return [];
      opts = parents.filter((p) => p.level === k && p.parentId === parentSel);
    }

    // Apply search filter
    if (categorySearch.trim()) {
      const query = categorySearch.toLowerCase();
      opts = opts.filter(o =>
        o.name.toLowerCase().includes(query) ||
        o.number.toLowerCase().includes(query)
      );
    }

    return opts;
  }

  function selectAt(k: number, id: string) {
    setSel((prev) => {
      const next: Record<number, string> = {};
      for (let i = 1; i < k; i++) if (prev[i]) next[i] = prev[i];
      next[k] = id;
      return next;
    });
  }

  const deepest = useMemo(() => {
    let id: string | null = null;
    for (let k = 1; k <= LEVELS.length; k++) if (sel[k]) id = sel[k];
    return id;
  }, [sel]);

  function addAssociation() {
    if (!deepest || picked.includes(deepest)) return;
    setPicked((p) => [...p, deepest]);
    setSel({});
  }

  function removeAssociation(id: string) {
    setPicked((p) => p.filter((x) => x !== id));
  }

  async function handleSave() {
    if (!brandId) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/brands/${brandId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryIds: picked }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save categories");
        return;
      }

      if (onSave) onSave();
      onClose();
    } catch (err) {
      setError("Network error saving categories");
    } finally {
      setSaving(false);
    }
  }

  if (!brandId) return null;

  const L = "block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1";
  const I = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500";

  return (
    <div className="fixed inset-0 bg-black/45 flex items-center justify-center z-[100] px-4 py-10 overflow-y-auto">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-100 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Manage Brand Categories</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {brand ? `Add or remove categories for ${brand.name}` : "Loading..."}
            </p>
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
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
              <span className="text-sm text-slate-500 font-medium">Loading brand...</span>
            </div>
          ) : error ? (
            <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm p-4 text-center">
              {error}
            </div>
          ) : brand ? (
            <>
              {/* Brand Header */}
              <div className="flex items-center gap-3 bg-slate-50/60 p-3 rounded-xl border border-slate-200/60">
                {brand.logo?.url ? (
                  <img
                    src={brand.logo.url}
                    alt={brand.name}
                    className="w-10 h-10 rounded-lg object-contain bg-white border border-slate-200"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-sm uppercase shrink-0">
                    {brand.name.slice(0, 2)}
                  </div>
                )}
                <div className="min-w-0">
                  <h4 className="text-base font-bold text-slate-900 truncate">{brand.name}</h4>
                  <span className="font-mono text-[10px] text-slate-500 uppercase tracking-wider">
                    {brand.code}
                  </span>
                </div>
              </div>

              {/* Category Picker */}
              <div className="space-y-3 border border-slate-200 rounded-xl p-4 bg-slate-50/30">
                <div className="flex items-center gap-2 mb-2">
                  <Tag className="w-4 h-4 text-slate-500" />
                  <label className="text-sm font-bold text-slate-700">Select Categories</label>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    placeholder="Search categories by name or code..."
                    className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  />
                  {categorySearch && (
                    <button
                      type="button"
                      onClick={() => setCategorySearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {LEVELS.slice(0, 4).map((lvl, idx) => {
                  const k = idx + 1;
                  if (k > 1 && !sel[k - 1]) return null;
                  const opts = optionsForLevel(k);
                  return (
                    <div key={k} className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium w-24 text-center ${lvl.badge}`}>
                        {lvl.label}
                      </span>
                      <select
                        value={sel[k] ?? ""}
                        onChange={(e) => (e.target.value ? selectAt(k, e.target.value) : null)}
                        className={`${I} flex-1`}
                      >
                        <option value="">
                          {k === 1 ? "Select Domain" : `Select ${lvl.label} (optional)`}
                        </option>
                        {opts.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.number} · {o.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={addAssociation}
                    disabled={!deepest || picked.includes(deepest)}
                    className="rounded-md bg-slate-800 text-white px-3 py-1.5 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    + Add this category
                  </button>
                  <span className="text-xs text-slate-400">
                    Pick a Domain, drill down, then add. Repeat for multiple.
                  </span>
                </div>
              </div>

              {/* Selected Categories */}
              <div className="space-y-2">
                <label className={L}>
                  Selected Categories ({picked.length})
                </label>
                {picked.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl bg-slate-50 text-slate-400 text-xs">
                    No categories selected yet. Use the dropdowns above to add categories.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 p-3 border border-slate-200 rounded-xl bg-white max-h-48 overflow-y-auto">
                    {picked.map((id) => {
                      const node = byId.get(id);
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 text-brand-800 text-xs px-2.5 py-1"
                        >
                          <span className="text-[9px] px-1 rounded bg-white">
                            {node ? levelMeta(node.level).label : ""}
                          </span>
                          {node?.name ?? id}
                          <button
                            type="button"
                            onClick={() => removeAssociation(id)}
                            className="text-brand-500 hover:text-brand-800"
                          >
                            ✕
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white text-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-50 shadow-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="rounded-lg bg-brand-600 text-white px-5 py-2 text-sm font-semibold hover:bg-brand-700 disabled:opacity-60 shadow-sm"
          >
            {saving ? "Saving..." : "Save Categories"}
          </button>
        </div>
      </div>
    </div>
  );
}

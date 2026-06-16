"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

type Program = {
  name: string;
};

type Contract = {
  id: string;
  verified: boolean;
  program: Program;
};

type Brand = {
  name: string;
  code: string;
};

type SellerBrand = {
  brand: Brand;
};

type Exec = {
  id: string;
  fullName: string;
  email: string;
};

type Assignment = {
  id: string;
  assignedAt: string;
  exec: Exec;
};

type Category = {
  id: string;
  name: string;
  code: string;
};

type Product = {
  id: string;
  name: string;
  sku: string;
  category?: Category;
};

type LocalRecord = {
  id: string;
  product?: Product;
};

type SellerRow = {
  id: string;
  name: string;
  sellerCode: string;
  membershipId: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  sellerBrands: SellerBrand[];
  contracts: Contract[];
  assignments: Assignment[];
  localRecords?: LocalRecord[];
  _count: {
    consignments: number;
    localRecords: number;
  };
};

export default function SellersClient({ initialSellers }: { initialSellers: SellerRow[] }) {
  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedExecName, setSelectedExecName] = useState("");
  const [sortBy, setSortBy] = useState("latest_registered");

  // Format Date Helper
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Get Today's Date formatted
  const getTodayFormatted = () => {
    return formatDate(new Date().toISOString());
  };

  // Extract filter options dynamically from active dataset to ensure consistency and relevance
  const categories = useMemo(() => {
    const map = new Map<string, { id: string; name: string; code: string }>();
    for (const s of initialSellers) {
      for (const lr of s.localRecords || []) {
        const cat = lr.product?.category;
        if (cat) {
          map.set(cat.id.toString(), {
            id: cat.id.toString(),
            name: cat.name,
            code: cat.code,
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [initialSellers]);

  const products = useMemo(() => {
    const map = new Map<string, { id: string; name: string; sku: string }>();
    for (const s of initialSellers) {
      for (const lr of s.localRecords || []) {
        const prod = lr.product;
        if (prod) {
          map.set(prod.id.toString(), {
            id: prod.id.toString(),
            name: prod.name,
            sku: prod.sku,
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [initialSellers]);

  const executives = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of initialSellers) {
      for (const a of s.assignments || []) {
        if (a.exec?.fullName) {
          map.set(a.exec.fullName, a.exec.fullName);
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [initialSellers]);

  // Apply filters
  const filteredSellers = useMemo(() => {
    return initialSellers.filter((s) => {
      // 1. Search Query filter (Seller Name, Code, or Membership ID)
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const matchesName = s.name.toLowerCase().includes(q);
        const matchesCode = s.sellerCode.toLowerCase().includes(q);
        const matchesMemberId = s.membershipId ? s.membershipId.toLowerCase().includes(q) : false;
        if (!matchesName && !matchesCode && !matchesMemberId) return false;
      }

      // 2. Category filter
      if (selectedCategoryId !== "") {
        const hasCategory = s.localRecords?.some(
          (lr) => lr.product?.category?.id.toString() === selectedCategoryId
        );
        if (!hasCategory) return false;
      }

      // 3. Product filter
      if (selectedProductId !== "") {
        const hasProduct = s.localRecords?.some(
          (lr) => lr.product?.id.toString() === selectedProductId
        );
        if (!hasProduct) return false;
      }

      // 4. Assigned Exec filter
      if (selectedExecName !== "") {
        if (selectedExecName === "unassigned") {
          if (s.assignments.length > 0) return false;
        } else if (selectedExecName === "assigned") {
          if (s.assignments.length === 0) return false;
        } else {
          const hasExec = s.assignments.some((a) => a.exec?.fullName === selectedExecName);
          if (!hasExec) return false;
        }
      }

      return true;
    });
  }, [initialSellers, searchQuery, selectedCategoryId, selectedProductId, selectedExecName]);

  // Apply sorting
  const sortedSellers = useMemo(() => {
    const list = [...filteredSellers];
    if (sortBy === "latest_registered") {
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    if (sortBy === "oldest_registered") {
      return list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    if (sortBy === "latest_assigned") {
      return list.sort((a, b) => {
        const timeA = a.assignments && a.assignments.length > 0
          ? Math.max(...a.assignments.map((as) => new Date(as.assignedAt).getTime()))
          : 0; // Stable fallback: unassigned sellers go to the bottom
        const timeB = b.assignments && b.assignments.length > 0
          ? Math.max(...b.assignments.map((as) => new Date(as.assignedAt).getTime()))
          : 0;
        return timeB - timeA;
      });
    }
    if (sortBy === "oldest_assigned") {
      return list.sort((a, b) => {
        const timeA = a.assignments && a.assignments.length > 0
          ? Math.min(...a.assignments.map((as) => new Date(as.assignedAt).getTime()))
          : Infinity; // Stable fallback: unassigned sellers go to the bottom
        const timeB = b.assignments && b.assignments.length > 0
          ? Math.min(...b.assignments.map((as) => new Date(as.assignedAt).getTime()))
          : Infinity;
        return timeA - timeB;
      });
    }
    if (sortBy === "name_asc") {
      return list.sort((a, b) => a.name.localeCompare(b.name));
    }
    if (sortBy === "name_desc") {
      return list.sort((a, b) => b.name.localeCompare(a.name));
    }
    return list;
  }, [filteredSellers, sortBy]);

  const hasActiveFilters = searchQuery !== "" || selectedCategoryId !== "" || selectedProductId !== "" || selectedExecName !== "";

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedCategoryId("");
    setSelectedProductId("");
    setSelectedExecName("");
    setSortBy("latest_registered");
  };

  // Select dropdown and input wrapper class
  const selectStyle = "block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors hover:border-slate-350 cursor-pointer";
  const labelStyle = "block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5";

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          {/* Search */}
          <div className="md:col-span-4">
            <label className={labelStyle}>Search Seller</label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, code, membership..."
                className="block w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-700 shadow-sm placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors hover:border-slate-350"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Category Filter */}
          <div className="md:col-span-2">
            <label className={labelStyle}>Category</label>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className={selectStyle}
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Product Filter */}
          <div className="md:col-span-2">
            <label className={labelStyle}>Product</label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className={selectStyle}
            >
              <option value="">All Products</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
          </div>

          {/* Assigned Exec Filter */}
          <div className="md:col-span-2">
            <label className={labelStyle}>Assignment</label>
            <select
              value={selectedExecName}
              onChange={(e) => setSelectedExecName(e.target.value)}
              className={selectStyle}
            >
              <option value="">All Assignments</option>
              <option value="assigned">Assigned (Any)</option>
              <option value="unassigned">Unassigned</option>
              <optgroup label="Specific Exec">
                {executives.map((exName) => (
                  <option key={exName} value={exName}>
                    {exName}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Sort By */}
          <div className="md:col-span-2">
            <label className={labelStyle}>Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={selectStyle}
            >
              <option value="latest_registered">Latest Registered</option>
              <option value="oldest_registered">Oldest Registered</option>
              <option value="latest_assigned">Latest Assigned</option>
              <option value="oldest_assigned">Oldest Assigned</option>
              <option value="name_asc">Name (A-Z)</option>
              <option value="name_desc">Name (Z-A)</option>
            </select>
          </div>
        </div>

        {/* Filter Summary Actions */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
            <span className="text-slate-500 font-medium">
              Showing {sortedSellers.length} of {initialSellers.length} sellers matching your filters
            </span>
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-brand-700 bg-brand-50 hover:bg-brand-100 font-semibold transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Main Table */}
      {sortedSellers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-350 bg-white p-12 text-center shadow-sm">
          <svg className="mx-auto h-8 w-8 text-slate-350 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-slate-500 font-medium">No sellers match your current filters.</p>
          <button
            onClick={resetFilters}
            className="mt-2 text-xs font-semibold text-brand-600 hover:underline"
          >
            Reset all filters
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200 select-none">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Seller</th>
                  <th className="px-4 py-3 text-left font-medium">Membership ID</th>
                  <th className="px-4 py-3 text-left font-medium">Brands</th>
                  <th className="px-4 py-3 text-left font-medium">Programs / Contracts</th>
                  <th className="px-4 py-3 text-left font-medium">Assigned Exec</th>
                  <th className="px-4 py-3 text-left font-medium">Assigned Date</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedSellers.map((s) => {
                  const hasAssignments = s.assignments.length > 0;
                  return (
                    <tr key={s.id} className={`hover:bg-slate-50 transition-colors ${s.status !== "active" ? "opacity-60" : ""}`}>
                      <td className="px-4 py-3.5 align-middle">
                        <div className="font-semibold text-slate-800 leading-tight">{s.name}</div>
                        <div className="font-mono text-[10px] text-slate-400 mt-0.5">{s.sellerCode}</div>
                      </td>
                      <td className="px-4 py-3.5 align-middle font-mono text-xs text-slate-600">
                        {s.membershipId ?? <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {s.sellerBrands.length === 0 ? (
                            <span className="text-slate-300 text-xs">—</span>
                          ) : (
                            s.sellerBrands.map((sb) => (
                              <span key={sb.brand.code} className="text-[10px] px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 font-semibold border border-brand-100">
                                {sb.brand.name}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                          {s.contracts.length === 0 ? (
                            <span className="text-slate-300 text-xs">—</span>
                          ) : (
                            s.contracts.map((c) => (
                              <span
                                key={c.id}
                                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                                  c.verified
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                    : "bg-amber-50 text-amber-700 border-amber-100"
                                }`}
                              >
                                {c.program.name} {c.verified ? "✓" : "⏳"}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 align-middle text-xs font-medium text-slate-600">
                        {!hasAssignments ? (
                          <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            Unassigned
                          </span>
                        ) : (
                          <div className="space-y-0.5">
                            {s.assignments.map((a) => (
                              <div key={a.id} className="font-semibold text-slate-700">
                                {a.exec?.fullName}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 align-middle text-xs font-medium text-slate-600">
                        {hasAssignments ? (
                          <div className="space-y-0.5 text-slate-600">
                            {s.assignments.map((a) => (
                              <div key={a.id} className="tabular-nums">
                                {formatDate(a.assignedAt)}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 shadow-sm animate-pulse">
                            <svg className="w-3.5 h-3.5 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                            {getTodayFormatted()} (For Review)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            s.status === "active"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                              : "bg-slate-100 text-slate-500 border border-slate-200"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              s.status === "active" ? "bg-emerald-500" : "bg-slate-300"
                            }`}
                          />
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/ops/sellers/${s.id}/edit`}
                            className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 font-semibold shadow-sm hover:border-brand-300 hover:text-brand-600 transition-colors"
                          >
                            Edit
                          </Link>
                          <Link
                            href={`/ops/sellers/${s.id}`}
                            className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 font-semibold shadow-sm hover:border-brand-300 hover:text-brand-600 transition-colors"
                          >
                            View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ClickableRow from "./ClickableRow";
import { formatDaysToYMD } from "@/lib/brandMeta";
import { formatDate } from "@/lib/format";

type SellerRow = {
  id: string;
  name: string;
  sellerCode: string;
  membershipId: string | null;
  status: string;
  createdAt: string;
  sellerBrands: { brand: { name: string; code: string } }[];
  contracts: { id: string; verified: boolean; fitoutPeriod: string | null; program: { name: string } }[];
  assignments: { exec: { fullName: string } }[];
  _count: { consignments: number; localRecords: number };
};

type SortField = "name" | "membershipId" | "status" | "createdAt" | "fitout";

export default function SellersTableClient({ rows }: { rows: SellerRow[] }) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Dropdown filter states
  const [selectedSeller, setSelectedSeller] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedProgram, setSelectedProgram] = useState("");
  const [selectedExec, setSelectedExec] = useState("");

  const sellersList = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.name) set.add(r.name);
    });
    return Array.from(set).sort();
  }, [rows]);

  const brandsList = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      r.sellerBrands.forEach((sb) => {
        if (sb.brand?.name) set.add(sb.brand.name);
      });
    });
    return Array.from(set).sort();
  }, [rows]);

  const programsList = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      r.contracts.forEach((c) => {
        if (c.program?.name) set.add(c.program.name);
      });
    });
    return Array.from(set).sort();
  }, [rows]);

  const execsList = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      r.assignments.forEach((a) => {
        if (a.exec?.fullName) set.add(a.exec.fullName);
      });
    });
    return Array.from(set).sort();
  }, [rows]);

  // Toggle sorting on a header
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Filter and sort rows
  const filteredAndSortedRows = useMemo(() => {
    let result = [...rows];

    // 1. Dropdown Filters
    if (selectedSeller) {
      result = result.filter((s) => s.name === selectedSeller);
    }
    if (selectedBrand) {
      result = result.filter((s) =>
        s.sellerBrands.some((sb) => sb.brand?.name === selectedBrand)
      );
    }
    if (selectedProgram) {
      result = result.filter((s) =>
        s.contracts.some((c) => c.program?.name === selectedProgram)
      );
    }
    if (selectedExec) {
      result = result.filter((s) =>
        s.assignments.some((a) => a.exec?.fullName === selectedExec)
      );
    }

    // 2. Search Query Filter
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter((s) => {
        const nameMatch = s.name.toLowerCase().includes(query);
        const codeMatch = s.sellerCode.toLowerCase().includes(query);
        const memIdMatch = (s.membershipId ?? "").toLowerCase().includes(query);
        const brandMatch = s.sellerBrands.some((sb) =>
          sb.brand.name.toLowerCase().includes(query)
        );
        const programMatch = s.contracts.some((c) =>
          c.program.name.toLowerCase().includes(query)
        );
        const execMatch = s.assignments.some((a) =>
          a.exec.fullName.toLowerCase().includes(query)
        );
        return nameMatch || codeMatch || memIdMatch || brandMatch || programMatch || execMatch;
      });
    }

    // 3. Sort
    result.sort((a, b) => {
      let valA: any = "";
      let valB: any = "";

      if (sortField === "name") {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (sortField === "membershipId") {
        valA = (a.membershipId ?? "").toLowerCase();
        valB = (b.membershipId ?? "").toLowerCase();
      } else if (sortField === "status") {
        valA = a.status.toLowerCase();
        valB = b.status.toLowerCase();
      } else if (sortField === "createdAt") {
        valA = new Date(a.createdAt).getTime();
        valB = new Date(b.createdAt).getTime();
      } else if (sortField === "fitout") {
        // Sort by the first contract's fitout period (numeric value if possible)
        const parseFitout = (item: SellerRow) => {
          const fitoutStr = item.contracts[0]?.fitoutPeriod ?? "";
          const num = parseInt(fitoutStr.replace(/\D/g, ""), 10);
          return isNaN(num) ? 0 : num;
        };
        valA = parseFitout(a);
        valB = parseFitout(b);
      }

      if (typeof valA === "string") {
        return sortOrder === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      } else {
        return sortOrder === "asc" ? valA - valB : valB - valA;
      }
    });

    return result;
  }, [rows, searchQuery, sortField, sortOrder, selectedSeller, selectedBrand, selectedProgram, selectedExec]);

  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <span className="text-slate-300 opacity-60 group-hover:opacity-100 transition-opacity ml-1 text-[10px]">
          ↕
        </span>
      );
    }
    return (
      <span className="text-brand-600 font-bold ml-1 text-xs">
        {sortOrder === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Search and Quick Filters bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-end gap-2 text-xs">
          <div className="flex flex-col gap-1 w-full sm:w-48 md:w-56 text-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Search</span>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, code, brand..."
                className="w-full rounded-lg border border-slate-200 py-1 pl-8 pr-6 font-medium text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder-slate-450 focus:bg-white transition-all text-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold p-0.5 text-[10px]"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <SearchableSelect
            label="Seller"
            value={selectedSeller}
            onChange={setSelectedSeller}
            options={sellersList}
            placeholder="All Sellers"
          />

          <SearchableSelect
            label="Program"
            value={selectedProgram}
            onChange={setSelectedProgram}
            options={programsList}
            placeholder="All Programs"
          />

          <SearchableSelect
            label="Brand"
            value={selectedBrand}
            onChange={setSelectedBrand}
            options={brandsList}
            placeholder="All Brands"
          />

          <SearchableSelect
            label="Assigned Exec"
            value={selectedExec}
            onChange={setSelectedExec}
            options={execsList}
            placeholder="All Executives"
          />

          {(selectedSeller || selectedBrand || selectedProgram || selectedExec || searchQuery) && (
            <button
              onClick={() => {
                setSelectedSeller("");
                setSelectedBrand("");
                setSelectedProgram("");
                setSelectedExec("");
                setSearchQuery("");
              }}
              className="pb-1.5 text-xs text-brand-600 hover:text-brand-800 font-semibold cursor-pointer underline"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* View Switcher and Count */}
        <div className="flex items-center gap-3 text-sm self-end md:self-center shrink-0">
          <div className="text-xs text-slate-400 font-semibold select-none">
            {filteredAndSortedRows.length} of {rows.length}
          </div>
          <div className="flex items-center gap-1 border border-slate-200 rounded-xl p-0.5 bg-slate-50 shadow-sm select-none">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "table"
                  ? "bg-white text-slate-800 shadow-sm border border-slate-100"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode("card")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "card"
                  ? "bg-white text-slate-800 shadow-sm border border-slate-100"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Cards
            </button>
          </div>
        </div>
      </div>

      {/* Main Table/Card view */}
      {filteredAndSortedRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-250 bg-white p-12 text-center text-slate-450 text-sm shadow-sm">
          No matching sellers found for the selected filters.
        </div>
      ) : viewMode === "table" ? (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th
                  onClick={() => handleSort("name")}
                  className="px-4 py-3 text-left font-semibold group cursor-pointer hover:bg-slate-100/70 transition-colors select-none"
                >
                  <div className="flex items-center">
                    Seller <SortIndicator field="name" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("membershipId")}
                  className="px-4 py-3 text-left font-semibold group cursor-pointer hover:bg-slate-100/70 transition-colors select-none"
                >
                  <div className="flex items-center">
                    Membership ID <SortIndicator field="membershipId" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("createdAt")}
                  className="px-4 py-3 text-left font-semibold group cursor-pointer hover:bg-slate-100/70 transition-colors select-none"
                >
                  <div className="flex items-center">
                    Date Created <SortIndicator field="createdAt" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left font-semibold">Brands</th>
                <th className="px-4 py-3 text-left font-semibold">Programs / Contracts</th>
                <th
                  onClick={() => handleSort("fitout")}
                  className="px-4 py-3 text-left font-semibold group cursor-pointer hover:bg-slate-100/70 transition-colors select-none"
                >
                  <div className="flex items-center">
                    Fitout Period ( In Days ) <SortIndicator field="fitout" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left font-semibold">Assigned Exec</th>
                <th
                  onClick={() => handleSort("status")}
                  className="px-4 py-3 text-left font-semibold group cursor-pointer hover:bg-slate-100/70 transition-colors select-none"
                >
                  <div className="flex items-center">
                    Status <SortIndicator field="status" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAndSortedRows.map((s) => (
                <ClickableRow
                  key={s.id}
                  href={`/ops/sellers/${s.id}`}
                  className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                    s.status !== "active" ? "opacity-60" : ""
                  }`}
                >
                  <td className="px-4 py-3 align-middle">
                    <div className="font-semibold text-slate-800">{s.name}</div>
                    <div className="font-mono text-[11px] text-slate-400">{s.sellerCode}</div>
                  </td>
                  <td className="px-4 py-3 align-middle font-mono text-xs text-slate-600">
                    {s.membershipId ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 align-middle text-xs text-slate-600 font-medium">
                    {formatDate(s.createdAt)}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex flex-wrap gap-1">
                      {s.sellerBrands.length === 0 ? (
                        <span className="text-slate-300 text-xs">—</span>
                      ) : (
                        s.sellerBrands.map((sb) => (
                          <span
                            key={sb.brand.code}
                            className="text-[11px] px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 font-medium"
                          >
                            {sb.brand.name}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex flex-wrap gap-1">
                      {s.contracts.length === 0 ? (
                        <span className="text-slate-300 text-xs">—</span>
                      ) : (
                        s.contracts.map((c) => (
                          <span
                            key={c.id}
                            className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                              c.verified
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {c.program.name} {c.verified ? "✓" : "⏳"}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex flex-wrap gap-1">
                      {s.contracts.length === 0 ? (
                        <span className="text-slate-300 text-xs">—</span>
                      ) : (
                        s.contracts.map((c) => {
                          const rawDays = c.fitoutPeriod ? c.fitoutPeriod.replace(/\D/g, "") : "";
                          const ymd = formatDaysToYMD(c.fitoutPeriod);
                          return (
                            <span
                              key={c.id}
                              className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium border border-slate-200"
                            >
                              {c.program.name}: {rawDays ? `${rawDays} Days` : <span className="text-slate-400">N/A</span>}
                              {ymd && ` (${ymd})`}
                            </span>
                          );
                        })
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle text-xs text-slate-600">
                    {s.assignments.length === 0 ? (
                      <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                        Unassigned
                      </span>
                    ) : (
                      s.assignments.map((a) => a.exec.fullName).join(", ")
                    )}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        s.status === "active"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
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
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/ops/sellers/${s.id}/edit`}
                        className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 text-slate-655 hover:border-brand-300 hover:text-brand-600 transition-colors bg-white shadow-sm"
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/ops/sellers/${s.id}`}
                        className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 text-slate-655 hover:border-brand-300 hover:text-brand-600 transition-colors bg-white shadow-sm"
                      >
                        View
                      </Link>
                    </div>
                  </td>
                </ClickableRow>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAndSortedRows.map((s) => (
            <div
              key={s.id}
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest("a") || target.closest("button")) return;
                router.push(`/ops/sellers/${s.id}`);
              }}
              className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow hover:border-slate-350 transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                s.status !== "active" ? "opacity-60" : ""
              }`}
            >
              <div className="space-y-3">
                {/* Header: Name, Code, and Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-800 text-sm leading-snug hover:text-brand-600 transition-colors truncate">
                      {s.name}
                    </div>
                    <div className="font-mono text-[9px] text-slate-400 mt-0.5 uppercase tracking-wider truncate">
                      {s.sellerCode}
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold shrink-0 uppercase tracking-wider ${
                      s.status === "active"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                        : "bg-slate-100 text-slate-500 border border-slate-200"
                    }`}
                  >
                    {s.status}
                  </span>
                </div>

                {/* Membership ID & Date Created */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100/60 text-xs">
                  <div className="min-w-0">
                    <div className="text-slate-400 font-semibold uppercase tracking-wider text-[9px]">Membership ID</div>
                    <div className="font-mono text-slate-700 mt-0.5 truncate text-[11px]">
                      {s.membershipId ?? <span className="text-slate-300">—</span>}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-slate-400 font-semibold uppercase tracking-wider text-[9px]">Date Created</div>
                    <div className="text-slate-700 mt-0.5 truncate text-[11px]">
                      {formatDate(s.createdAt)}
                    </div>
                  </div>
                </div>

                {/* Fitout Period ( In Days ) */}
                <div className="pt-2 border-t border-slate-100/60 text-xs">
                  <div className="min-w-0">
                    <div className="text-slate-400 font-semibold uppercase tracking-wider text-[9px]">Fitout Period ( In Days )</div>
                    <div className="font-medium text-slate-700 mt-0.5 text-[11px]">
                      {s.contracts.map((c) => {
                        const rawDays = c.fitoutPeriod ? c.fitoutPeriod.replace(/\D/g, "") : "";
                        const ymd = formatDaysToYMD(c.fitoutPeriod);
                        return `${c.program.name}: ${rawDays ? `${rawDays} Days` : "N/A"}${ymd ? ` (${ymd})` : ""}`;
                      }).join(", ") || <span className="text-slate-300">—</span>}
                    </div>
                  </div>
                </div>

                {/* Brands Mapped */}
                <div>
                  <div className="text-slate-400 font-semibold uppercase tracking-wider text-[9px] mb-1.5">Authorized Brands</div>
                  <div className="flex flex-wrap gap-1">
                    {s.sellerBrands.length === 0 ? (
                      <span className="text-slate-300 text-xs">—</span>
                    ) : (
                      s.sellerBrands.map((sb) => (
                        <span
                          key={sb.brand.code}
                          className="text-[9px] px-2 py-0.5 rounded-full bg-brand-50 border border-brand-100 text-brand-700 font-medium"
                        >
                          {sb.brand.name}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Programs / Contracts */}
                <div>
                  <div className="text-slate-400 font-semibold uppercase tracking-wider text-[9px] mb-1.5">Active Programs</div>
                  <div className="flex flex-wrap gap-1">
                    {s.contracts.length === 0 ? (
                      <span className="text-slate-300 text-xs">—</span>
                    ) : (
                      s.contracts.map((c) => (
                        <span
                          key={c.id}
                          className={`text-[9px] px-2 py-0.5 rounded-full font-medium border ${
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
                </div>

                {/* Assigned Exec */}
                <div className="pt-2 border-t border-slate-100/60 flex items-center justify-between text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="text-slate-400 font-semibold uppercase tracking-wider text-[9px]">Assigned Exec</div>
                    <div className="text-slate-700 font-medium mt-0.5 flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-brand-400 inline-block shrink-0" />
                      <span className="truncate text-[11px]">
                        {s.assignments.length === 0 ? (
                          <span className="text-amber-600 font-medium">Unassigned</span>
                        ) : (
                          s.assignments.map((a) => a.exec.fullName).join(", ")
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions footer */}
              <div className="pt-2 border-t border-slate-100/60 flex items-center justify-end gap-1.5">
                <Link
                  href={`/ops/sellers/${s.id}/edit`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[11px] px-2.5 py-1 rounded-lg border border-slate-200 text-slate-655 hover:border-brand-300 hover:text-brand-600 transition-colors bg-white shadow-sm font-semibold"
                >
                  Edit
                </Link>
                <Link
                  href={`/ops/sellers/${s.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[11px] px-2.5 py-1 rounded-lg border border-slate-200 text-slate-655 hover:border-brand-300 hover:text-brand-600 transition-colors bg-white shadow-sm font-semibold"
                >
                  View
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchableSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredOptions = useMemo(() => {
    return options.filter((opt) => opt.toLowerCase().includes(search.toLowerCase()));
  }, [options, search]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(`.searchable-select-${label.replace(/\s+/g, "-")}`)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [open, label]);

  return (
    <div className={`relative flex flex-col gap-1 searchable-select-${label.replace(/\s+/g, "-")} w-[115px] text-xs`}>
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      <div className="relative">
        <input
          type="text"
          value={open ? search : value}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setSearch("");
          }}
          placeholder={value || placeholder}
          className="w-full rounded-lg border border-slate-200 py-1 pl-2 pr-5 font-medium text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder-slate-500 focus:bg-white transition-all cursor-text text-xs text-ellipsis overflow-hidden"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-slate-400">
          {value ? (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setSearch("");
                setOpen(false);
              }}
              className="hover:text-slate-600 font-bold p-0.5 text-[10px]"
            >
              ✕
            </button>
          ) : (
            <svg
              className="w-3 h-3 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto z-45 divide-y divide-slate-50">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-slate-400 italic">No matches found</div>
          ) : (
            filteredOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setSearch("");
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors font-medium text-slate-700 ${
                  value === opt ? "bg-brand-50/50 text-brand-700 font-bold" : ""
                }`}
              >
                {opt}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

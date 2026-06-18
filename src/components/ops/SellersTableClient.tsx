"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import ClickableRow from "./ClickableRow";
import IconButton from "@/components/ui/IconButton";
import { formatDaysToYMD } from "@/lib/brandMeta";
import { formatDate } from "@/lib/format";
import { onboardingStatusMeta } from "@/lib/onboardingMeta";

type SellerRow = {
  id: string;
  name: string;
  sellerCode: string;
  membershipId: string | null;
  status: string;
  createdAt: string;
  sellerBrands: { brand: { name: string; code: string } }[];
  contracts: { id: string; verified: boolean; fitoutPeriod: string | null; program: { name: string } }[];
  assignments: { id: string; onboardingStatus: string; exec: { fullName: string }; program: { id: string; name: string } | null }[];
  _count: { consignments: number; localRecords: number };
};

type SortField = "name" | "membershipId" | "status" | "createdAt" | "fitout";

export default function SellersTableClient({ rows, newSellerHref }: { rows: SellerRow[]; newSellerHref?: string }) {
  const router = useRouter();
  // Removed view mode toggle; always render table view
  const viewMode = "table";
  const [viewBy, setViewBy] = useState<"seller" | "program">("seller");
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

  // Sort indicators removed for a clean header — columns still sort on click.
  const SortIndicator = (_props: { field: SortField }) => null;

  return (
    <div className="space-y-4">
      {/* Search and Quick Filters bar */}
      <div className="relative z-20 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="relative w-full sm:w-48 md:w-56">
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
              className="w-full rounded-xl border border-slate-200 py-1.5 pl-8 pr-6 font-medium text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder-slate-400 focus:bg-white transition-all text-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 font-bold p-0.5 text-[10px]"
              >
                ✕
              </button>
            )}
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
              className="text-xs text-brand-600 hover:text-brand-800 font-semibold cursor-pointer underline hover:no-underline px-1.5 transition-all"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Count */}
        <div className="flex items-center gap-3 text-sm self-end md:self-center shrink-0">
          <div className="text-xs text-slate-400 font-semibold select-none">
            {filteredAndSortedRows.length} of {rows.length}
          </div>
        </div>
      </div>

      {/* Seller-wise / Program-wise toggle + New Seller */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex w-fit items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
          {([["seller", "Seller-wise"], ["program", "Program-wise"]] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setViewBy(key)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                viewBy === key ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {newSellerHref && (
          <button
            type="button"
            onClick={() => router.push(newSellerHref)}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
          >
            + New Seller
          </button>
        )}
      </div>

      {/* Main view */}
      {filteredAndSortedRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-250 bg-white p-12 text-center text-slate-450 text-sm shadow-sm">
          No matching sellers found for the selected filters.
        </div>
      ) : viewBy === "program" ? (
        <ProgramView rows={filteredAndSortedRows} onOpen={(id) => router.push(`/ops/sellers/${id}`)} />
      ) : viewMode === "table" ? (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th
                  onClick={() => handleSort("name")}
                  className="px-4 py-3 text-left group cursor-pointer hover:bg-slate-100/70 transition-colors select-none whitespace-nowrap w-[16%]"
                >
                  Seller <SortIndicator field="name" />
                </th>
                <th
                  onClick={() => handleSort("membershipId")}
                  className="px-4 py-3 text-left group cursor-pointer hover:bg-slate-100/70 transition-colors select-none whitespace-nowrap w-[12%]"
                >
                  Membership ID <SortIndicator field="membershipId" />
                </th>
                <th
                  onClick={() => handleSort("createdAt")}
                  className="px-4 py-3 text-left group cursor-pointer hover:bg-slate-100/70 transition-colors select-none whitespace-nowrap w-[11%]"
                >
                  Date Created <SortIndicator field="createdAt" />
                </th>
                <th className="px-4 py-3 text-left whitespace-nowrap w-[13%]">Brands</th>
                <th className="px-4 py-3 text-left whitespace-nowrap w-[15%]">Programs</th>
                <th className="px-4 py-3 text-left whitespace-nowrap w-[12%]">Assigned Exec</th>
                <th
                  onClick={() => handleSort("status")}
                  className="px-4 py-3 text-left group cursor-pointer hover:bg-slate-100/70 transition-colors select-none whitespace-nowrap w-[8%]"
                >
                  Status <SortIndicator field="status" />
                </th>
                <th className="px-3 py-3 text-right whitespace-nowrap w-[12%]">Actions</th>
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
                    <div className="font-semibold text-slate-800 truncate">{s.name}</div>
                    <div className="font-mono text-[11px] text-slate-400 truncate">{s.sellerCode}</div>
                  </td>
                  <td className="px-4 py-3 align-middle font-mono text-xs text-slate-600">
                    {s.membershipId ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 align-middle text-xs text-slate-600 font-medium">
                    {formatDate(s.createdAt)}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    {s.sellerBrands.length === 0 ? (
                      <span className="text-slate-300 text-xs">—</span>
                    ) : (
                      <div className="flex flex-col gap-0.5 text-xs text-slate-600">
                        {s.sellerBrands.map((sb) => <span key={sb.brand.code} className="truncate">{sb.brand.name}</span>)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    {s.contracts.length === 0 ? (
                      <span className="text-slate-300 text-xs">—</span>
                    ) : (
                      <div className="flex flex-col gap-0.5 text-xs">
                        {s.contracts.map((c) => (
                          <span key={c.id} className={c.verified ? "text-emerald-600" : "text-amber-600"}>
                            {c.program.name}{c.verified ? " ✓" : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-middle text-xs">
                    {s.assignments.length === 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-amber-600 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                        Unassigned
                      </span>
                    ) : (
                      <span className="text-slate-600">{s.assignments.map((a) => a.exec.fullName).join(", ")}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-white ${
                        s.status === "active" ? "bg-emerald-600" : "bg-slate-500"
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      <span className="capitalize">{s.status}</span>
                    </span>
                  </td>
                  <td className="px-3 py-3 align-middle text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <IconButton kind="edit" title="Edit" tone="primary" onClick={() => router.push(`/ops/sellers/${s.id}/edit`)} />
                      <IconButton kind="view" title="View" onClick={() => router.push(`/ops/sellers/${s.id}`)} />
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
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[9px] font-bold shrink-0 uppercase tracking-wider border shadow-sm ${
                      s.status === "active"
                        ? "bg-emerald-50/70 text-emerald-700 border-emerald-100"
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
                        return `${c.program.name}: ${rawDays ? `${rawDays} Days` : "N/A"}`;
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
                          className="text-[9px] px-2 py-0.5 rounded-md bg-brand-50/70 border border-brand-100 text-brand-700 font-medium shadow-sm"
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
                          className={`text-[9px] px-2 py-0.5 rounded-md font-medium border shadow-sm ${
                            c.verified
                              ? "bg-emerald-50/70 text-emerald-700 border-emerald-100"
                              : "bg-amber-50/70 text-amber-700 border-amber-100"
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
              <div className="pt-2 border-t border-slate-100/60 flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                <IconButton kind="edit" title="Edit" tone="primary" onClick={() => router.push(`/ops/sellers/${s.id}/edit`)} />
                <IconButton kind="view" title="View" onClick={() => router.push(`/ops/sellers/${s.id}`)} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Program-wise view: one flat table with a Program column, carrying the same
// seller details as the seller-wise table (Membership ID, Date Created, Brands,
// Assigned Exec, Status) plus the Onboarding status.
type ProgramItem = {
  program: string;
  sellerId: string;
  sellerName: string;
  sellerCode: string;
  membershipId: string | null;
  createdAt: string;
  brands: string[];
  exec: string;
  sellerStatus: string;
  onboardingStatus: string;
};

function ProgramView({ rows, onOpen }: { rows: SellerRow[]; onOpen: (id: string) => void }) {
  const items: ProgramItem[] = [];
  for (const s of rows) {
    const base = {
      sellerId: s.id,
      sellerName: s.name,
      sellerCode: s.sellerCode,
      membershipId: s.membershipId,
      createdAt: s.createdAt,
      brands: s.sellerBrands.map((sb) => sb.brand.name),
      sellerStatus: s.status,
    };
    if (s.assignments.length === 0) {
      items.push({ ...base, program: "—", exec: "—", onboardingStatus: "" });
      continue;
    }
    for (const a of s.assignments) {
      items.push({
        ...base,
        program: a.program?.name ?? "No program",
        exec: a.exec.fullName,
        onboardingStatus: a.onboardingStatus,
      });
    }
  }
  items.sort((a, b) => a.program.localeCompare(b.program) || a.sellerName.localeCompare(b.sellerName));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-md overflow-hidden shadow-sm">
      <table className="w-full table-fixed text-sm">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
          <tr>
            <th className="px-4 py-3 text-left whitespace-nowrap w-[16%]">Program</th>
            <th className="px-4 py-3 text-left whitespace-nowrap w-[18%]">Seller</th>
            <th className="px-4 py-3 text-left whitespace-nowrap w-[13%]">Membership ID</th>
            <th className="px-4 py-3 text-left whitespace-nowrap w-[12%]">Date Created</th>
            <th className="px-4 py-3 text-left whitespace-nowrap w-[14%]">Brands</th>
            <th className="px-4 py-3 text-left whitespace-nowrap w-[14%]">Assigned Exec</th>
            <th className="px-4 py-3 text-right whitespace-nowrap w-[13%]">Onboarding</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((it, i) => (
            <tr
              key={`${it.sellerId}-${i}`}
              onClick={() => onOpen(it.sellerId)}
              className={`cursor-pointer hover:bg-slate-50 transition-colors ${it.sellerStatus !== "active" ? "opacity-60" : ""}`}
            >
              <td className="px-4 py-3 align-middle">
                <span className="font-semibold text-slate-800">{it.program}</span>
              </td>
              <td className="px-4 py-3 align-middle">
                <div className="font-semibold text-slate-800 truncate">{it.sellerName}</div>
                <div className="font-mono text-[11px] text-slate-400 truncate">{it.sellerCode}</div>
              </td>
              <td className="px-4 py-3 align-middle font-mono text-xs text-slate-600">
                {it.membershipId ?? <span className="text-slate-300">—</span>}
              </td>
              <td className="px-4 py-3 align-middle text-xs text-slate-600 font-medium">
                {formatDate(it.createdAt)}
              </td>
              <td className="px-4 py-3 align-middle">
                {it.brands.length === 0 ? (
                  <span className="text-slate-300 text-xs">—</span>
                ) : (
                  <div className="flex flex-col gap-0.5 text-xs text-slate-600">
                    {it.brands.map((b, bi) => <span key={`${b}-${bi}`} className="truncate">{b}</span>)}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 align-middle">
                {it.exec === "—" ? (
                  <span className="text-slate-300 text-xs">—</span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600 shrink-0">
                      {it.exec.trim().slice(0, 2).toUpperCase()}
                    </span>
                    <span className="text-xs text-slate-700 truncate">{it.exec}</span>
                  </span>
                )}
              </td>
              <td className="px-4 py-3 align-middle text-right">
                {it.onboardingStatus ? (
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${onboardingStatusMeta(it.onboardingStatus).badge}`}>
                    {onboardingStatusMeta(it.onboardingStatus).label}
                  </span>
                ) : (
                  <span className="text-slate-300 text-xs">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredOptions = useMemo(() => {
    return options.filter((opt) => opt.toLowerCase().includes(search.toLowerCase()));
  }, [options, search]);

  // Close when clicking outside or pressing Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all shadow-sm select-none cursor-pointer ${
          value
            ? "border-brand-200 bg-brand-50/50 text-brand-700 hover:bg-brand-50"
            : "border-slate-200 bg-white text-slate-600 hover:border-slate-350 hover:text-slate-800"
        }`}
      >
        <span className="truncate max-w-[120px]">
          {label}: {value || "All"}
        </span>
        <svg
          className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 mt-1 w-60 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 space-y-2">
          {/* Dropdown Search input */}
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${label}...`}
              autoFocus
              className="w-full rounded-lg border border-slate-200 py-1 pl-7 pr-6 text-xs text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder-slate-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold p-0.5 text-[9px]"
              >
                ✕
              </button>
            )}
          </div>

          {/* Options list */}
          <div className="max-h-48 overflow-y-auto divide-y divide-slate-50">
            {/* Show "All" reset option first */}
            <button
              type="button"
              onClick={() => {
                onChange("");
                setSearch("");
                setOpen(false);
              }}
              className={`w-full text-left px-2 py-1.5 hover:bg-slate-50 transition-colors font-semibold text-xs rounded-md ${
                !value ? "bg-brand-50 text-brand-700" : "text-slate-500"
              }`}
            >
              All {label}s
            </button>

            {filteredOptions.length === 0 ? (
              <div className="px-2 py-2 text-slate-400 text-xs italic">No matches found</div>
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
                  className={`w-full text-left px-2 py-1.5 hover:bg-slate-50 transition-colors text-xs rounded-md mt-0.5 ${
                    value === opt
                      ? "bg-brand-50 text-brand-700 font-bold"
                      : "text-slate-600 font-medium"
                  }`}
                >
                  {opt}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

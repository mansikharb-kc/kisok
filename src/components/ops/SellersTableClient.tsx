"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ClickableRow from "./ClickableRow";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

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

    // 1. Filter
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

    // 2. Sort
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
  }, [rows, searchQuery, sortField, sortOrder]);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 max-w-lg">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sellers by name, code, brand, or executive..."
            className="w-full rounded-xl border border-slate-250 py-2 pl-9 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white placeholder-slate-400 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Quick Sorting Dropdown Selector */}
        <div className="flex items-center gap-3 self-end sm:self-auto text-sm">
          <div className="text-xs text-slate-400 font-semibold tracking-wider uppercase">Sort By</div>
          <select
            value={`${sortField}-${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split("-") as [SortField, "asc" | "desc"];
              setSortField(field);
              setSortOrder(order);
            }}
            className="rounded-xl border border-slate-250 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer shadow-sm"
          >
            <option value="name-asc">Seller Name (A-Z)</option>
            <option value="name-desc">Seller Name (Z-A)</option>
            <option value="membershipId-asc">Membership ID (Asc)</option>
            <option value="membershipId-desc">Membership ID (Desc)</option>
            <option value="status-asc">Status (Active first)</option>
            <option value="status-desc">Status (Retired first)</option>
            <option value="createdAt-desc">Newest Added</option>
            <option value="createdAt-asc">Oldest Added</option>
            <option value="fitout-desc">Fitout Period (Longest)</option>
            <option value="fitout-asc">Fitout Period (Shortest)</option>
          </select>
          <div className="text-xs text-slate-400 font-semibold select-none border-l border-slate-200 pl-3">
            {filteredAndSortedRows.length} of {rows.length}
          </div>
        </div>
      </div>

      {/* Main Table view */}
      {filteredAndSortedRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-250 bg-white p-12 text-center text-slate-450 text-sm shadow-sm">
          No matching sellers found for &ldquo;{searchQuery}&rdquo;.
        </div>
      ) : (
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
                <th className="px-4 py-3 text-left font-semibold">Brands</th>
                <th className="px-4 py-3 text-left font-semibold">Programs / Contracts</th>
                <th
                  onClick={() => handleSort("fitout")}
                  className="px-4 py-3 text-left font-semibold group cursor-pointer hover:bg-slate-100/70 transition-colors select-none"
                >
                  <div className="flex items-center">
                    Fitout Period <SortIndicator field="fitout" />
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
                        s.contracts.map((c) => (
                          <span
                            key={c.id}
                            className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium border border-slate-200"
                          >
                            {c.program.name}: {c.fitoutPeriod || <span className="text-slate-400">N/A</span>}
                          </span>
                        ))
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
      )}
    </div>
  );
}

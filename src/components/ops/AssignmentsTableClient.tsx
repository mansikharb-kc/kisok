"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import RemoveAssignmentButton from "./RemoveAssignmentButton";
import { formatDate } from "@/lib/format";

interface SellerBrand {
  brand: {
    name: string;
    code: string;
  };
}

interface Seller {
  name: string;
  sellerCode: string;
  membershipId: string | null;
  status: string;
  sellerBrands: SellerBrand[];
}

interface Program {
  name: string;
  code: string;
}

interface Exec {
  id: string;
  fullName: string;
  email: string;
}

interface AssignmentRow {
  id: string;
  assignedAt: string;
  seller: Seller;
  program: Program | null;
  exec: Exec;
}

interface AssignmentsTableClientProps {
  initialRows: AssignmentRow[];
}

type SortField = "exec" | "seller" | "program" | "assignedAt";
type SortOrder = "asc" | "desc";

export default function AssignmentsTableClient({ initialRows }: AssignmentsTableClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExecId, setSelectedExecId] = useState("");
  const [selectedProgramCode, setSelectedProgramCode] = useState("");
  const [selectedBrandCode, setSelectedBrandCode] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  const [sortField, setSortField] = useState<SortField>("assignedAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Options for filters
  const execs = useMemo(() => {
    const map = new Map<string, string>();
    initialRows.forEach((r) => {
      map.set(r.exec.id, r.exec.fullName);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [initialRows]);

  const programs = useMemo(() => {
    const map = new Map<string, string>();
    initialRows.forEach((r) => {
      if (r.program) {
        map.set(r.program.code, r.program.name);
      }
    });
    return Array.from(map.entries()).map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [initialRows]);

  const brands = useMemo(() => {
    const map = new Map<string, string>();
    initialRows.forEach((r) => {
      r.seller.sellerBrands.forEach((sb) => {
        map.set(sb.brand.code, sb.brand.name);
      });
    });
    return Array.from(map.entries()).map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [initialRows]);

  const statuses = useMemo(() => {
    const set = new Set<string>();
    initialRows.forEach((r) => {
      set.add(r.seller.status);
    });
    return Array.from(set).sort();
  }, [initialRows]);

  // Handle sorting toggles
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Filter and sort the assignments
  const filteredAndSortedRows = useMemo(() => {
    let result = [...initialRows];

    // Search query filter
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter((r) => {
        const execMatch = r.exec.fullName.toLowerCase().includes(query) || r.exec.email.toLowerCase().includes(query);
        const sellerMatch = r.seller.name.toLowerCase().includes(query) || r.seller.sellerCode.toLowerCase().includes(query) || (r.seller.membershipId || "").toLowerCase().includes(query);
        const programMatch = r.program ? r.program.name.toLowerCase().includes(query) || r.program.code.toLowerCase().includes(query) : false;
        const brandMatch = r.seller.sellerBrands.some((sb) => sb.brand.name.toLowerCase().includes(query) || sb.brand.code.toLowerCase().includes(query));
        return execMatch || sellerMatch || programMatch || brandMatch;
      });
    }

    // Filter dropdowns
    if (selectedExecId) {
      result = result.filter((r) => r.exec.id === selectedExecId);
    }
    if (selectedProgramCode) {
      result = result.filter((r) => r.program?.code === selectedProgramCode);
    }
    if (selectedBrandCode) {
      result = result.filter((r) => r.seller.sellerBrands.some((sb) => sb.brand.code === selectedBrandCode));
    }
    if (selectedStatus) {
      result = result.filter((r) => r.seller.status === selectedStatus);
    }

    // Sort
    result.sort((a, b) => {
      let valA: any = "";
      let valB: any = "";

      if (sortField === "exec") {
        valA = a.exec.fullName.toLowerCase();
        valB = b.exec.fullName.toLowerCase();
      } else if (sortField === "seller") {
        valA = a.seller.name.toLowerCase();
        valB = b.seller.name.toLowerCase();
      } else if (sortField === "program") {
        valA = (a.program?.name || "").toLowerCase();
        valB = (b.program?.name || "").toLowerCase();
      } else if (sortField === "assignedAt") {
        valA = new Date(a.assignedAt).getTime();
        valB = new Date(b.assignedAt).getTime();
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [initialRows, searchQuery, selectedExecId, selectedProgramCode, selectedBrandCode, selectedStatus, sortField, sortOrder]);

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="bg-white/60 backdrop-blur-md rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col gap-3 md:flex-row md:items-center">
        {/* Search Input */}
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="search"
            placeholder="Search assignments (exec, seller, brand, program)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white/80 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 placeholder-slate-400 transition-all text-slate-900"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Executive Filter */}
          <select
            value={selectedExecId}
            onChange={(e) => setSelectedExecId(e.target.value)}
            className="text-xs px-3 py-2 bg-white/80 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-700 font-medium"
          >
            <option value="">All Executives</option>
            {execs.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>

          {/* Program Filter */}
          <select
            value={selectedProgramCode}
            onChange={(e) => setSelectedProgramCode(e.target.value)}
            className="text-xs px-3 py-2 bg-white/80 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-700 font-medium"
          >
            <option value="">All Programs</option>
            {programs.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Brand Filter */}
          <select
            value={selectedBrandCode}
            onChange={(e) => setSelectedBrandCode(e.target.value)}
            className="text-xs px-3 py-2 bg-white/80 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-700 font-medium"
          >
            <option value="">All Brands</option>
            {brands.map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs px-3 py-2 bg-white/80 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-700 font-medium"
          >
            <option value="">All Statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white/60 backdrop-blur-md rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredAndSortedRows.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-slate-400">No matching assignments found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 text-[10px] font-semibold uppercase tracking-wider select-none">
                  <th className="px-5 py-3 cursor-pointer hover:bg-slate-100/80 transition-colors" onClick={() => handleSort("exec")}>
                    <div className="flex items-center gap-1.5">
                      Assigned Executive
                      {sortField === "exec" && (sortOrder === "asc" ? "▲" : "▼")}
                    </div>
                  </th>
                  <th className="px-5 py-3 cursor-pointer hover:bg-slate-100/80 transition-colors" onClick={() => handleSort("seller")}>
                    <div className="flex items-center gap-1.5">
                      Seller Details
                      {sortField === "seller" && (sortOrder === "asc" ? "▲" : "▼")}
                    </div>
                  </th>
                  <th className="px-5 py-3 cursor-pointer hover:bg-slate-100/80 transition-colors" onClick={() => handleSort("program")}>
                    <div className="flex items-center gap-1.5">
                      Program
                      {sortField === "program" && (sortOrder === "asc" ? "▲" : "▼")}
                    </div>
                  </th>
                  <th className="px-5 py-3">Associated Brands</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 cursor-pointer hover:bg-slate-100/80 transition-colors" onClick={() => handleSort("assignedAt")}>
                    <div className="flex items-center gap-1.5">
                      Assigned Date
                      {sortField === "assignedAt" && (sortOrder === "asc" ? "▲" : "▼")}
                    </div>
                  </th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredAndSortedRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Executive */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold shrink-0 select-none">
                          {row.exec.fullName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800">{row.exec.fullName}</div>
                          <div className="text-[11px] text-slate-400">{row.exec.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Seller */}
                    <td className="px-5 py-3.5">
                      <div>
                        <div className="font-semibold text-slate-800">{row.seller.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {row.seller.sellerCode}
                          {row.seller.membershipId ? ` · ${row.seller.membershipId}` : ""}
                        </div>
                      </div>
                    </td>

                    {/* Program */}
                    <td className="px-5 py-3.5">
                      {row.program ? (
                        <div className="font-medium text-slate-700">
                          {row.program.name}
                          <div className="text-[10px] text-slate-400 font-mono">{row.program.code}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Brands */}
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {row.seller.sellerBrands.map((sb) => (
                          <span
                            key={sb.brand.code}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 font-semibold border border-brand-200/50 shadow-sm"
                          >
                            {sb.brand.name}
                          </span>
                        ))}
                        {row.seller.sellerBrands.length === 0 && (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${
                          row.seller.status === "active"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-100 text-slate-500 border border-slate-200"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            row.seller.status === "active" ? "bg-emerald-500" : "bg-slate-300"
                          }`}
                        />
                        {row.seller.status}
                      </span>
                    </td>

                    {/* Assigned Date */}
                    <td className="px-5 py-3.5 text-slate-500 text-xs">
                      {formatDate(row.assignedAt)}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right">
                      <RemoveAssignmentButton id={row.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

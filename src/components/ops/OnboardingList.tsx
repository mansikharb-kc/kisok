"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TICKET_TYPES } from "@/lib/ticketMeta";

type OnboardingRecord = {
  id: string;
  sellerId: string;
  status: string;
  createdAt: string;
  product: {
    name: string;
    sku: string;
    brand: { id: string; name: string; code: string };
    category: { name: string; code: string };
  };
  seller: { name: string; sellerCode: string };
  program: { name: string; code: string };
  tickets?: {
    id: string;
    ticketNo: string | null;
    type: string;
    status: string;
  }[];
};

export default function OnboardingList({
  records,
  isExec = false,
}: {
  records: OnboardingRecord[];
  isExec?: boolean;
}) {
  const router = useRouter();
  const [raisingForRecord, setRaisingForRecord] = useState<OnboardingRecord | null>(null);
  const [ticketType, setTicketType] = useState("SAMPLE_REQUEST");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [viewMode, setViewMode] = useState<"table" | "card">("table");

  // Filtering states
  const [selectedSeller, setSelectedSeller] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedProgram, setSelectedProgram] = useState("");

  // Unique lists computed from all records
  const sellersList = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.seller?.name) set.add(r.seller.name);
    });
    return Array.from(set).sort();
  }, [records]);

  const brandsList = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.product?.brand?.name) set.add(r.product.brand.name);
    });
    return Array.from(set).sort();
  }, [records]);

  const programsList = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.program?.name) set.add(r.program.name);
    });
    return Array.from(set).sort();
  }, [records]);

  // Filtered records list
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const sellerMatch = !selectedSeller || r.seller?.name === selectedSeller;
      const brandMatch = !selectedBrand || r.product?.brand?.name === selectedBrand;
      const programMatch = !selectedProgram || r.program?.name === selectedProgram;
      return sellerMatch && brandMatch && programMatch;
    });
  }, [records, selectedSeller, selectedBrand, selectedProgram]);

  async function handleRaiseTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!raisingForRecord) return;
    setError("");
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: ticketType,
          sellerId: raisingForRecord.sellerId,
          brandId: raisingForRecord.product.brand.id || null,
          localRecordId: raisingForRecord.id,
          title: title.trim(),
          description: description.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to raise ticket");
        return;
      }
      setRaisingForRecord(null);
      setTitle("");
      setDescription("");
      router.refresh();
    } catch (err) {
      setError("A network error occurred. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (records.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white/60 backdrop-blur-md p-12 text-center">
        <p className="text-sm text-slate-400">
          No products onboarded yet for your assigned sellers.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="relative z-20 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/60 backdrop-blur-md p-4 rounded-xl border border-slate-200 shadow-sm">
        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <SearchableSelect
            label="Seller"
            value={selectedSeller}
            onChange={setSelectedSeller}
            options={sellersList}
            placeholder="All Sellers"
          />

          <SearchableSelect
            label="Brand"
            value={selectedBrand}
            onChange={setSelectedBrand}
            options={brandsList}
            placeholder="All Brands"
          />

          <SearchableSelect
            label="Program"
            value={selectedProgram}
            onChange={setSelectedProgram}
            options={programsList}
            placeholder="All Programs"
          />

          {(selectedSeller || selectedBrand || selectedProgram) && (
            <button
              onClick={() => {
                setSelectedSeller("");
                setSelectedBrand("");
                setSelectedProgram("");
              }}
              className="text-xs text-brand-600 hover:text-brand-800 font-semibold cursor-pointer underline hover:no-underline px-1.5 transition-all"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* View Mode Toggle Group */}
        <div className="flex items-center gap-1 border border-slate-200 rounded-xl p-0.5 bg-slate-50 shadow-sm select-none self-end md:self-center">
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

      {filteredRecords.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white/60 backdrop-blur-md p-12 text-center text-sm text-slate-400">
          No onboarded products found matching the selected filters.
        </div>
      ) : viewMode === "table" ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3">Brand &amp; Category</th>
                <th className="px-5 py-3">Seller &amp; Program</th>
                <th className="px-5 py-3">Tickets</th>
                <th className="px-5 py-3">Status</th>
                {isExec && <th className="px-5 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {filteredRecords.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-slate-50/50">
                  <td className="px-5 py-4 align-top">
                    <div className="font-semibold text-slate-800">{r.product.name}</div>
                    <div className="mt-0.5 font-mono text-xs text-slate-500">SKU: {r.product.sku}</div>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <div className="text-xs font-medium text-slate-800">{r.product.brand.name}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">{r.product.category.name}</div>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <div className="text-xs font-semibold text-slate-700">{r.seller.name}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-slate-500">{r.seller.sellerCode}</div>
                    <div className="mt-1 inline-flex rounded border border-brand-100 bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700">
                      {r.program.name}
                    </div>
                  </td>
                  <td className="px-5 py-4 align-top">
                    {r.tickets && r.tickets.length > 0 ? (
                      <div className="flex flex-col gap-1.5 max-w-[170px]">
                        {r.tickets.map((t) => {
                          const typeLabel =
                            t.type === "SAMPLE_REQUEST"
                              ? "Sample Request"
                              : t.type === "FABRICATION"
                                ? "Fabrication"
                                : "Damage";
                          const statusColor =
                            t.status === "RESOLVED" || t.status === "CLOSED"
                              ? "text-emerald-700 bg-emerald-50 border-emerald-250"
                              : "text-amber-700 bg-amber-50 border-amber-250";
                          return (
                            <div
                              key={t.id}
                              className="rounded border border-slate-200 p-2 bg-slate-50/60 backdrop-blur-md flex flex-col space-y-1 shadow-sm text-left"
                            >
                              <div className="flex items-center justify-between gap-1.5">
                                <span className="font-mono text-[9px] font-bold text-slate-800">
                                  {t.ticketNo}
                                </span>
                                <span
                                  className={`text-[8px] font-extrabold px-1 rounded uppercase border ${statusColor}`}
                                >
                                  {t.status.replace(/_/g, " ")}
                                </span>
                              </div>
                              <div className="text-[10px] font-semibold text-slate-700">
                                {typeLabel}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-slate-350">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 align-top">
                    <span
                      className={`inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                        r.status === "active" || r.status === "onboarded"
                          ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border border-amber-200 bg-amber-50 text-amber-700"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  {isExec && (
                    <td className="px-5 py-4 align-top text-right">
                      <button
                        onClick={() => {
                          setRaisingForRecord(r);
                          setTicketType("SAMPLE_REQUEST");
                          setTitle("");
                          setDescription("");
                          setError("");
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50/50 hover:bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:text-brand-850 hover:border-brand-300 transition-all hover:scale-[1.02] shadow-sm"
                      >
                        Raise Ticket
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredRecords.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-4 shadow-sm hover:shadow hover:border-slate-355 transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                {/* Header: Product Name, SKU, Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-800 text-sm leading-snug truncate">
                      {r.product.name}
                    </div>
                    <div className="font-mono text-[9px] text-slate-400 mt-0.5 uppercase tracking-wider truncate">
                      SKU: {r.product.sku}
                    </div>
                  </div>
                  <span
                    className={`inline-flex rounded px-2 py-0.5 text-[9px] font-extrabold shrink-0 uppercase tracking-wider ${
                      r.status === "active" || r.status === "onboarded"
                        ? "border border-emerald-100 bg-emerald-50 text-emerald-700"
                        : "border border-amber-100 bg-amber-50 text-amber-700"
                    }`}
                  >
                    {r.status}
                  </span>
                </div>

                {/* Brand & Category */}
                <div className="pt-2 border-t border-slate-100/60 text-xs">
                  <div className="text-slate-400 font-semibold uppercase tracking-wider text-[9px]">Brand &amp; Category</div>
                  <div className="font-semibold text-slate-700 mt-0.5 truncate text-[11px]">
                    {r.product.brand.name}
                  </div>
                  <div className="text-slate-500 text-[10px] truncate">
                    {r.product.category.name}
                  </div>
                </div>

                {/* Seller & Program */}
                <div>
                  <div className="text-slate-400 font-semibold uppercase tracking-wider text-[9px]">Seller &amp; Program</div>
                  <div className="font-bold text-slate-700 mt-0.5 truncate text-[11px]">
                    {r.seller.name} <span className="font-mono text-[9px] font-normal text-slate-400">({r.seller.sellerCode})</span>
                  </div>
                  <div className="mt-1">
                    <span className="inline-flex rounded border border-brand-100 bg-brand-50 px-2 py-0.5 text-[9px] font-medium text-brand-700">
                      {r.program.name}
                    </span>
                  </div>
                </div>

                {/* Associated Tickets */}
                <div>
                  <div className="text-slate-400 font-semibold uppercase tracking-wider text-[9px] mb-1.5">Tickets</div>
                  {r.tickets && r.tickets.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      {r.tickets.map((t) => {
                        const typeLabel =
                          t.type === "SAMPLE_REQUEST"
                            ? "Sample Request"
                            : t.type === "FABRICATION"
                              ? "Fabrication"
                              : "Damage";
                        const statusColor =
                          t.status === "RESOLVED" || t.status === "CLOSED"
                            ? "text-emerald-700 bg-emerald-50 border-emerald-250"
                            : "text-amber-700 bg-amber-50 border-amber-250";
                        return (
                          <div
                            key={t.id}
                            className="rounded border border-slate-200 p-2 bg-slate-50/60 backdrop-blur-md flex flex-col space-y-1 shadow-sm text-left"
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="font-mono text-[9px] font-bold text-slate-800">
                                {t.ticketNo}
                              </span>
                              <span
                                className={`text-[8px] font-extrabold px-1 rounded uppercase border ${statusColor}`}
                              >
                                {t.status.replace(/_/g, " ")}
                              </span>
                            </div>
                            <div className="text-[10px] font-semibold text-slate-700">
                              {typeLabel}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-slate-350 text-xs">—</span>
                  )}
                </div>
              </div>

              {/* Actions Footer */}
              {isExec && (
                <div className="pt-2 border-t border-slate-100/60 flex justify-end">
                  <button
                    onClick={() => {
                      setRaisingForRecord(r);
                      setTicketType("SAMPLE_REQUEST");
                      setTitle("");
                      setDescription("");
                      setError("");
                    }}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50/50 hover:bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:text-brand-850 hover:border-brand-300 transition-all hover:scale-[1.01] shadow-sm"
                  >
                    Raise Ticket
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Raise Ticket Modal */}
      {raisingForRecord && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-4 overflow-y-auto">
          <form
            onSubmit={handleRaiseTicket}
            className="bg-white rounded-xl shadow-xl w-full max-w-md border border-slate-250 my-auto relative max-h-[90vh] overflow-y-auto flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 p-6 pb-4 shrink-0">
              <h3 className="text-lg font-bold text-slate-900">Raise Ticket</h3>
              <button
                type="button"
                onClick={() => setRaisingForRecord(null)}
                className="text-slate-400 hover:text-slate-600 text-2xl leading-none focus:outline-none"
              >
                &times;
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 pt-2 space-y-4 overflow-y-auto flex-1">
              <p className="text-xs text-slate-500">
                Raise a support, fabrication, or sample request for{" "}
                <strong className="text-slate-700 font-semibold">
                  {raisingForRecord.product.name} ({raisingForRecord.product.sku})
                </strong>
                .
              </p>

              {error && (
                <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 font-medium">
                  {error}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                  Ticket Type
                </label>
                <select
                  value={ticketType}
                  onChange={(e) => setTicketType(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
                >
                  {TICKET_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div>
                  <span className="font-semibold text-slate-400 block mb-0.5">Seller</span>
                  <span className="text-slate-800 font-medium">{raisingForRecord.seller.name}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-400 block mb-0.5">Brand</span>
                  <span className="text-slate-800 font-medium">
                    {raisingForRecord.product.brand.name}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                  Title
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="e.g. Need 1mm laminate sample"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                  Details
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="What's needed / notes…"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 p-6 pt-4 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setRaisingForRecord(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-60 transition-colors"
              >
                {busy ? "Raising…" : "Raise Ticket"}
              </button>
            </div>
          </form>
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
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const filteredOptions = useMemo(() => {
    return options.filter((opt) => opt.toLowerCase().includes(search.toLowerCase()));
  }, [options, search]);

  const handleMouseEnter = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setOpen(true);
  };

  const handleMouseLeave = () => {
    const id = setTimeout(() => {
      setOpen(false);
      setSearch("");
    }, 200);
    setTimeoutId(id);
  };

  useEffect(() => {
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [timeoutId]);

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
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

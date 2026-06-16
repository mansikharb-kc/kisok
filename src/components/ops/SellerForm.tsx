"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { slugFromName } from "@/lib/attributeMeta";
import { BRAND_TYPES, AGREEMENT_DURATIONS, durationMonths, addMonths, formatDMY, isValidGstin, brandCodeBase } from "@/lib/brandMeta";
import { isNonEmptyString } from "@/lib/validation";
import { buildParentOptions, FlatCat } from "@/lib/categoryTree";
import { LEVELS, levelMeta } from "@/lib/categoryLevels";

function parseTenureToPeriod(tenureStr: string): { years: number; months: number; days: number } {
  const clean = tenureStr.trim().toLowerCase();
  
  let years = 0;
  let months = 0;
  let days = 0;

  // Extract years
  const yearMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:year|yr)/);
  if (yearMatch) {
    years = parseFloat(yearMatch[1]);
  }

  // Extract months
  const monthMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:month|mo)/);
  if (monthMatch) {
    months = parseFloat(monthMatch[1]);
  }

  // Extract days (matches '370 days', '370 d', '370d', but avoids matching letters in 'dashboard' or 'month')
  const dayMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:day|d\b)/);
  if (dayMatch) {
    days = parseFloat(dayMatch[1]);
  }

  // If it's a raw number with no unit specified
  if (!yearMatch && !monthMatch && !dayMatch) {
    const num = parseFloat(clean);
    if (!isNaN(num)) {
      if (num >= 30) {
        // Treat as days if >= 30 (e.g. 365, 370)
        days = num;
      } else {
        // Treat as months if < 30 (e.g. 12, 24)
        months = num;
      }
    }
  }

  return { years, months, days };
}

function formatTenure(val: string): string {
  const trimmed = val.trim();
  if (!trimmed) return "";
  
  const parsed = parseTenureToPeriod(trimmed);
  
  // Check if input specified days, or was treated as days because raw number >= 30
  const hasDays = trimmed.toLowerCase().includes("day") || 
                  trimmed.toLowerCase().includes("d") ||
                  (!trimmed.toLowerCase().includes("year") && 
                   !trimmed.toLowerCase().includes("yr") && 
                   !trimmed.toLowerCase().includes("month") && 
                   !trimmed.toLowerCase().includes("mo") && 
                   parseFloat(trimmed) >= 30);
                   
  let years = 0;
  let months = 0;
  let days = 0;
  
  if (hasDays) {
    // Convert everything to days (1 year = 365 days, 1 month = 30 days)
    const totalDays = (parsed.years * 365) + (parsed.months * 30) + parsed.days;
    if (isNaN(totalDays) || totalDays <= 0) return val;
    
    years = Math.floor(totalDays / 365);
    const remainingDays = totalDays % 365;
    months = Math.floor(remainingDays / 30);
    days = Math.round(remainingDays % 30);
  } else {
    // Convert months (1 year = 12 months)
    const totalMonths = (parsed.years * 12) + parsed.months;
    if (isNaN(totalMonths) || totalMonths <= 0) return val;
    
    years = Math.floor(totalMonths / 12);
    months = Math.floor(totalMonths % 12);
    days = Math.round(parsed.days);
  }

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} Year${years > 1 ? "s" : ""}`);
  if (months > 0) parts.push(`${months} Month${months > 1 ? "s" : ""}`);
  if (days > 0) parts.push(`${days} Day${days > 1 ? "s" : ""}`);

  if (parts.length === 0) return "0 Days";
  return parts.join(", ");
}

function parseFitoutDays(fitoutStr: string): number {
  const clean = fitoutStr.trim().toLowerCase();
  const match = clean.match(/(\d+(?:\.\d+)?)\s*(?:day|d\b)?/);
  if (match) {
    const num = parseFloat(match[1]);
    return isNaN(num) ? 0 : num;
  }
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

function formatFitoutPeriod(val: string): string {
  const trimmed = val.trim();
  if (!trimmed) return "";
  const days = parseFitoutDays(trimmed);
  if (days <= 0) return val;
  return `${days} Day${days > 1 ? "s" : ""}`;
}

function addDays(dateStr: string, fitoutStr: string): string {
  if (!dateStr) return "";
  const days = parseFitoutDays(fitoutStr);
  const parts = dateStr.split("-");
  if (parts.length !== 3) return "";
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // 0-based
  const day = parseInt(parts[2], 10);
  const date = new Date(Date.UTC(year, month, day));
  if (isNaN(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function subtractDays(dateStr: string, fitoutStr: string): string {
  if (!dateStr) return "";
  const days = parseFitoutDays(fitoutStr);
  const parts = dateStr.split("-");
  if (parts.length !== 3) return "";
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const date = new Date(Date.UTC(year, month, day));
  if (isNaN(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function calculateEndDate(startDateStr: string, tenureStr: string): string {
  if (!startDateStr || !tenureStr) return "";
  
  const { years, months, days } = parseTenureToPeriod(tenureStr);
  
  const parts = startDateStr.split("-");
  if (parts.length !== 3) return "";
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const date = new Date(Date.UTC(year, month, day));
  if (isNaN(date.getTime())) return "";

  const clean = tenureStr.trim().toLowerCase();
  const isDaysBased = clean.includes("day") || 
                      clean.includes("d") ||
                      (!clean.includes("year") && 
                       !clean.includes("yr") && 
                       !clean.includes("month") && 
                       !clean.includes("mo") && 
                       parseFloat(clean) >= 30);

  if (isDaysBased) {
    // For day-based tenures, add total days directly
    const totalDays = (years * 365) + (parsedMonthsToDays(months)) + days;
    date.setUTCDate(date.getUTCDate() + totalDays - 1);
  } else {
    // For year/month-based tenures, add calendar months/years
    const totalMonths = (years * 12) + months;
    date.setUTCMonth(date.getUTCMonth() + totalMonths);
    date.setUTCDate(date.getUTCDate() + days - 1);
  }
  
  return date.toISOString().slice(0, 10);
}

// Helper for exact day logic
function parsedMonthsToDays(months: number): number {
  return months * 30;
}

type BrandOption = {
  id: string;
  name: string;
  code: string;
};

type ProgramOption = {
  id: string;
  name: string;
  code: string;
};

type ExecOption = {
  id: string;
  fullName: string;
  email: string;
};

type SellerEdit = {
  id: string;
  name: string;
  sellerCode: string;
  membershipId: string | null;
  status: string;
  sellerBrands: { brandId: string }[];
  contracts: {
    programId: string;
    collaborationTenure: string | null;
    fitoutPeriod: string | null;
    contractStart: string | null; // yyyy-mm-dd
    contractEnd: string | null; // yyyy-mm-dd
    verified: boolean;
    remarks: string | null;
    contractMediaId?: string | null;
    contractMedia?: { url: string } | null;
  }[];
  assignments?: {
    programId: string | null;
    obExecUserId: string;
  }[];
};

export default function SellerForm({
  brands,
  programs,
  execs,
  flatCategories = [],
  seller,
}: {
  brands: BrandOption[];
  programs: ProgramOption[];
  execs: ExecOption[];
  flatCategories?: FlatCat[];
  seller?: SellerEdit;
}) {
  const router = useRouter();
  const editing = !!seller;

  // Basic Information
  const [name, setName] = useState(seller?.name ?? "");
  const [sellerCode, setSellerCode] = useState(seller?.sellerCode ?? "");
  const [codeTouched, setCodeTouched] = useState(editing);
  const [membershipId, setMembershipId] = useState(seller?.membershipId ?? "");
  const [status, setStatus] = useState(seller?.status ?? "active");

  // Brands Mapped
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>(
    seller?.sellerBrands.map((sb) => sb.brandId) ?? []
  );

  // Contracts/Programs
  // We represent contracts as a dictionary keyed by programId.
  const [activeContracts, setActiveContracts] = useState<
    Record<
      string,
      {
        collaborationTenure: string;
        fitoutPeriod: string;
        baseStartDate: string;
        fitoutEnd: string;
        contractStart: string;
        contractEnd: string;
        verified: boolean;
        remarks: string;
        obExecUserId: string;
        contractMediaId: string | null;
        contractMediaUrl: string | null;
      }
    >
  >(() => {
    const initial: Record<string, any> = {};
    if (seller?.contracts) {
      for (const c of seller.contracts) {
        const match = seller.assignments?.find((a) => String(a.programId) === String(c.programId));
        const fitoutStr = c.fitoutPeriod ?? "45 Days";
        const startStr = c.contractStart ? c.contractStart.slice(0, 10) : "";
        const baseStartStr = startStr && fitoutStr ? subtractDays(startStr, fitoutStr) : "";
        const fitoutEndStr = baseStartStr && fitoutStr ? subtractDays(startStr, "1") : "";
        initial[c.programId] = {
          collaborationTenure: c.collaborationTenure ?? "",
          fitoutPeriod: fitoutStr,
          baseStartDate: baseStartStr,
          fitoutEnd: fitoutEndStr,
          contractStart: startStr,
          contractEnd: c.contractEnd ? c.contractEnd.slice(0, 10) : "",
          verified: c.verified,
          remarks: c.remarks ?? "",
          obExecUserId: match ? String(match.obExecUserId) : "",
          contractMediaId: c.contractMediaId ? String(c.contractMediaId) : null,
          contractMediaUrl: c.contractMedia?.url ?? null,
        };
      }
    }
    return initial;
  });

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [localBrands, setLocalBrands] = useState<BrandOption[]>(brands);
  const [brandSearch, setBrandSearch] = useState("");

  const filteredBrands = useMemo(() => {
    const query = brandSearch.trim().toLowerCase();
    if (!query) return localBrands;
    return localBrands.filter(
      (b) =>
        b.name.toLowerCase().includes(query) ||
        b.code.toLowerCase().includes(query)
    );
  }, [localBrands, brandSearch]);

  // Listen to brand creation events from the new tab/page
  useEffect(() => {
    const channel = new BroadcastChannel("brand_creation");
    channel.onmessage = (event) => {
      if (event.data?.type === "BRAND_CREATED") {
        const newBrand = event.data.brand;
        if (newBrand && newBrand.id) {
          setLocalBrands((prev) => {
            if (prev.some((b) => String(b.id) === String(newBrand.id))) {
              return prev;
            }
            return [...prev, newBrand];
          });
          setSelectedBrandIds((prev) => {
            if (prev.includes(String(newBrand.id))) {
              return prev;
            }
            return [...prev, String(newBrand.id)];
          });
        }
      }
    };
    return () => {
      channel.close();
    };
  }, []);

  // Toggle brand selection
  function toggleBrand(brandId: string) {
    setSelectedBrandIds((prev) =>
      prev.includes(brandId) ? prev.filter((id) => id !== brandId) : [...prev, brandId]
    );
  }

  // Toggle program contract selection
  function toggleProgram(programId: string) {
    setActiveContracts((prev) => {
      const next = { ...prev };
      if (next[programId]) {
        delete next[programId];
      } else {
        next[programId] = {
          collaborationTenure: "",
          fitoutPeriod: "45 Days",
          baseStartDate: "",
          fitoutEnd: "",
          contractStart: "",
          contractEnd: "",
          verified: false,
          remarks: "",
          obExecUserId: "",
          contractMediaId: null,
          contractMediaUrl: null,
        };
      }
      return next;
    });
  }

  // Handle contract field changes
  function updateContract(programId: string, field: string, value: any) {
    setActiveContracts((prev) => {
      const current = prev[programId] || {
        collaborationTenure: "",
        fitoutPeriod: "45 Days",
        baseStartDate: "",
        fitoutEnd: "",
        contractStart: "",
        contractEnd: "",
        verified: false,
        remarks: "",
        obExecUserId: "",
        contractMediaId: null,
        contractMediaUrl: null,
      };
      
      const updated = {
        ...current,
        [field]: value,
      };

      if (field === "baseStartDate") {
        updated.baseStartDate = value;
        // contractStart = baseStartDate + fitoutPeriod
        if (updated.baseStartDate) {
          updated.contractStart = addDays(updated.baseStartDate, updated.fitoutPeriod);
          updated.fitoutEnd = subtractDays(updated.contractStart, "1");
        } else {
          updated.contractStart = "";
          updated.fitoutEnd = "";
        }
        // contractEnd = contractStart + collaborationTenure - 1 day
        if (updated.contractStart && updated.collaborationTenure) {
          updated.contractEnd = calculateEndDate(updated.contractStart, updated.collaborationTenure);
        } else {
          updated.contractEnd = "";
        }
      } else if (field === "fitoutPeriod") {
        if (updated.baseStartDate) {
          updated.contractStart = addDays(updated.baseStartDate, value);
          updated.fitoutEnd = subtractDays(updated.contractStart, "1");
        }
        if (updated.contractStart && updated.collaborationTenure) {
          updated.contractEnd = calculateEndDate(updated.contractStart, updated.collaborationTenure);
        } else {
          updated.contractEnd = "";
        }
      } else if (field === "collaborationTenure") {
        if (updated.contractStart && value) {
          updated.contractEnd = calculateEndDate(updated.contractStart, value);
        } else {
          updated.contractEnd = "";
        }
      }

      return {
        ...prev,
        [programId]: updated,
      };
    });
  }

  // Upload handler for contract PDF
  const [contractUploadingMap, setContractUploadingMap] = useState<Record<string, boolean>>({});

  async function onContractPdf(programId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setContractUploadingMap((prev) => ({ ...prev, [programId]: true }));
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "PDF upload failed");
        return;
      }
      updateContract(programId, "contractMediaId", data.mediaId);
      updateContract(programId, "contractMediaUrl", data.url);
    } catch {
      alert("PDF upload failed");
    } finally {
      setContractUploadingMap((prev) => ({ ...prev, [programId]: false }));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Validate required fields
    if (!isNonEmptyString(name) || !isNonEmptyString(sellerCode)) {
      setError("Seller Name and Seller Code are required");
      return;
    }

    // Optional membershipId validation: if provided, must be non‑empty
    if (membershipId && !isNonEmptyString(membershipId)) {
      setError("Membership ID cannot be empty");
      return;
    }

    setBusy(true);
    try {
      const contractPayload = Object.entries(activeContracts).map(([pid, details]) => ({
        programId: pid,
        collaborationTenure: details.collaborationTenure || null,
        fitoutPeriod: details.fitoutPeriod || null,
        contractStart: details.contractStart || null,
        contractEnd: details.contractEnd || null,
        verified: details.verified,
        remarks: details.remarks || null,
        obExecUserId: details.obExecUserId || null,
        contractMediaId: details.contractMediaId ? String(details.contractMediaId) : null,
      }));

      const payload = {
        name,
        sellerCode,
        membershipId: membershipId.trim() || null,
        status,
        brandIds: selectedBrandIds,
        contracts: contractPayload,
      };

      const res = await fetch(editing ? `/api/sellers/${seller!.id}` : "/api/sellers", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Save failed");
        return;
      }

      router.push("/ops/sellers");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  const L = "block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1";
  const I = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500";
  const card = "bg-white/60 backdrop-blur-md rounded-2xl border border-slate-200 p-6";

  function StepHeader({ n, title, sub }: { n: number; title: string; sub: string }) {
    return (
      <div className="flex items-center gap-3 mb-5">
        <span className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-bold">
          {n}
        </span>
        <div>
          <h2 className="font-bold text-slate-800">{title}</h2>
          <p className="text-xs text-slate-500">{sub}</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5 max-w-4xl">
      {/* Top bar */}
      <div className="flex items-start justify-between">
        <div>
          <button
            type="button"
            onClick={() => router.push("/ops/sellers")}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            ‹ Back to Sellers
          </button>
          <h1 className="text-2xl font-bold mt-1">
            {editing ? `Edit Seller: ${seller?.name}` : "Add New Seller"}
          </h1>
          <p className="text-sm text-slate-500">
            Define seller profile, associate operating brands, and configure program contracts.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push("/ops/sellers")}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-brand-600 text-white px-5 py-2 text-sm font-semibold hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? "Saving…" : editing ? "Update Seller" : "+ Add Seller"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
          {error}
        </div>
      )}

      {/* 1. Basic Info */}
      <div className={card}>
        <StepHeader n={1} title="Basic Information" sub="Primary identity details of the seller" />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={L}>Seller Name *</label>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!codeTouched) setSellerCode(slugFromName(e.target.value));
              }}
              required
              className={I}
              placeholder="e.g. Vendor Corp"
            />
          </div>
          <div>
            <label className={L}>Seller Code *</label>
            <input
              value={sellerCode}
              onChange={(e) => {
                setSellerCode(e.target.value);
                setCodeTouched(true);
              }}
              required
              className={`${I} font-mono`}
              placeholder="e.g. vendor-corp"
            />
          </div>
          <div>
            <label className={L}>Membership ID</label>
            <input
              value={membershipId}
              onChange={(e) => setMembershipId(e.target.value)}
              className={I}
              placeholder="e.g. MEM-123"
            />
          </div>
          <div>
            <label className={L}>Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={I}
            >
              <option value="active">Active</option>
              <option value="retired">Retired</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Brands Mapped */}
      <div className={card}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-100">
          <StepHeader
            n={2}
            title="Associated Brands"
            sub="Select the brands this seller is authorized to operate under"
          />
          <a
            href="/masters/brands/new?origin=seller-onboarding"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-slate-900 text-white px-4 py-2 text-xs font-semibold hover:bg-slate-800 transition shadow-sm inline-block self-end sm:self-auto"
          >
            + Create New Brand
          </a>
        </div>
        {localBrands.length === 0 ? (
          <p className="text-sm text-slate-400">
            No active brands in this branch. Please ask the Branch Admin to activate brands or click button to create one.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Search and Selection Status bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="relative flex-1 max-w-md">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  type="text"
                  value={brandSearch}
                  onChange={(e) => setBrandSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                    }
                  }}
                  placeholder="Search brands by name or code..."
                  className="w-full rounded-lg border border-slate-300 py-1.5 pl-9 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white/60 backdrop-blur-md"
                />
                {brandSearch && (
                  <button
                    type="button"
                    onClick={() => setBrandSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>
              
              <div className="flex items-center justify-between sm:justify-end gap-3 text-xs">
                <span className="font-semibold text-slate-650">
                  {selectedBrandIds.length} of {localBrands.length} selected
                </span>
                {selectedBrandIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedBrandIds([])}
                    className="text-brand-600 hover:text-brand-800 hover:underline font-semibold"
                  >
                    Clear selection
                  </button>
                )}
              </div>
            </div>

            {/* Grid of Brand Options */}
            {filteredBrands.length === 0 ? (
              <div className="text-center py-8 bg-white/60 backdrop-blur-md border border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm">
                No matching brands found for &ldquo;{brandSearch}&rdquo;.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[320px] overflow-y-auto pr-1">
                {filteredBrands.map((b) => {
                  const checked = selectedBrandIds.includes(b.id);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => toggleBrand(b.id)}
                      className={`flex items-center justify-between p-3.5 rounded-xl border text-left text-sm font-medium transition-all group duration-150 hover:scale-[1.01] ${
                        checked
                          ? "border-brand-600 bg-brand-50/50 text-brand-900 shadow-sm"
                          : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="truncate font-semibold">{b.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate uppercase tracking-wider">{b.code}</div>
                      </div>
                      <span
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                          checked
                            ? "border-brand-600 bg-brand-600 text-white text-[10px]"
                            : "border-slate-300 bg-white/60 backdrop-blur-md group-hover:border-slate-400"
                        }`}
                      >
                        {checked && "✓"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Contracts */}
      <div className={card}>
        <StepHeader
          n={3}
          title="Program Contracts"
          sub="Assign programs and define the tenure & start/end collaboration metrics"
        />
        {programs.length === 0 ? (
          <p className="text-sm text-slate-400">
            No active programs in this branch. Please ask the Branch Admin to link programs.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 mb-4">
              {programs.map((p) => {
                const checked = !!activeContracts[p.id];
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleProgram(p.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                      checked
                        ? "bg-brand-600 text-white border-brand-600"
                        : "bg-white/60 backdrop-blur-md text-slate-600 border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {p.name} {checked ? "✓" : "+"}
                  </button>
                );
              })}
            </div>

            <div className="space-y-4">
              {programs
                .filter((p) => !!activeContracts[p.id])
                .map((p) => {
                  const details = activeContracts[p.id];
                  return (
                    <div
                      key={p.id}
                      className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                        <div className="font-bold text-sm text-slate-800">{p.name} Contract</div>
                        <button
                          type="button"
                          onClick={() => toggleProgram(p.id)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Remove Contract
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-6 pb-2 border-b border-slate-100/60">
                        {/* Left Column: Collaboration Tenure Dates */}
                        <div className="space-y-4">
                          <div>
                            <label className={L}>Collaboration Tenure</label>
                            <input
                              value={details.collaborationTenure}
                              onChange={(e) =>
                                updateContract(p.id, "collaborationTenure", e.target.value)
                              }
                              onBlur={(e) => {
                                const formatted = formatTenure(e.target.value);
                                if (formatted !== e.target.value) {
                                  updateContract(p.id, "collaborationTenure", formatted);
                                }
                              }}
                              className={I}
                              placeholder="e.g. 12 months"
                            />
                          </div>
                          <div>
                            <label className={L}>Collaboration Tenure Start Date</label>
                            <input
                              type="date"
                              value={details.contractStart}
                              readOnly
                              disabled
                              className={`${I} bg-slate-50 cursor-not-allowed`}
                            />
                          </div>
                          <div>
                            <label className={L}>Collaboration Tenure End Date</label>
                            <input
                              type="date"
                              value={details.contractEnd}
                              readOnly
                              disabled
                              className={`${I} bg-slate-50 cursor-not-allowed`}
                            />
                          </div>
                        </div>

                        {/* Right Column: Fitout Period Dates */}
                        <div className="space-y-4">
                          <div>
                            <label className={L}>Fitout Period</label>
                            <input
                              value={details.fitoutPeriod}
                              onChange={(e) =>
                                updateContract(p.id, "fitoutPeriod", e.target.value)
                              }
                              onBlur={(e) => {
                                const formatted = formatFitoutPeriod(e.target.value);
                                if (formatted !== e.target.value) {
                                  updateContract(p.id, "fitoutPeriod", formatted);
                                }
                              }}
                              className={I}
                              placeholder="e.g. 45 Days"
                            />
                          </div>
                          <div>
                            <label className={L}>Fitout Period Start Date</label>
                            <input
                              type="date"
                              value={details.baseStartDate}
                              onChange={(e) =>
                                updateContract(p.id, "baseStartDate", e.target.value)
                              }
                              className={I}
                            />
                          </div>
                          <div>
                            <label className={L}>Fitout Period End Date</label>
                            <input
                              type="date"
                              value={details.fitoutEnd}
                              readOnly
                              disabled
                              className={`${I} bg-slate-50 cursor-not-allowed`}
                            />
                          </div>
                        </div>

                        {details.baseStartDate && (
                          <div className="col-span-2 mt-1 text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-wrap items-center gap-y-2 gap-x-4 shadow-sm">
                            <span className="font-semibold text-brand-700 uppercase tracking-wider text-[10px]">Timeline Sequence:</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400">Fitout Start:</span>
                              <strong className="text-slate-800">{formatDMY(details.baseStartDate)}</strong>
                            </div>
                            <span className="text-slate-300 font-bold">➔</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400">Fitout End:</span>
                              <strong className="text-slate-800">{details.fitoutEnd ? formatDMY(details.fitoutEnd) : "—"}</strong>
                            </div>
                            <span className="text-slate-300 font-bold">➔</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400">Collab Start:</span>
                              <strong className="text-brand-600">{formatDMY(details.contractStart)}</strong>
                            </div>
                            <span className="text-slate-300 font-bold">➔</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400">Collab End:</span>
                              <strong className="text-brand-600">{formatDMY(details.contractEnd)}</strong>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="pt-2 flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer font-medium select-none">
                          <input
                            type="checkbox"
                            checked={details.verified}
                            onChange={(e) =>
                              updateContract(p.id, "verified", e.target.checked)
                            }
                            className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                          />
                          Contract Verified
                        </label>
                      </div>

                      <div>
                        <label className={L}>Remarks / Notes</label>
                        <textarea
                          value={details.remarks}
                          onChange={(e) => updateContract(p.id, "remarks", e.target.value)}
                          rows={2}
                          className={I}
                          placeholder="Special collaboration clauses, revenue sharing rules…"
                        />
                      </div>

                      {/* PDF upload field */}
                      <div className="pt-2">
                        <label className={L}>Contract Proof (PDF)</label>
                        <div className="flex flex-wrap items-center gap-3">
                          {details.contractMediaUrl ? (
                            <a
                              href={details.contractMediaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-xs font-semibold text-brand-600 hover:text-brand-850 bg-white/60 backdrop-blur-md border border-slate-200 px-3.5 py-2.5 rounded-lg shadow-sm transition active:scale-[0.98]"
                            >
                              <svg className="w-4 h-4 text-brand-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <span>View Uploaded PDF</span>
                            </a>
                          ) : (
                            <div className="text-xs text-slate-400 bg-white/60 backdrop-blur-md border border-slate-200 border-dashed px-3.5 py-2.5 rounded-lg select-none">
                              No PDF uploaded yet
                            </div>
                          )}
                          
                          <label className={`cursor-pointer rounded-lg border border-slate-300 bg-white/60 backdrop-blur-md px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition select-none ${contractUploadingMap[p.id] ? "opacity-60 cursor-not-allowed" : ""}`}>
                            {contractUploadingMap[p.id] ? "Uploading..." : details.contractMediaUrl ? "Change PDF File" : " Upload Contract PDF"}
                            <input
                              type="file"
                              accept="application/pdf"
                              onChange={(e) => onContractPdf(p.id, e)}
                              className="hidden"
                              disabled={!!contractUploadingMap[p.id]}
                            />
                          </label>

                          {details.contractMediaUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                updateContract(p.id, "contractMediaId", null);
                                updateContract(p.id, "contractMediaUrl", null);
                              }}
                              className="text-xs font-semibold text-red-500 hover:text-red-700 bg-white/60 backdrop-blur-md border border-slate-200 px-3 py-2.5 rounded-lg hover:bg-red-50 transition active:scale-[0.98] shadow-sm"
                            >
                              Remove PDF
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

              {Object.keys(activeContracts).length === 0 && (
                <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl bg-white/60 backdrop-blur-md text-slate-400 text-sm">
                  Click a program button above to create a contract for it.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. Executive Assignments */}
      {Object.keys(activeContracts).length > 0 && (
        <div className={card}>
          <StepHeader
            n={4}
            title="Onboarding Executive Assignments"
            sub="Assign an onboarding executive for each active program contract"
          />
          <div className="space-y-4">
            {programs
              .filter((p) => !!activeContracts[p.id])
              .map((p) => {
                const details = activeContracts[p.id];
                return (
                  <div
                    key={p.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md shadow-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800 text-sm">
                        {p.name}
                      </div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">
                        Program Code: {p.code}
                      </div>
                    </div>
                    <div className="w-full sm:max-w-xs">
                      <label className="sr-only">Choose Executive</label>
                      <select
                        value={details.obExecUserId}
                        onChange={(e) =>
                          updateContract(p.id, "obExecUserId", e.target.value)
                        }
                        required
                        className={I}
                      >
                        <option value="">— Select Executive —</option>
                        {execs.map((ex) => (
                          <option key={ex.id} value={ex.id}>
                            {ex.fullName} ({ex.email})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push("/ops/sellers")}
          className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand-600 text-white px-6 py-2.5 text-sm font-semibold hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? "Saving…" : editing ? "Update Seller" : "+ Add Seller"}
        </button>
      </div>
    </form>
  );
}

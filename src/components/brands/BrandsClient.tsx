"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type BrandRow = {
  id: string;
  brandNo: string | null;
  name: string;
  code: string;
  brandType: string | null;
  logoUrl: string | null;
  categories: string[];
  approvalStatus: string;
  status: string;
  productCount: number;
  sellerCount: number;
  branchCount: number;
  contactPerson?: string | null;
  contactPersonDesignation?: string | null;
  phoneCc?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  socialLinkedin?: string | null;
  socialTwitter?: string | null;
  socialInstagram?: string | null;
  socialYoutube?: string | null;
  address?: string | null;
  pincode?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  gstNumber?: string | null;
  agreementDuration?: string | null;
  contractStart?: string | null;
  contractEnd?: string | null;
  description?: string | null;
  contacts?: any[] | null;
};

const APPROVAL_BADGE: Record<string, string> = {
  draft: "bg-amber-500 text-white",
  pending: "bg-amber-500 text-white",
  approved: "bg-emerald-600 text-white",
  rejected: "bg-rose-600 text-white",
};

function BrandLogo({ url, name }: { url: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const initials = name.trim().slice(0, 2).toUpperCase();

  if (url && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} onError={() => setFailed(true)} className="h-9 w-9 shrink-0 rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md object-contain" />;
  }

  return <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white">{initials}</div>;
}

export default function BrandsClient({ initial, readOnly = false }: { initial: BrandRow[]; readOnly?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [approval, setApproval] = useState<"all" | "approved" | "pending" | "rejected">("all");

  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  function parseCSV(text: string) {
    const lines = text.split(/\r\n|\n/);
    const result: string[][] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const row: string[] = [];
      let inQuotes = false;
      let currentVal = "";
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          row.push(currentVal.trim());
          currentVal = "";
        } else {
          currentVal += char;
        }
      }
      row.push(currentVal.trim());
      result.push(row);
    }
    return result;
  }

  async function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImportBusy(true);
    setImportError(null);
    try {
      const text = await file.text();
      const parsed = parseCSV(text);
      if (parsed.length < 2) {
        setImportError("CSV file must contain a header row and at least one data row.");
        return;
      }
      
      const headers = parsed[0].map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
      const nameIdx = headers.indexOf("brandname");
      if (nameIdx === -1) {
        setImportError("Required column 'Brand Name' not found in CSV header.");
        return;
      }

      const typeIdx = headers.indexOf("brandtype");
      const personIdx = headers.indexOf("contactperson");
      const designationIdx = headers.indexOf("designation");
      const phoneCcIdx = headers.indexOf("phonecc");
      const phoneIdx = headers.indexOf("phone");
      const emailIdx = headers.indexOf("email");
      const websiteIdx = headers.indexOf("website");
      const linkedinIdx = headers.indexOf("linkedin");
      const twitterIdx = headers.indexOf("twitter");
      const instagramIdx = headers.indexOf("instagram");
      const youtubeIdx = headers.indexOf("youtube");
      const addressIdx = headers.indexOf("address");
      const pincodeIdx = headers.indexOf("pincode");
      const cityIdx = headers.indexOf("city");
      const stateIdx = headers.indexOf("state");
      const countryIdx = headers.indexOf("country");
      const gstIdx = headers.indexOf("gstnumber");
      const agreementIdx = headers.indexOf("agreementduration");
      const contractStartIdx = headers.indexOf("contractstart");
      const descIdx = headers.indexOf("description");

      const brandsToCreate = [];
      for (let i = 1; i < parsed.length; i++) {
        const row = parsed[i];
        if (row.length < nameIdx + 1 || !row[nameIdx]) continue;

        const newBrand = {
          name: row[nameIdx],
          brandType: typeIdx !== -1 ? row[typeIdx] || null : null,
          contactPerson: personIdx !== -1 ? row[personIdx] || null : null,
          contactPersonDesignation: designationIdx !== -1 ? row[designationIdx] || null : null,
          phoneCc: phoneCcIdx !== -1 ? row[phoneCcIdx] || null : "+91",
          phone: phoneIdx !== -1 ? row[phoneIdx] || null : null,
          email: emailIdx !== -1 ? row[emailIdx] || null : null,
          website: websiteIdx !== -1 ? row[websiteIdx] || null : null,
          socialLinkedin: linkedinIdx !== -1 ? row[linkedinIdx] || null : null,
          socialTwitter: twitterIdx !== -1 ? row[twitterIdx] || null : null,
          socialInstagram: instagramIdx !== -1 ? row[instagramIdx] || null : null,
          socialYoutube: youtubeIdx !== -1 ? row[youtubeIdx] || null : null,
          address: addressIdx !== -1 ? row[addressIdx] || null : null,
          pincode: pincodeIdx !== -1 ? row[pincodeIdx] || null : null,
          city: cityIdx !== -1 ? row[cityIdx] || null : null,
          state: stateIdx !== -1 ? row[stateIdx] || null : null,
          country: countryIdx !== -1 ? row[countryIdx] || null : null,
          gstNumber: gstIdx !== -1 ? row[gstIdx] || null : null,
          agreementDuration: agreementIdx !== -1 ? row[agreementIdx] || null : null,
          contractStart: contractStartIdx !== -1 ? row[contractStartIdx] || null : null,
          description: descIdx !== -1 ? row[descIdx] || null : null,
        };
        brandsToCreate.push(newBrand);
      }

      if (brandsToCreate.length === 0) {
        setImportError("No valid rows to import.");
        return;
      }

      let successCount = 0;
      let failCount = 0;
      for (const brandData of brandsToCreate) {
        try {
          const res = await fetch("/api/brands", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(brandData)
          });
          if (res.ok) {
            successCount++;
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      }

      alert(`Import completed! ${successCount} brands imported successfully.${failCount > 0 ? ` ${failCount} rows failed.` : ""}`);
      setImportOpen(false);
      router.refresh();
    } catch (err: any) {
      setImportError(err.message || "Failed to read file.");
    } finally {
      setImportBusy(false);
    }
  }

  function triggerExport() {
    const headers = [
      "Brand No", "Brand Name", "Code", "Brand Type", "Contact Person",
      "Designation", "Phone CC", "Phone", "Email", "Website", "LinkedIn",
      "Twitter", "Instagram", "YouTube", "Address", "Pincode", "City",
      "State", "Country", "GST Number", "Agreement Duration", "Contract Start",
      "Contract End", "Description"
    ];

    const csvRows = [
      headers.join(",")
    ];

    for (const b of rows) {
      const values = [
        b.brandNo ?? "",
        b.name,
        b.code,
        b.brandType ?? "",
        b.contactPerson ?? "",
        b.contactPersonDesignation ?? "",
        b.phoneCc ?? "",
        b.phone ?? "",
        b.email ?? "",
        b.website ?? "",
        b.socialLinkedin ?? "",
        b.socialTwitter ?? "",
        b.socialInstagram ?? "",
        b.socialYoutube ?? "",
        b.address ?? "",
        b.pincode ?? "",
        b.city ?? "",
        b.state ?? "",
        b.country ?? "",
        b.gstNumber ?? "",
        b.agreementDuration ?? "",
        b.contractStart ?? "",
        b.contractEnd ?? "",
        b.description ?? ""
      ].map(val => {
        const escaped = ('' + (val ?? "")).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(","));
    }

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => encodeURIComponent(e)).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `brands_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setExportOpen(false);
  }

  const visible = useMemo(() => initial.filter((b) => b.status !== "archived"), [initial]);
  const counts = useMemo(
    () => ({
      all: visible.length,
      approved: visible.filter((b) => b.approvalStatus === "approved").length,
      pending: visible.filter((b) => b.approvalStatus === "pending" || b.approvalStatus === "draft").length,
      rejected: visible.filter((b) => b.approvalStatus === "rejected").length,
    }),
    [visible]
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let base = visible;
    if (approval !== "all") {
      base = base.filter((b) =>
        approval === "pending" ? b.approvalStatus === "pending" || b.approvalStatus === "draft" : b.approvalStatus === approval
      );
    }
    if (q) base = base.filter((b) => b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q));
    return base;
  }, [visible, query, approval]);

  async function patch(b: BrandRow, body: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch(`/api/brands/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(b: BrandRow) {
    if (!confirm(`Archive brand "${b.name}"? You can restore it later from Archived.`)) return;
    setBusy(true);
    try {
      await fetch("/api/archive", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entity: "brand", id: b.id, action: "archive" }) });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const emptyState = (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 backdrop-blur-md p-12 text-center text-sm text-slate-400">
      No brands yet. Click <strong>New Brand</strong> to add one.
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative max-w-md flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search brands..." className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>

        <div className="flex items-center gap-3 lg:ml-auto">
          <span className="text-sm text-slate-500">{initial.length} total</span>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md p-1 shadow-sm">
            <button type="button" onClick={() => setViewMode("table")} className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === "table" ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
              Table
            </button>
            <button type="button" onClick={() => setViewMode("card")} className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === "card" ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
              Card
            </button>
          </div>
          {!readOnly && (
            <>
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition active:scale-[0.98] shadow-sm"
              >
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                Import
              </button>
              <button
                type="button"
                onClick={() => setExportOpen(true)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition active:scale-[0.98] shadow-sm"
              >
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Export
              </button>
              <button type="button" onClick={() => router.push("/masters/brands/new")} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                + New Brand
              </button>
            </>
          )}
        </div>
      </div>

      {/* Approval filter tabs */}
      <div className="flex flex-wrap gap-2">
        {([["all", "All"], ["approved", "Approved"], ["pending", "Pending"], ["rejected", "Rejected"]] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setApproval(key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              approval === key ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white/60 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {label} <span className="opacity-70">({counts[key]})</span>
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        emptyState
      ) : viewMode === "card" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((b) => (
            <div key={b.id} className={`group flex flex-col rounded border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300 ${b.status === "inactive" ? "opacity-70" : ""}`}>
              {/* Header */}
              <div className="flex items-start gap-3">
                <BrandLogo url={b.logoUrl} name={b.name} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-semibold text-slate-900">{b.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-white">{b.code}</span>
                    <span className="text-xs text-slate-500">{b.brandType ?? "—"}</span>
                  </div>
                </div>
                <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize text-white ${b.status === "active" ? "bg-emerald-600" : "bg-slate-500"}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  {b.status}
                </span>
              </div>

              {/* Categories */}
              <div className="mt-4">
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Categories</div>
                {b.categories.length === 0 ? (
                  <span className="text-xs text-slate-300">None mapped</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {b.categories.slice(0, 4).map((c) => (
                      <span key={c} className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] text-brand-700">{c}</span>
                    ))}
                    {b.categories.length > 4 ? <span title={b.categories.join(", ")} className="cursor-default self-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">+{b.categories.length - 4} more</span> : null}
                  </div>
                )}
              </div>

              {/* Usage stats */}
              <div className="mt-4 grid grid-cols-3 divide-x divide-slate-100 rounded-md border border-slate-100 bg-slate-50/60">
                <div className="px-2 py-2 text-center">
                  <div className="text-sm font-bold text-slate-800">{b.productCount}</div>
                  <div className="text-[10px] text-slate-400">Products</div>
                </div>
                <div className="px-2 py-2 text-center">
                  <div className="text-sm font-bold text-slate-800">{b.sellerCount}</div>
                  <div className="text-[10px] text-slate-400">Sellers</div>
                </div>
                <div className="px-2 py-2 text-center">
                  <div className="text-sm font-bold text-slate-800">{b.branchCount}</div>
                  <div className="text-[10px] text-slate-400">Branches</div>
                </div>
              </div>

              {/* Approval + approve/reject */}
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${APPROVAL_BADGE[b.approvalStatus] ?? "bg-slate-100 text-slate-500"}`}>{b.approvalStatus}</span>
                {!readOnly && b.approvalStatus !== "approved" && (
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => patch(b, { approvalStatus: "approved" })} disabled={busy} className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                      Approve
                    </button>
                    {b.approvalStatus !== "rejected" && (
                      <button type="button" onClick={() => patch(b, { approvalStatus: "rejected" })} disabled={busy} className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50">
                        Reject
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Row actions */}
              {!readOnly && (
                <div className="mt-3 flex items-center gap-2">
                  <button type="button" title="Edit" aria-label="Edit" onClick={() => router.push(`/masters/brands/${b.id}/edit`)} className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-brand-600 hover:bg-brand-50">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  </button>
                  <button type="button" title={b.status === "active" ? "Deactivate" : "Activate"} aria-label={b.status === "active" ? "Deactivate" : "Activate"} onClick={() => patch(b, { status: b.status === "active" ? "inactive" : "active" })} disabled={busy} className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" /></svg>
                  </button>
                  <button type="button" title="Archive" aria-label="Archive" onClick={() => remove(b)} disabled={busy} className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="22" height="5" rx="1" /><path d="M3 8v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8" /><line x1="10" y1="13" x2="14" y2="13" /></svg>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md overflow-hidden">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium w-[28%]">Brand</th>
                <th className="px-4 py-3 text-left font-medium w-[16%]">Brand ID</th>
                <th className="px-4 py-3 text-left font-medium w-[26%]">Categories</th>
                <th className="px-4 py-3 text-left font-medium w-[18%]">Usage</th>
                <th className="px-4 py-3 text-right font-medium w-[12%]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((b) => (
                <tr
                  key={b.id}
                  onClick={() => router.push(`/masters/brands/${b.id}`)}
                  className={`cursor-pointer hover:bg-slate-50 ${b.status === "inactive" ? "opacity-60" : ""}`}
                >
                  {/* Brand: logo with the name underneath */}
                  <td className="px-4 py-2.5 align-middle">
                    <div className="flex items-center gap-3">
                      <BrandLogo url={b.logoUrl} name={b.name} />
                      <span className="font-semibold text-slate-800 truncate">{b.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 align-middle">
                    <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-white">{b.code}</span>
                  </td>
                  <td className="px-4 py-2.5 align-middle">
                    {b.categories.length === 0 ? (
                      <span className="text-slate-300">—</span>
                    ) : (
                      <div className="flex flex-col gap-0.5 text-xs text-slate-600">
                        {b.categories.map((c) => <span key={c} className="truncate">{c}</span>)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 align-middle text-[11px] text-slate-500 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <span><span className="font-semibold text-slate-700">{b.productCount}</span> products</span>
                      <span className="text-slate-300">·</span>
                      <span><span className="font-semibold text-slate-700">{b.sellerCount}</span> sellers</span>
                      <span className="text-slate-300">·</span>
                      <span><span className="font-semibold text-slate-700">{b.branchCount}</span> branches</span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5 align-middle text-right" onClick={(e) => e.stopPropagation()}>
                    {readOnly ? (
                      <span className="text-xs text-slate-400 italic">View only</span>
                    ) : (
                      <div className="inline-flex justify-end gap-2">
                        <button type="button" title="Edit" aria-label="Edit" onClick={() => router.push(`/masters/brands/${b.id}/edit`)} className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-brand-600 hover:bg-slate-50">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                        </button>
                        <button type="button" title={b.status === "active" ? "Deactivate" : "Activate"} aria-label={b.status === "active" ? "Deactivate" : "Activate"} onClick={() => patch(b, { status: b.status === "active" ? "inactive" : "active" })} disabled={busy} className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" /></svg>
                        </button>
                        <button type="button" title="Archive" aria-label="Archive" onClick={() => remove(b)} disabled={busy} className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="22" height="5" rx="1" /><path d="M3 8v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8" /><line x1="10" y1="13" x2="14" y2="13" /></svg>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {exportOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-4 py-8">
          <div className="w-full max-w-6xl rounded-2xl border border-white/10 bg-slate-900 text-white shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/5 px-6 py-4 bg-slate-950/40">
              <div>
                <h3 className="text-lg font-bold text-white">Brand Data Export Preview</h3>
                <p className="text-xs text-slate-400 mt-0.5">Spreadsheet preview of the brand columns to be exported</p>
              </div>
              <button type="button" onClick={() => setExportOpen(false)} className="text-slate-400 hover:text-white transition font-bold text-lg">✕</button>
            </div>

            <div className="p-6 overflow-auto flex-1 bg-slate-950">
              <div className="border border-slate-750 rounded-lg overflow-auto shadow-inner max-w-full bg-slate-900">
                <table className="min-w-full border-collapse text-[11px] font-mono text-slate-200">
                  <thead className="bg-slate-800 sticky top-0 z-10 border-b border-slate-700">
                    <tr>
                      <th className="border border-slate-700 px-2 py-2 text-center bg-slate-850 text-slate-400 w-10 font-bold">#</th>
                      <th className="border border-slate-700 px-3 py-2 text-left bg-slate-850 text-slate-200 font-bold min-w-[100px]">Brand No</th>
                      <th className="border border-slate-700 px-3 py-2 text-left bg-slate-850 text-slate-200 font-bold min-w-[130px]">Brand Name</th>
                      <th className="border border-slate-700 px-3 py-2 text-left bg-slate-850 text-slate-200 font-bold min-w-[90px]">Code</th>
                      <th className="border border-slate-700 px-3 py-2 text-left bg-slate-850 text-slate-200 font-bold min-w-[100px]">Brand Type</th>
                      <th className="border border-slate-700 px-3 py-2 text-left bg-slate-850 text-slate-200 font-bold min-w-[130px]">Contact Person</th>
                      <th className="border border-slate-700 px-3 py-2 text-left bg-slate-850 text-slate-200 font-bold min-w-[120px]">Designation</th>
                      <th className="border border-slate-700 px-3 py-2 text-left bg-slate-850 text-slate-200 font-bold min-w-[60px]">Phone CC</th>
                      <th className="border border-slate-700 px-3 py-2 text-left bg-slate-850 text-slate-200 font-bold min-w-[110px]">Phone</th>
                      <th className="border border-slate-700 px-3 py-2 text-left bg-slate-850 text-slate-200 font-bold min-w-[150px]">Email</th>
                      <th className="border border-slate-700 px-3 py-2 text-left bg-slate-850 text-slate-200 font-bold min-w-[150px]">Website</th>
                      <th className="border border-slate-700 px-3 py-2 text-left bg-slate-850 text-slate-200 font-bold min-w-[150px]">Address</th>
                      <th className="border border-slate-700 px-3 py-2 text-left bg-slate-850 text-slate-200 font-bold min-w-[80px]">Pincode</th>
                      <th className="border border-slate-700 px-3 py-2 text-left bg-slate-850 text-slate-200 font-bold min-w-[100px]">City</th>
                      <th className="border border-slate-700 px-3 py-2 text-left bg-slate-850 text-slate-200 font-bold min-w-[100px]">State</th>
                      <th className="border border-slate-700 px-3 py-2 text-left bg-slate-850 text-slate-200 font-bold min-w-[100px]">Country</th>
                      <th className="border border-slate-700 px-3 py-2 text-left bg-slate-850 text-slate-200 font-bold min-w-[120px]">GST Number</th>
                      <th className="border border-slate-700 px-3 py-2 text-left bg-slate-850 text-slate-200 font-bold min-w-[130px]">Agreement Duration</th>
                      <th className="border border-slate-700 px-3 py-2 text-left bg-slate-850 text-slate-200 font-bold min-w-[100px]">Contract Start</th>
                      <th className="border border-slate-700 px-3 py-2 text-left bg-slate-850 text-slate-200 font-bold min-w-[100px]">Contract End</th>
                      <th className="border border-slate-700 px-3 py-2 text-left bg-slate-850 text-slate-200 font-bold min-w-[180px]">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-900">
                    {rows.map((b, index) => (
                      <tr key={b.id} className="hover:bg-white/[0.02]">
                        <td className="border border-slate-700 px-2 py-1 text-center bg-slate-850/40 text-slate-400 font-semibold">{index + 1}</td>
                        <td className="border border-slate-700 px-3 py-1 truncate max-w-[120px] font-semibold text-white">{b.brandNo ?? "—"}</td>
                        <td className="border border-slate-700 px-3 py-1 truncate max-w-[150px] font-semibold text-white">{b.name}</td>
                        <td className="border border-slate-700 px-3 py-1 truncate max-w-[90px] text-slate-300">{b.code}</td>
                        <td className="border border-slate-700 px-3 py-1 truncate max-w-[100px] text-slate-300">{b.brandType ?? "—"}</td>
                        <td className="border border-slate-700 px-3 py-1 truncate max-w-[130px] text-slate-350">{b.contactPerson ?? "—"}</td>
                        <td className="border border-slate-700 px-3 py-1 truncate max-w-[120px] text-slate-350">{b.contactPersonDesignation ?? "—"}</td>
                        <td className="border border-slate-700 px-3 py-1 truncate max-w-[60px] text-slate-350">{b.phoneCc ?? "—"}</td>
                        <td className="border border-slate-700 px-3 py-1 truncate max-w-[110px] text-slate-350">{b.phone ?? "—"}</td>
                        <td className="border border-slate-700 px-3 py-1 truncate max-w-[150px] text-slate-350">{b.email ?? "—"}</td>
                        <td className="border border-slate-700 px-3 py-1 truncate max-w-[150px] text-slate-350">{b.website ?? "—"}</td>
                        <td className="border border-slate-700 px-3 py-1 truncate max-w-[180px] text-slate-350">{b.address ?? "—"}</td>
                        <td className="border border-slate-700 px-3 py-1 truncate max-w-[80px] text-slate-350">{b.pincode ?? "—"}</td>
                        <td className="border border-slate-700 px-3 py-1 truncate max-w-[100px] text-slate-350">{b.city ?? "—"}</td>
                        <td className="border border-slate-700 px-3 py-1 truncate max-w-[100px] text-slate-350">{b.state ?? "—"}</td>
                        <td className="border border-slate-700 px-3 py-1 truncate max-w-[100px] text-slate-350">{b.country ?? "—"}</td>
                        <td className="border border-slate-700 px-3 py-1 truncate max-w-[120px] text-slate-350">{b.gstNumber ?? "—"}</td>
                        <td className="border border-slate-700 px-3 py-1 truncate max-w-[130px] text-slate-350">{b.agreementDuration ?? "—"}</td>
                        <td className="border border-slate-700 px-3 py-1 truncate max-w-[100px] text-slate-350">{b.contractStart ?? "—"}</td>
                        <td className="border border-slate-700 px-3 py-1 truncate max-w-[100px] text-slate-350">{b.contractEnd ?? "—"}</td>
                        <td className="border border-slate-700 px-3 py-1 truncate max-w-[200px] text-slate-350">{b.description ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-white/5 px-6 py-4 bg-slate-950/40">
              <button
                type="button"
                onClick={() => setExportOpen(false)}
                className="rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={triggerExport}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-5 py-2 text-sm font-semibold text-white transition shadow-lg active:scale-[0.98]"
              >
                Export Data (CSV)
              </button>
            </div>
          </div>
        </div>
      )}

      {importOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-4 py-8">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 text-white shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/5 px-6 py-4 bg-slate-950/40">
              <div>
                <h3 className="text-lg font-bold text-white">Import Brands (CSV)</h3>
                <p className="text-xs text-slate-400 mt-0.5">Select a CSV file containing brand columns to import in bulk</p>
              </div>
              <button type="button" onClick={() => setImportOpen(false)} className="text-slate-400 hover:text-white transition font-bold text-lg">✕</button>
            </div>

            <div className="p-6 space-y-4 bg-slate-950">
              {importError && (
                <div className="rounded-lg bg-rose-950/40 border border-rose-800 text-rose-200 text-xs p-3">
                  {importError}
                </div>
              )}
              
              <div className="text-xs text-slate-300 space-y-1.5 bg-slate-900 p-4 rounded-xl border border-white/5">
                <span className="font-semibold text-white block mb-1">CSV Header Format Guidelines:</span>
                <p className="flex items-center gap-1.5 flex-wrap">
                  Required column: <code className="bg-white/15 text-white font-mono px-1.5 py-0.5 rounded border border-white/5 font-semibold text-[11px]">Brand Name</code>
                </p>
                <div className="flex items-center gap-1.5 flex-wrap leading-relaxed">
                  Optional columns:
                  <code className="bg-white/10 text-slate-200 font-mono px-1.5 py-0.5 rounded border border-white/5 text-[11px]">Brand Type</code>
                  <code className="bg-white/10 text-slate-200 font-mono px-1.5 py-0.5 rounded border border-white/5 text-[11px]">Contact Person</code>
                  <code className="bg-white/10 text-slate-200 font-mono px-1.5 py-0.5 rounded border border-white/5 text-[11px]">Designation</code>
                  <code className="bg-white/10 text-slate-200 font-mono px-1.5 py-0.5 rounded border border-white/5 text-[11px]">Phone CC</code>
                  <code className="bg-white/10 text-slate-200 font-mono px-1.5 py-0.5 rounded border border-white/5 text-[11px]">Phone</code>
                  <code className="bg-white/10 text-slate-200 font-mono px-1.5 py-0.5 rounded border border-white/5 text-[11px]">Email</code>
                  <code className="bg-white/10 text-slate-200 font-mono px-1.5 py-0.5 rounded border border-white/5 text-[11px]">Website</code>
                  <code className="bg-white/10 text-slate-200 font-mono px-1.5 py-0.5 rounded border border-white/5 text-[11px]">Address</code>
                  <code className="bg-white/10 text-slate-200 font-mono px-1.5 py-0.5 rounded border border-white/5 text-[11px]">GST Number</code>
                  etc.
                </div>
              </div>

              <label className="border-2 border-dashed border-white/10 rounded-xl p-8 bg-slate-900/50 flex flex-col items-center justify-center cursor-pointer hover:bg-white/[0.02] hover:border-brand-500 transition group">
                <svg className="w-10 h-10 text-slate-500 mb-2 group-hover:text-brand-400 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m-9 1V4a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
                <span className="text-sm font-semibold text-slate-200 group-hover:text-brand-400 transition">Choose CSV File</span>
                <span className="text-xs text-slate-500 mt-1">or drag & drop it here</span>
                <input type="file" accept=".csv" onChange={handleCsvImport} className="hidden" disabled={importBusy} />
              </label>

              {importBusy && (
                <div className="text-center py-2 text-xs text-brand-400 font-bold flex items-center justify-center gap-1.5">
                  <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  Uploading and importing brands data...
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-white/5 px-6 py-4 bg-slate-950/40">
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                disabled={importBusy}
                className="rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition disabled:opacity-50 active:scale-[0.98]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { slugFromName } from "@/lib/attributeMeta";

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
  }[];
};

export default function SellerForm({
  brands,
  programs,
  seller,
}: {
  brands: BrandOption[];
  programs: ProgramOption[];
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
        contractStart: string;
        contractEnd: string;
        verified: boolean;
        remarks: string;
      }
    >
  >(() => {
    const initial: Record<string, any> = {};
    if (seller?.contracts) {
      for (const c of seller.contracts) {
        initial[c.programId] = {
          collaborationTenure: c.collaborationTenure ?? "",
          fitoutPeriod: c.fitoutPeriod ?? "",
          contractStart: c.contractStart ? c.contractStart.slice(0, 10) : "",
          contractEnd: c.contractEnd ? c.contractEnd.slice(0, 10) : "",
          verified: c.verified,
          remarks: c.remarks ?? "",
        };
      }
    }
    return initial;
  });

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
          fitoutPeriod: "",
          contractStart: "",
          contractEnd: "",
          verified: false,
          remarks: "",
        };
      }
      return next;
    });
  }

  // Handle contract field changes
  function updateContract(programId: string, field: string, value: any) {
    setActiveContracts((prev) => ({
      ...prev,
      [programId]: {
        ...prev[programId],
        [field]: value,
      },
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim() || !sellerCode.trim()) {
      setError("Seller Name and Seller Code are required");
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
  const card = "bg-white rounded-2xl border border-slate-200 p-6";

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
        <StepHeader
          n={2}
          title="Associated Brands"
          sub="Select the brands this seller is authorized to operate under"
        />
        {brands.length === 0 ? (
          <p className="text-sm text-slate-400">
            No active brands in this branch. Please ask the Branch Admin to activate brands.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {brands.map((b) => {
              const checked = selectedBrandIds.includes(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => toggleBrand(b.id)}
                  className={`flex items-center justify-between p-3.5 rounded-xl border text-left text-sm font-medium transition-all ${
                    checked
                      ? "border-brand-600 bg-brand-50/50 text-brand-900"
                      : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700"
                  }`}
                >
                  <div>
                    <div>{b.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">{b.code}</div>
                  </div>
                  <span
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      checked
                        ? "border-brand-600 bg-brand-600 text-white text-[10px]"
                        : "border-slate-300 bg-white"
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
                        : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
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

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={L}>Collaboration Tenure</label>
                          <input
                            value={details.collaborationTenure}
                            onChange={(e) =>
                              updateContract(p.id, "collaborationTenure", e.target.value)
                            }
                            className={I}
                            placeholder="e.g. 12 months"
                          />
                        </div>
                        <div>
                          <label className={L}>Fitout Period</label>
                          <input
                            value={details.fitoutPeriod}
                            onChange={(e) =>
                              updateContract(p.id, "fitoutPeriod", e.target.value)
                            }
                            className={I}
                            placeholder="e.g. 30 days"
                          />
                        </div>
                        <div>
                          <label className={L}>Contract Start Date</label>
                          <input
                            type="date"
                            value={details.contractStart}
                            onChange={(e) =>
                              updateContract(p.id, "contractStart", e.target.value)
                            }
                            className={I}
                          />
                        </div>
                        <div>
                          <label className={L}>Contract End Date</label>
                          <input
                            type="date"
                            value={details.contractEnd}
                            onChange={(e) =>
                              updateContract(p.id, "contractEnd", e.target.value)
                            }
                            className={I}
                          />
                        </div>
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
                    </div>
                  );
                })}

              {Object.keys(activeContracts).length === 0 && (
                <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl bg-white text-slate-400 text-sm">
                  Click a program button above to create a contract for it.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

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

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ProgramOption = {
  id: string;
  name: string;
  code: string;
};

type SellerOption = {
  id: string;
  name: string;
  sellerCode: string;
  programs: ProgramOption[];
};

type ExecOption = {
  id: string;
  fullName: string;
  email: string;
};

export default function AssignmentForm({
  sellers,
  execs,
}: {
  sellers: SellerOption[];
  execs: ExecOption[];
}) {
  const router = useRouter();
  const [sellerId, setSellerId] = useState("");
  const [programId, setProgramId] = useState("");
  const [execId, setExecId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedSeller = sellers.find((s) => s.id === sellerId);
  const programs = selectedSeller?.programs ?? [];

  function handleSellerChange(value: string) {
    setSellerId(value);
    // Reset the program whenever the seller changes — the program list is seller-specific.
    setProgramId("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!sellerId) {
      setError("Please select a seller.");
      return;
    }
    if (!programId) {
      setError("Please select a program.");
      return;
    }
    if (!execId) {
      setError("Please select an onboarding executive.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerId, programId, obExecUserId: execId }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Assignment failed");
        return;
      }

      router.push("/ops/assignments");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  const L = "block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1";
  const I = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white";

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-sm">
      <div>
        <button
          type="button"
          onClick={() => router.push("/ops/assignments")}
          className="text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          ‹ Back to Assignments
        </button>
        <h1 className="text-2xl font-bold mt-1 text-slate-900">Assign Seller</h1>
        <p className="text-sm text-slate-500">
          Link a seller operating under your branch to an Onboarding Executive.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className={L}>Select Seller *</label>
          <select
            value={sellerId}
            onChange={(e) => handleSellerChange(e.target.value)}
            required
            className={I}
          >
            <option value="">— Choose Seller —</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.sellerCode})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={L}>Select Program *</label>
          <select
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
            required
            disabled={!sellerId}
            className={`${I} disabled:bg-slate-50 disabled:text-slate-400`}
          >
            <option value="">
              {!sellerId
                ? "— Choose a seller first —"
                : programs.length === 0
                  ? "— No contracted programs —"
                  : "— Choose Program —"}
            </option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
          {sellerId && programs.length === 0 && (
            <p className="text-[11px] text-amber-600 mt-1">
              This seller has no contracted programs. Add a contract before assigning.
            </p>
          )}
        </div>

        <div>
          <label className={L}>Select Onboarding Executive *</label>
          <select
            value={execId}
            onChange={(e) => setExecId(e.target.value)}
            required
            className={I}
          >
            <option value="">— Choose Executive —</option>
            {execs.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.fullName} ({ex.email})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={() => router.push("/ops/assignments")}
          className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy || !sellerId || !programId || !execId}
          className="rounded-lg bg-brand-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-brand-700 disabled:opacity-60 transition-colors"
        >
          {busy ? "Assigning…" : "Assign Seller"}
        </button>
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Option = {
  id: string;
  name?: string;
  fullName?: string;
  sellerCode?: string;
  email?: string;
};

export default function AssignmentForm({
  sellers,
  execs,
}: {
  sellers: Option[];
  execs: Option[];
}) {
  const router = useRouter();
  const [sellerId, setSellerId] = useState("");
  const [execId, setExecId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!sellerId) {
      setError("Please select a seller.");
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
        body: JSON.stringify({ sellerId, obExecUserId: execId }),
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
            onChange={(e) => setSellerId(e.target.value)}
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
          disabled={busy}
          className="rounded-lg bg-brand-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-brand-700 disabled:opacity-60 transition-colors"
        >
          {busy ? "Assigning…" : "Assign Seller"}
        </button>
      </div>
    </form>
  );
}

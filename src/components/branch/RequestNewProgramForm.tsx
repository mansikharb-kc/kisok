"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RequestNewProgramForm({ branchId }: { branchId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name of new program is required");
      return;
    }
    if (!remarks.trim()) {
      setError("Remark (reason of new program) is required");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const res = await fetch("/api/change-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "NEW_PROGRAM",
          payload: { name: name.trim(), remarks: remarks.trim() },
          branchId,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError((data && data.error) || "Failed to submit program request");
        return;
      }

      router.push("/branch/programs");
      router.refresh();
    } catch {
      setError("Something went wrong. Please check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200 shadow-md p-6 sm:p-8 space-y-6"
      >
        <div className="space-y-2">
          <label htmlFor="programName" className="text-sm font-semibold text-slate-700 block">
            Name of New Program <span className="text-rose-500">*</span>
          </label>
          <input
            id="programName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Summer Special Onboarding"
            required
            disabled={busy}
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 transition-all"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="programRemarks" className="text-sm font-semibold text-slate-700 block">
            Remarks (Reason of new program) <span className="text-rose-500">*</span>
          </label>
          <textarea
            id="programRemarks"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Please explain why this new program is needed for your branch..."
            rows={5}
            required
            disabled={busy}
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 transition-all"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => router.push("/branch/programs")}
            disabled={busy}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-60"
          >
            {busy ? "Submitting..." : "Submit Request"}
          </button>
        </div>
      </form>
    </div>
  );
}

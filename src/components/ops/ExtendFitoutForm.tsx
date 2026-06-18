"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ExtendFitoutFormProps {
  assignmentId: string;
  currentFitoutDays: number;
}

export default function ExtendFitoutForm({ assignmentId, currentFitoutDays }: ExtendFitoutFormProps) {
  const router = useRouter();
  const [days, setDays] = useState<number | "">("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!days || Number(days) <= 0) {
      setError("Please enter a positive number of days.");
      return;
    }
    if (reason.trim().length < 5) {
      setError("Reason must be at least 5 characters long.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/extend-fitout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: Number(days), reason: reason.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to extend fitout");
        return;
      }

      setSuccess(true);
      setDays("");
      setReason("");
      router.refresh();
    } catch {
      setError("A network error occurred.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 flex flex-col h-full justify-between">
      <div className="space-y-4">
        <div>
          <h3 className="font-bold text-slate-800 text-sm">Request Fitout Period Extension</h3>
          <p className="text-xs text-slate-500 mt-1">Extend the current schedule ({currentFitoutDays} days) due to delays.</p>
        </div>

        {error && (
          <div className="rounded bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 font-medium">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded bg-emerald-50 border border-emerald-250 text-emerald-800 text-xs px-3 py-2 font-semibold">
            Fitout period successfully extended!
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Days to Extend</label>
            <input
              type="number"
              min="1"
              value={days}
              onChange={(e) => setDays(e.target.value === "" ? "" : Number(e.target.value))}
              required
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-900 bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-semibold"
              placeholder="e.g. 15"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Reason for Extension</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-900 bg-white"
              placeholder="e.g. Delayed site delivery"
            />
          </div>
        </div>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-slate-900 text-white px-4 py-2.5 text-xs font-semibold hover:bg-slate-800 disabled:opacity-60 transition"
        >
          {busy ? "Extending..." : "Submit Extension"}
        </button>
      </div>
    </form>
  );
}

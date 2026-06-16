"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import NewConsignmentForm, { type SellerOption } from "./NewConsignmentForm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type QcRecord = {
  id: string;
  result: string;
  notes: string | null;
  qcAt: string;
};

type Item = {
  id: string;
  description: string | null;
  expectedQty: number | null;
  receivedQty: number | null;
  sampleType: string | null;
  status: string;
  qcRecords: QcRecord[];
};

type Consignment = {
  id: string;
  status: string;
  spocName: string | null;
  spocContact: string | null;
  expectedDate: string | null;
  remarks: string | null;
  createdAt: string;
  seller: { name: string; sellerCode: string };
  brand: { name: string; code: string };
  items: Item[];
};

// ---------------------------------------------------------------------------
// Pipeline config
// ---------------------------------------------------------------------------

const PIPELINE = [
  "initiated",
  "received",
  "in_buffer",
  "fabricating",
  "qc",
  "passed_back",
  "closed",
] as const;

const STATUS_LABEL: Record<string, string> = {
  initiated: "Initiated",
  received: "Received",
  in_buffer: "In Buffer",
  fabricating: "Fabricating",
  qc: "QC",
  passed_back: "Passed Back",
  closed: "Closed",
};

const STATUS_BADGE: Record<string, string> = {
  initiated: "bg-blue-50 text-blue-700 border-blue-200",
  received: "bg-indigo-50 text-indigo-700 border-indigo-200",
  in_buffer: "bg-amber-50 text-amber-700 border-amber-200",
  fabricating: "bg-orange-50 text-orange-700 border-orange-200",
  qc: "bg-purple-50 text-purple-700 border-purple-200",
  passed_back: "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed: "bg-slate-100 text-slate-600 border-slate-200",
};

const QC_PILL: Record<string, string> = {
  pass: "bg-emerald-100 text-emerald-700",
  flag: "bg-amber-100 text-amber-700",
  repair: "bg-amber-100 text-amber-700",
  fabricate: "bg-rose-100 text-rose-700",
};

function nextStatus(status: string): string | null {
  const i = PIPELINE.indexOf(status as (typeof PIPELINE)[number]);
  if (i < 0 || i >= PIPELINE.length - 1) return null;
  return PIPELINE[i + 1];
}

// ---------------------------------------------------------------------------
// Stepper
// ---------------------------------------------------------------------------

function Stepper({ status }: { status: string }) {
  const current = PIPELINE.indexOf(status as (typeof PIPELINE)[number]);
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {PIPELINE.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={s} className="flex items-center gap-1">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide border ${
                active
                  ? STATUS_BADGE[s]
                  : done
                  ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                  : "bg-white/60 backdrop-blur-md text-slate-300 border-slate-200"
              }`}
            >
              {done ? "✓" : ""} {STATUS_LABEL[s]}
            </span>
            {i < PIPELINE.length - 1 && (
              <span className={`w-3 h-px ${i < current ? "bg-emerald-300" : "bg-slate-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main client
// ---------------------------------------------------------------------------

export default function ConsignmentsClient({
  initialConsignments,
  sellerOptions,
  branchName,
  canInitiate,
  canAdvance,
}: {
  initialConsignments: Consignment[];
  sellerOptions: SellerOption[];
  branchName: string | null;
  canInitiate: boolean;
  canAdvance: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const rows = initialConsignments;

  const statusCounts = useMemo(() => {
    return rows.reduce((acc: Record<string, number>, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {});
  }, [rows]);

  async function advance(c: Consignment) {
    const next = nextStatus(c.status);
    if (!next) return;
    setError("");
    setBusyId(c.id);
    try {
      const res = await fetch(`/api/consignments/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to advance status.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Consignments &amp; Quality Control</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track incoming samples through receiving, buffer, fabrication and QC for{" "}
            {branchName ?? "your branch"}.
          </p>
        </div>
        {canInitiate && (
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors shrink-0"
          >
            + New Consignment
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {PIPELINE.map((status) => (
          <div
            key={status}
            className={`rounded-xl border p-4 shadow-sm ${STATUS_BADGE[status]}`}
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider opacity-85 truncate">
              {STATUS_LABEL[status]}
            </div>
            <div className="text-2xl font-bold mt-0.5">{statusCounts[status] ?? 0}</div>
          </div>
        ))}
      </div>

      {/* List */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 backdrop-blur-md p-12 text-center">
          <p className="text-sm text-slate-400">No consignments yet.</p>
          {canInitiate && (
            <button
              onClick={() => setCreating(true)}
              className="mt-3 inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"
            >
              + Initiate the first consignment
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((c) => (
            <ConsignmentCard
              key={c.id}
              c={c}
              canAdvance={canAdvance}
              busy={busyId === c.id}
              onAdvance={() => advance(c)}
              onChanged={() => router.refresh()}
            />
          ))}
        </div>
      )}

      {/* New Consignment modal */}
      {creating && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 px-4 py-10 overflow-y-auto">
          <div className="bg-white/60 backdrop-blur-md rounded-xl shadow-xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Initiate Consignment</h3>
              <button
                onClick={() => setCreating(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <NewConsignmentForm
              sellers={sellerOptions}
              onCancel={() => setCreating(false)}
              onCreated={() => {
                setCreating(false);
                router.refresh();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Consignment card
// ---------------------------------------------------------------------------

function ConsignmentCard({
  c,
  canAdvance,
  busy,
  onAdvance,
  onChanged,
}: {
  c: Consignment;
  canAdvance: boolean;
  busy: boolean;
  onAdvance: () => void;
  onChanged: () => void;
}) {
  const next = nextStatus(c.status);

  return (
    <div className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">{c.seller.name}</span>
            <span className="text-xs text-slate-400 font-mono">#{c.id}</span>
            <span
              className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold uppercase border ${
                STATUS_BADGE[c.status] ?? "bg-white/60 backdrop-blur-md border-slate-200"
              }`}
            >
              {STATUS_LABEL[c.status] ?? c.status}
            </span>
          </div>
          <div className="text-xs text-slate-500">
            Brand: <span className="font-medium text-slate-700">{c.brand.name}</span>
            {c.spocName && (
              <>
                {" · "}SPOC: <span className="text-slate-700">{c.spocName}</span>
                {c.spocContact ? ` (${c.spocContact})` : ""}
              </>
            )}
            {c.expectedDate && (
              <>
                {" · "}Expected:{" "}
                <span className="text-slate-700">
                  {new Date(c.expectedDate).toLocaleDateString()}
                </span>
              </>
            )}
          </div>
        </div>
        {canAdvance && next && (
          <button
            onClick={onAdvance}
            disabled={busy}
            className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60 transition-colors"
          >
            {busy ? "Advancing…" : `Advance → ${STATUS_LABEL[next]}`}
          </button>
        )}
      </div>

      {/* Stepper */}
      <div className="px-5 py-3 border-b border-slate-100">
        <Stepper status={c.status} />
      </div>

      {/* Items */}
      <div className="px-5 py-4">
        {c.items.length === 0 ? (
          <p className="text-sm text-slate-400">No expected sample items recorded.</p>
        ) : (
          <div className="space-y-2">
            {c.items.map((item) => (
              <ItemRow key={item.id} item={item} canAdvance={canAdvance} onChanged={onChanged} />
            ))}
          </div>
        )}
        {c.remarks && (
          <p className="mt-3 text-xs text-slate-500 italic border-t border-slate-100 pt-3">
            Remarks: {c.remarks}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Item row (with received qty + QC controls for Consignment User)
// ---------------------------------------------------------------------------

function ItemRow({
  item,
  canAdvance,
  onChanged,
}: {
  item: Item;
  canAdvance: boolean;
  onChanged: () => void;
}) {
  const [qty, setQty] = useState<string>(item.receivedQty?.toString() ?? "");
  const [qcNotes, setQcNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const lastQc = item.qcRecords?.[0];

  async function saveQty() {
    if (qty === (item.receivedQty?.toString() ?? "")) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/consignment-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receivedQty: qty === "" ? null : Number(qty) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Failed to save quantity.");
        return;
      }
      onChanged();
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function recordQc(result: "pass" | "flag" | "repair" | "fabricate") {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/consignment-items/${item.id}/qc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result, notes: qcNotes.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Failed to record QC.");
        return;
      }
      setQcNotes("");
      onChanged();
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200/70 bg-slate-50/50 p-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-slate-800 text-sm">{item.description}</div>
          <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
            <span>Type: {item.sampleType || "Sample"}</span>
            <span>·</span>
            <span>
              Received: {item.receivedQty ?? 0} / {item.expectedQty ?? 0}
            </span>
            <span>·</span>
            <span className="capitalize">Item: {item.status}</span>
          </div>
        </div>
        {lastQc && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                QC_PILL[lastQc.result] ?? "bg-slate-100 text-slate-600"
              }`}
            >
              QC: {lastQc.result}
            </span>
            {lastQc.notes && (
              <span className="text-[10px] text-slate-400 truncate max-w-[180px]">
                ({lastQc.notes})
              </span>
            )}
          </div>
        )}
      </div>

      {canAdvance && (
        <div className="mt-3 pt-3 border-t border-slate-200/70 flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Received qty */}
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Received Qty
            </label>
            <input
              type="number"
              min={0}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              onBlur={saveQty}
              disabled={busy}
              className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-100"
            />
          </div>

          {/* QC */}
          <div className="flex flex-1 flex-col sm:flex-row sm:items-center gap-2">
            <input
              value={qcNotes}
              onChange={(e) => setQcNotes(e.target.value)}
              placeholder="QC notes (optional)"
              disabled={busy}
              className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-100"
            />
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => recordQc("pass")}
                disabled={busy}
                className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                Pass
              </button>
              <button
                onClick={() => recordQc("flag")}
                disabled={busy}
                className="rounded-md bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
              >
                Flag
              </button>
              <button
                onClick={() => recordQc("repair")}
                disabled={busy}
                className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
              >
                Repair
              </button>
              <button
                onClick={() => recordQc("fabricate")}
                disabled={busy}
                className="rounded-md bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                Fabricate
              </button>
            </div>
          </div>
        </div>
      )}

      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
    </div>
  );
}

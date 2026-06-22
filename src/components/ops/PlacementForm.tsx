"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type RecordOption = {
  id: string;
  status: string;
  product: { name: string; sku: string; category: { name: string } };
  seller: { name: string; sellerCode: string };
  programId: string;
};
type LocationOption = { id: string; name: string; locationId: string | null; path: string | null; programId: string | null };
type SizeOption = { id: string; label: string };

type CopyRow = { sampleSizeId: string; isMaster: boolean };

export default function PlacementForm({
  records,
  locations,
  sizes,
}: {
  records: RecordOption[];
  locations: LocationOption[];
  sizes: SizeOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [recordId, setRecordId] = useState("");
  const [locationNodeId, setLocationNodeId] = useState("");
  const [rows, setRows] = useState<CopyRow[]>([{ sampleSizeId: "", isMaster: false }]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const canPlace = records.length > 0 && locations.length > 0;

  const selectedRecord = useMemo(() => {
    return records.find((r) => String(r.id) === recordId) ?? null;
  }, [records, recordId]);

  const filteredLocations = useMemo(() => {
    if (!selectedRecord) return [];
    return locations.filter(
      (l) => l.programId === null || String(l.programId) === String(selectedRecord.programId)
    );
  }, [locations, selectedRecord]);

  function reset() {
    setRecordId("");
    setLocationNodeId("");
    setRows([{ sampleSizeId: "", isMaster: false }]);
    setError("");
  }

  function setCount(n: number) {
    const next = Math.max(1, Math.min(100, n));
    setRows((prev) => {
      const copy = [...prev];
      if (next > copy.length) {
        while (copy.length < next) copy.push({ sampleSizeId: "", isMaster: false });
      } else {
        copy.length = next;
        // If the demoted rows held the master, clear it.
        if (!copy.some((r) => r.isMaster)) {
          /* nothing — single-master still satisfied */
        }
      }
      return copy;
    });
  }

  function setMaster(idx: number) {
    setRows((prev) => prev.map((r, i) => ({ ...r, isMaster: i === idx ? !r.isMaster : false })));
  }

  function setSize(idx: number, val: string) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, sampleSizeId: val } : r)));
  }

  const masterCount = useMemo(() => rows.filter((r) => r.isMaster).length, [rows]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!recordId) return setError("Please select an onboarded product.");
    if (!locationNodeId) return setError("Please select a placement-eligible location.");
    if (masterCount > 1) return setError("Only one copy may be marked UNIQUE.");

    const payload = {
      localRecordId: recordId,
      locationNodeId,
      copies: rows.map((r) => ({
        sampleSizeId: r.sampleSizeId || undefined,
        role: r.isMaster ? "UNIQUE" : "COPY",
      })),
    };

    setBusy(true);
    try {
      const res = await fetch("/api/product-copies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Placement failed");
        return;
      }
      setOpen(false);
      reset();
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  const L = "block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1";
  const I = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white/60 backdrop-blur-md";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
      >
        + Place Product
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4">
          <form
            onSubmit={submit}
            className="mt-10 w-full max-w-2xl rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-md p-6 shadow-xl space-y-6"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Place Product Units</h2>
                <p className="text-sm text-slate-500">
                  Generate physical units (with QR) of an onboarded product into a warehouse location.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                className="text-slate-400 hover:text-slate-700 text-xl leading-none"
              >
                ×
              </button>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
                {error}
              </div>
            )}

            {!canPlace && (
              <div className="rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-sm px-3 py-2">
                {records.length === 0
                  ? "No onboarded products are available for your assigned sellers."
                  : "No placement-eligible locations exist in your branch yet."}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className={L}>Onboarded Product *</label>
                <select value={recordId} onChange={(e) => setRecordId(e.target.value)} required className={I}>
                  <option value="">— Choose product —</option>
                  {records.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.product.name} ({r.product.sku}) · {r.seller.name} · {r.product.category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={L}>Placement Location *</label>
                <select
                  value={locationNodeId}
                  onChange={(e) => setLocationNodeId(e.target.value)}
                  required
                  disabled={!recordId}
                  className={I}
                >
                  <option value="">
                    {!recordId ? "— Choose product first —" : "— Choose location —"}
                  </option>
                  {filteredLocations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} {l.locationId ? `(${l.locationId})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={L}>Number of Units</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={rows.length}
                  onChange={(e) => setCount(parseInt(e.target.value || "1", 10))}
                  className={`${I} max-w-[140px]`}
                />
              </div>

              {/* Per-copy config */}
              <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
                <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <div className="col-span-1">#</div>
                  <div className="col-span-6">Sample Size</div>
                  <div className="col-span-5">Role</div>
                </div>
                {rows.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2.5 items-center">
                    <div className="col-span-1 text-xs font-mono text-slate-500">{idx + 1}</div>
                    <div className="col-span-6">
                      <select
                        value={row.sampleSizeId}
                        onChange={(e) => setSize(idx, e.target.value)}
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs bg-white/60 backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="">— No size —</option>
                        {sizes.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-5 flex items-center gap-2 md:gap-3">
                      <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={row.isMaster}
                          onChange={() => {
                            if (!row.isMaster) setMaster(idx);
                          }}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                        />
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase transition-all duration-150 ${
                            row.isMaster ? "bg-indigo-100 text-indigo-700 font-extrabold" : "bg-slate-100/50 text-slate-400"
                          }`}
                        >
                          UNIQUE
                        </span>
                      </label>

                      <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={!row.isMaster}
                          onChange={() => {
                            if (row.isMaster) setMaster(idx);
                          }}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                        />
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase transition-all duration-150 ${
                            !row.isMaster ? "bg-slate-200 text-slate-700 font-extrabold" : "bg-slate-100/50 text-slate-400"
                          }`}
                        >
                          COPY
                        </span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-400">
                At most one unit may be UNIQUE. If a unique copy already exists for this product in your branch and you
                mark a new one, the previous unique copy is demoted to COPY automatically.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !canPlace}
                className="rounded-lg bg-brand-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-brand-700 disabled:opacity-60 transition-colors"
              >
                {busy ? "Placing…" : `Place ${rows.length} unit${rows.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

"use client";

import { useMemo, useState } from "react";

export type BrandOption = { id: string; name: string; code: string };
export type SellerOption = {
  id: string;
  name: string;
  sellerCode: string;
  brands: BrandOption[];
};

type ItemDraft = { description: string; expectedQty: string; sampleType: string };

const emptyItem = (): ItemDraft => ({ description: "", expectedQty: "", sampleType: "" });

export default function NewConsignmentForm({
  sellers,
  onCancel,
  onCreated,
}: {
  sellers: SellerOption[];
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [sellerId, setSellerId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [spocName, setSpocName] = useState("");
  const [spocContact, setSpocContact] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const selectedSeller = useMemo(
    () => sellers.find((s) => s.id === sellerId) ?? null,
    [sellers, sellerId]
  );
  const brandOptions = selectedSeller?.brands ?? [];

  function pickSeller(id: string) {
    setSellerId(id);
    setBrandId(""); // reset brand whenever seller changes
  }

  function updateItem(idx: number, field: keyof ItemDraft, value: string) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(idx: number) {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!sellerId) return setError("Please select a seller.");
    if (!brandId) return setError("Please select a brand.");

    const cleanItems = items
      .filter((it) => it.description.trim())
      .map((it) => ({
        description: it.description.trim(),
        expectedQty: it.expectedQty === "" ? null : Number(it.expectedQty),
        sampleType: it.sampleType.trim() || null,
      }));

    if (cleanItems.length === 0) {
      return setError("Add at least one expected sample item.");
    }

    setBusy(true);
    try {
      const res = await fetch("/api/consignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerId,
          brandId,
          spocName: spocName.trim() || null,
          spocContact: spocContact.trim() || null,
          expectedDate: expectedDate || null,
          remarks: remarks.trim() || null,
          items: cleanItems,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create consignment.");
        return;
      }
      onCreated();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  const L = "block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1";
  const I =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-100";

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={L}>Seller *</label>
          <select value={sellerId} onChange={(e) => pickSeller(e.target.value)} required className={I}>
            <option value="">Select a seller…</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.sellerCode})
              </option>
            ))}
          </select>
          {sellers.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">No active sellers in this branch.</p>
          )}
        </div>

        <div>
          <label className={L}>Brand *</label>
          <select
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            required
            disabled={!selectedSeller}
            className={I}
          >
            <option value="">{selectedSeller ? "Select a brand…" : "Pick a seller first"}</option>
            {brandOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          {selectedSeller && brandOptions.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">This seller has no associated brands.</p>
          )}
        </div>

        <div>
          <label className={L}>SPOC Name</label>
          <input value={spocName} onChange={(e) => setSpocName(e.target.value)} className={I} />
        </div>
        <div>
          <label className={L}>SPOC Contact</label>
          <input
            value={spocContact}
            onChange={(e) => setSpocContact(e.target.value)}
            className={I}
            placeholder="Phone / email"
          />
        </div>
        <div>
          <label className={L}>Expected Date</label>
          <input
            type="date"
            value={expectedDate}
            onChange={(e) => setExpectedDate(e.target.value)}
            className={I}
          />
        </div>
        <div>
          <label className={L}>Remarks</label>
          <input value={remarks} onChange={(e) => setRemarks(e.target.value)} className={I} />
        </div>
      </div>

      {/* Expected items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={L + " mb-0"}>Expected Sample Items *</label>
          <button
            type="button"
            onClick={addItem}
            className="text-xs text-brand-600 font-semibold hover:underline"
          >
            + Add item
          </button>
        </div>
        <div className="space-y-2">
          {items.map((it, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                value={it.description}
                onChange={(e) => updateItem(idx, "description", e.target.value)}
                placeholder="Description"
                className={I + " flex-1"}
              />
              <input
                value={it.sampleType}
                onChange={(e) => updateItem(idx, "sampleType", e.target.value)}
                placeholder="Type"
                className={I + " w-32"}
              />
              <input
                type="number"
                min={0}
                value={it.expectedQty}
                onChange={(e) => updateItem(idx, "expectedQty", e.target.value)}
                placeholder="Qty"
                className={I + " w-20"}
              />
              <button
                type="button"
                onClick={() => removeItem(idx)}
                disabled={items.length === 1}
                className="text-slate-400 hover:text-rose-600 disabled:opacity-30 text-sm px-1"
                aria-label="Remove item"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand-600 text-white px-5 py-2 text-sm font-semibold hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? "Creating…" : "Initiate Consignment"}
        </button>
      </div>
    </form>
  );
}

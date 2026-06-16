"use client";

import { useState } from "react";
import { isNonEmptyString } from "@/lib/validation";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

type SampleSize = {
  id: string;
  branchId: string;
  label: string;
  dimensions: string | null;
  status: string;
  createdAt: string;
  _count: { copies: number };
};

export default function SampleSizesClient({
  initialSizes,
  branchId,
  branchName,
}: {
  initialSizes: SampleSize[];
  branchId: string;
  branchName: string;
}) {
  const router = useRouter();
  const [sizes, setSizes] = useState<SampleSize[]>(initialSizes);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSize, setEditingSize] = useState<SampleSize | null>(null);
  const [viewOnly, setViewOnly] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Form State
  const [label, setLabel] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [status, setStatus] = useState("active");

  function openCreate() {
    setEditingSize(null);
    setViewOnly(false);
    setLabel("");
    setDimensions("");
    setStatus("active");
    setError("");
    setModalOpen(true);
  }

  function openEdit(size: SampleSize) {
    setEditingSize(size);
    setViewOnly(false);
    setLabel(size.label);
    setDimensions(size.dimensions ?? "");
    setStatus(size.status);
    setError("");
    setModalOpen(true);
  }

  function openView(size: SampleSize) {
    setEditingSize(size);
    setViewOnly(true);
    setLabel(size.label);
    setDimensions(size.dimensions ?? "");
    setStatus(size.status);
    setError("");
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (viewOnly) return;
    // Validate required label
    if (!isNonEmptyString(label)) {
      setError("Label is required");
      return;
    }
    setError("");
    setBusy(true);

    try {
      const url = editingSize ? `/api/sample-sizes/${editingSize.id}` : "/api/sample-sizes";
      const method = editingSize ? "PATCH" : "POST";
      const body = {
        branchId,
        label,
        dimensions: dimensions || null,
        status,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save sample size.");
        return;
      }

      setModalOpen(false);
      router.refresh();
      // Optimistically update or just let refresh handle it (we'll fetch next reload).
      // Since router.refresh() works asynchronously, we update local state on success too
      if (editingSize) {
        setSizes((prev) =>
          prev.map((s) => (s.id === editingSize.id ? { ...s, label, dimensions: dimensions || null, status } : s))
        );
      } else {
        const newSize = data.sampleSize;
        setSizes((prev) => [...prev, { ...newSize, _count: { copies: 0 } }].sort((a, b) => a.label.localeCompare(b.label)));
      }
    } catch {
      setError("Network communication failure.");
    } finally {
      setBusy(false);
    }
  }

  const totalSizes = sizes.length;
  const activeCount = sizes.filter((s) => s.status === "active").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sample Sizes</h1>
          <p className="text-sm text-slate-500 mt-1">
            Controlled sample size catalogue for {branchName}.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          + Add Sample Size
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Sizes</div>
          <div className="text-3xl font-bold mt-1 text-slate-900">{totalSizes}</div>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Active</div>
          <div className="text-3xl font-bold mt-1 text-emerald-700">{activeCount}</div>
        </div>
      </div>

      {/* Table */}
      {sizes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-sm text-slate-400">No sample sizes defined yet.</p>
          <button
            onClick={openCreate}
            className="mt-3 inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"
          >
            + Add the first size
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Label</th>
                <th className="px-4 py-3 text-left font-medium">Dimensions</th>
                <th className="px-4 py-3 text-left font-medium">Copies using this size</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sizes.map((s) => (
                <tr key={s.id} className={`hover:bg-slate-50 transition-colors ${s.status !== "active" ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3 align-middle font-semibold text-slate-800">{s.label}</td>
                  <td className="px-4 py-3 align-middle text-slate-600 font-mono text-xs">
                    {s.dimensions ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                      {s._count?.copies ?? 0}
                      <span className="text-xs text-slate-400 font-normal">copies</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        s.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${s.status === "active" ? "bg-emerald-500" : "bg-slate-300"}`} />
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openView(s)}
                        className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-600 transition-colors"
                      >
                        View
                      </button>
                      <button
                        onClick={() => openEdit(s)}
                        className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-600 transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Form */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 px-4 py-10 overflow-y-auto">
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">
                {viewOnly
                  ? `View Size — ${editingSize?.label}`
                  : editingSize
                  ? `Edit Size — ${editingSize.label}`
                  : "Add Sample Size"}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
                {error}
              </div>
            )}

            {/* Label */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Label <span className="text-red-500">*</span></label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
                disabled={viewOnly}
                autoFocus={!viewOnly}
                placeholder="e.g. A4, 300x300mm, Hero Tile"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>

            {/* Dimensions */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Dimensions <span className="text-slate-400 font-normal">(optional)</span></label>
              <input
                value={dimensions}
                onChange={(e) => setDimensions(e.target.value)}
                placeholder="e.g. 210 x 297 mm"
                disabled={viewOnly}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>

            {/* Status */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Status <span className="text-red-500">*</span></label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                required
                disabled={viewOnly}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-500"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
              >
                {viewOnly ? "Close" : "Cancel"}
              </button>
              {!viewOnly && (
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-60"
                >
                  {busy ? "Saving…" : "Save"}
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

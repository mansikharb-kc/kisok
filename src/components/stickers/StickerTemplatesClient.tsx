"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type CategoryOption = {
  id: string;
  name: string;
  code: string;
};

export type Elements = {
  brandLogo: boolean;
  branchName: boolean;
  productName: boolean;
  category: boolean;
  attributes: boolean;
  locationId: boolean;
  sku: boolean;
  qr: boolean;
};

export type TemplateRow = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  categoryCode: string | null;
  elements: Elements;
  status: string;
};

// The 8 toggleable label elements, in display order, with friendly labels.
const ELEMENT_DEFS: { key: keyof Elements; label: string }[] = [
  { key: "brandLogo", label: "Brand Logo" },
  { key: "branchName", label: "Branch Name" },
  { key: "productName", label: "Product Name" },
  { key: "category", label: "Category" },
  { key: "attributes", label: "Attributes" },
  { key: "locationId", label: "Location ID" },
  { key: "sku", label: "SKU" },
  { key: "qr", label: "QR Code" },
];

const DEFAULT_ELEMENTS: Elements = {
  brandLogo: true,
  branchName: true,
  productName: true,
  category: true,
  attributes: false,
  locationId: true,
  sku: true,
  qr: true,
};

type Draft = {
  id?: string;
  name: string;
  categoryId: string;
  elements: Elements;
  status: string;
};

const emptyDraft = (): Draft => ({
  name: "",
  categoryId: "",
  elements: { ...DEFAULT_ELEMENTS },
  status: "active",
});

export default function StickerTemplatesClient({
  initial,
  categories,
  readOnly = false,
}: {
  initial: TemplateRow[];
  categories: CategoryOption[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return initial;
    return initial.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.categoryName.toLowerCase().includes(q) ||
        (t.categoryCode ?? "").toLowerCase().includes(q),
    );
  }, [initial, query]);

  function openCreate() {
    setDraft(emptyDraft());
    setError(null);
    setModalOpen(true);
  }

  function openEdit(t: TemplateRow) {
    setDraft({
      id: t.id,
      name: t.name,
      categoryId: t.categoryId,
      elements: { ...DEFAULT_ELEMENTS, ...t.elements },
      status: t.status,
    });
    setError(null);
    setModalOpen(true);
  }

  async function save() {
    if (!draft.name.trim()) {
      setError("Template name is required.");
      return;
    }
    if (!draft.categoryId) {
      setError("Please select a category.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const isEdit = Boolean(draft.id);
      const res = await fetch(isEdit ? `/api/sticker-templates/${draft.id}` : "/api/sticker-templates", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name.trim(),
          categoryId: draft.categoryId,
          elements: draft.elements,
          status: draft.status,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Failed to save template.");
        return;
      }
      setModalOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function patch(t: TemplateRow, body: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch(`/api/sticker-templates/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(t: TemplateRow) {
    if (!confirm(`Delete sticker template "${t.name}"? If already used to print stickers it will be deactivated instead.`))
      return;
    setBusy(true);
    try {
      await fetch(`/api/sticker-templates/${t.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const emptyState = (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-400">
      {readOnly ? (
        "No sticker templates defined yet."
      ) : (
        <>
          No sticker templates yet. Click <strong>New Template</strong> to add one.
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative max-w-md flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">Search</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates or category..."
            className="w-full rounded-lg border border-slate-300 py-2 pl-16 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex items-center gap-3 lg:ml-auto">
          <span className="text-sm text-slate-500">{initial.length} total</span>
          {!readOnly && (
            <button
              type="button"
              onClick={openCreate}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              + New Template
            </button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        emptyState
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Template</th>
                <th className="px-4 py-3 text-left font-medium">Category</th>
                <th className="px-4 py-3 text-left font-medium">Elements</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                {!readOnly && <th className="px-4 py-3 text-right font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((t) => {
                const enabled = ELEMENT_DEFS.filter((d) => t.elements[d.key]);
                return (
                  <tr key={t.id} className={`hover:bg-slate-50 ${t.status === "inactive" ? "opacity-60" : ""}`}>
                    <td className="px-4 py-3 align-middle font-semibold text-slate-800">{t.name}</td>
                    <td className="px-4 py-3 align-middle">
                      <div className="text-slate-700">{t.categoryName}</div>
                      {t.categoryCode ? <div className="font-mono text-[11px] text-slate-400">{t.categoryCode}</div> : null}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      {enabled.length === 0 ? (
                        <span className="text-slate-300">none</span>
                      ) : (
                        <div className="flex max-w-[320px] flex-wrap gap-1">
                          {enabled.map((d) => (
                            <span key={d.key} className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] text-brand-700">
                              {d.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${
                          t.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${t.status === "active" ? "bg-emerald-500" : "bg-slate-300"}`} />
                        {t.status}
                      </span>
                    </td>
                    {!readOnly && (
                      <td className="px-4 py-3 align-middle text-right whitespace-nowrap">
                        <div className="inline-flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(t)}
                            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => patch(t, { status: t.status === "active" ? "inactive" : "active" })}
                            disabled={busy}
                            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                          >
                            {t.status === "active" ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(t)}
                            disabled={busy}
                            className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && !readOnly && (
        <TemplateModal
          draft={draft}
          setDraft={setDraft}
          categories={categories}
          busy={busy}
          error={error}
          onClose={() => setModalOpen(false)}
          onSave={save}
        />
      )}
    </div>
  );
}

function TemplateModal({
  draft,
  setDraft,
  categories,
  busy,
  error,
  onClose,
  onSave,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  categories: CategoryOption[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [catQuery, setCatQuery] = useState("");

  const selectedCat = categories.find((c) => c.id === draft.categoryId) ?? null;

  // Searchable picker: filter client-side and cap to 50 shown (6k+ categories).
  const matches = useMemo(() => {
    const q = catQuery.trim().toLowerCase();
    const base = q
      ? categories.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
      : categories;
    return { list: base.slice(0, 50), total: base.length };
  }, [categories, catQuery]);

  const enabledLabels = ELEMENT_DEFS.filter((d) => draft.elements[d.key]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 py-10">
      <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{draft.id ? "Edit Sticker Template" : "New Sticker Template"}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Template Name</label>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. Apparel — Standard Label"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Category</label>
            {selectedCat ? (
              <div className="flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-800">{selectedCat.name}</div>
                  <div className="font-mono text-[11px] text-slate-400">{selectedCat.code}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDraft({ ...draft, categoryId: "" });
                    setCatQuery("");
                  }}
                  className="ml-3 shrink-0 text-xs font-medium text-brand-600 hover:underline"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <input
                  value={catQuery}
                  onChange={(e) => setCatQuery(e.target.value)}
                  placeholder="Search categories by name or code..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-slate-200">
                  {matches.list.length === 0 ? (
                    <div className="px-3 py-4 text-center text-sm text-slate-400">No matching categories.</div>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {matches.list.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => setDraft({ ...draft, categoryId: c.id })}
                            className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50"
                          >
                            <span className="truncate text-sm text-slate-700">{c.name}</span>
                            <span className="ml-3 shrink-0 font-mono text-[11px] text-slate-400">{c.code}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {matches.total > matches.list.length ? (
                  <p className="mt-1 text-[11px] text-slate-400">
                    Showing {matches.list.length} of {matches.total} — refine your search to narrow down.
                  </p>
                ) : null}
              </>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Label Elements</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
              {ELEMENT_DEFS.map((d) => (
                <label
                  key={d.key}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={draft.elements[d.key]}
                    onChange={(e) => setDraft({ ...draft, elements: { ...draft.elements, [d.key]: e.target.checked } })}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-slate-700">{d.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
            <select
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Live preview of what the printed label will include. */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Label Preview</div>
            {enabledLabels.length === 0 ? (
              <div className="text-sm text-slate-400">No elements enabled — the label would be blank.</div>
            ) : (
              <ul className="space-y-1 text-sm text-slate-700">
                {enabledLabels.map((d) => (
                  <li key={d.key} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                    {d.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={busy}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? "Saving..." : draft.id ? "Save Changes" : "Create Template"}
          </button>
        </div>
      </div>
    </div>
  );
}

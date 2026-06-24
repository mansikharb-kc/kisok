"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import IconButton from "@/components/ui/IconButton";
import StickerRender, { type RenderRow } from "@/components/stickers/StickerRender";
import {
  BASE_META,
  FIELD_SOURCE_LABELS,
  STICKER_BASES,
  basePreset,
  newFieldRow,
  normalizeLayout,
  QR_LINK_TOKENS,
  type FieldSource,
  type StickerBase,
  type StickerField,
  type StickerLayout,
} from "@/lib/stickerLayout";

export type CategoryOption = { id: string; name: string; code: string };

export type Elements = Record<string, boolean>;

export type TemplateRow = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  categoryCode: string | null;
  elements: Elements;
  layout: unknown | null;
  status: string;
};

type CatAttribute = { id: string; name: string; code: string };

type Draft = {
  id?: string;
  name: string;
  categoryId: string;
  layout: StickerLayout;
  status: string;
};

const emptyDraft = (): Draft => ({
  name: "",
  categoryId: "",
  layout: basePreset("laminate"),
  status: "active",
});

function MiniaturePreview({ layout, previewRows, onClick }: { layout: any; previewRows: any; onClick: () => void }) {
  const scale = layout.base === "pioneer" ? 0.16 : 0.22;
  return (
    <div
      onClick={onClick}
      className="w-[75px] h-[55px] border border-slate-200 rounded bg-white shadow-sm overflow-hidden flex items-center justify-center relative cursor-pointer hover:border-brand-500 hover:shadow transition group select-none"
      title="Click to duplicate / direct add template"
    >
      <div 
        style={{ 
          transform: `scale(${scale})`, 
          transformOrigin: "center center",
          flexShrink: 0
        }}
        className="pointer-events-none"
      >
        <StickerRender
          layout={layout}
          rows={previewRows}
          brandName="Brand"
          qrUrl={null}
          barcodeValue="SKU-0001"
          bottomCode="D28.05"
        />
      </div>
      {/* Overlay indicator */}
      <div className="absolute inset-0 bg-brand-500/10 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
        <span className="bg-brand-600 text-white text-[9px] px-1 py-0.5 rounded font-bold shadow uppercase tracking-wide">
          + Add
        </span>
      </div>
    </div>
  );
}

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
      layout: normalizeLayout(t.layout),
      status: t.status,
    });
    setError(null);
    setModalOpen(true);
  }

  function openDuplicate(t: TemplateRow) {
    setDraft({
      name: `${t.name} (copy)`,
      categoryId: t.categoryId,
      layout: normalizeLayout(t.layout),
      status: "active",
    });
    setError(null);
    setModalOpen(true);
  }

  async function save() {
    if (!draft.name.trim()) return setError("Template name is required.");
    if (!draft.categoryId) return setError("Please select a category.");
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
          layout: draft.layout,
          status: draft.status,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        return setError(data?.error ?? "Failed to save template.");
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
    if (!confirm(`Delete sticker template "${t.name}"? If already used to print stickers it will be deactivated instead.`)) return;
    setBusy(true);
    try {
      await fetch(`/api/sticker-templates/${t.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const emptyState = (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 backdrop-blur-md p-12 text-center text-sm text-slate-400">
      {readOnly ? "No sticker templates defined yet." : <>No sticker templates yet. Click <strong>New Template</strong> to add one.</>}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative max-w-md flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates or category..."
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex items-center gap-3 lg:ml-auto">
          <span className="text-sm text-slate-500">{initial.length} total</span>
          {!readOnly && (
            <button type="button" onClick={openCreate} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
              + New Template
            </button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        emptyState
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md overflow-hidden">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium w-[22%]">Template</th>
                <th className="px-4 py-3 text-left font-medium w-[22%]">Category</th>
                <th className="px-4 py-3 text-left font-medium w-[14%]">Base design</th>
                <th className="px-4 py-3 text-left font-medium w-[12%]">Status</th>
                <th className="px-4 py-3 text-left font-medium w-[14%]">Preview</th>
                {!readOnly && <th className="px-4 py-3 text-right font-medium w-[16%]">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((t) => {
                const layout = normalizeLayout(t.layout);
                const previewRows: RenderRow[] = layout.fields.map((f) => {
                  let value = "";
                  if (f.source === "static") value = f.staticText || "";
                  else if (f.source === "attribute") value = "(attr)";
                  else if (f.source === "productName") value = "Sample Product";
                  else if (f.source === "sku") value = "SKU-0001";
                  else if (f.source === "brandName") value = "Brand";
                  else if (f.source === "instanceCode") value = "SKU-KCONE-0001";
                  return { id: f.id, label: f.label, value };
                });

                return (
                  <tr key={t.id} className={`hover:bg-slate-50 ${t.status === "inactive" ? "opacity-60" : ""}`}>
                    <td className="px-4 py-3 align-middle font-semibold text-slate-800 truncate">{t.name}</td>
                    <td className="px-4 py-3 align-middle">
                      <div className="text-slate-700 truncate">{t.categoryName}</div>
                      {t.categoryCode ? <div className="font-mono text-[11px] text-slate-400">{t.categoryCode}</div> : null}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700 capitalize">{layout.base}</span>
                      <span className="ml-2 text-[11px] text-slate-400">{layout.fields.length} fields</span>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-white capitalize ${t.status === "active" ? "bg-emerald-600" : "bg-slate-500"}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <MiniaturePreview
                        layout={layout}
                        previewRows={previewRows}
                        onClick={() => openDuplicate(t)}
                      />
                    </td>
                    {!readOnly && (
                      <td className="px-4 py-3 align-middle text-right">
                        <div className="inline-flex justify-end gap-1.5">
                          <IconButton kind="edit" title="Edit" tone="primary" onClick={() => openEdit(t)} />
                          <IconButton kind="add" title="Duplicate" onClick={() => openDuplicate(t)} />
                          <IconButton kind={t.status === "active" ? "retire" : "activate"} title={t.status === "active" ? "Deactivate" : "Activate"} onClick={() => patch(t, { status: t.status === "active" ? "inactive" : "active" })} disabled={busy} />
                          <IconButton kind="delete" title="Delete" tone="danger" onClick={() => remove(t)} disabled={busy} />
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

// ---------------------------------------------------------------------------

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
  const [attrs, setAttrs] = useState<CatAttribute[]>([]);
  const [attrsLoading, setAttrsLoading] = useState(false);

  const selectedCat = categories.find((c) => c.id === draft.categoryId) ?? null;

  const matches = useMemo(() => {
    const q = catQuery.trim().toLowerCase();
    const base = q ? categories.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)) : categories;
    return { list: base.slice(0, 50), total: base.length };
  }, [categories, catQuery]);

  // Load the category's attributes for mapping field rows.
  useEffect(() => {
    if (!draft.categoryId) {
      setAttrs([]);
      return;
    }
    let active = true;
    setAttrsLoading(true);
    fetch(`/api/categories/${draft.categoryId}/attributes`)
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        const items = (d?.items ?? []).map((it: any) => ({ id: it.attribute.id, name: it.attribute.name, code: it.attribute.code }));
        setAttrs(items);
      })
      .catch(() => active && setAttrs([]))
      .finally(() => active && setAttrsLoading(false));
    return () => {
      active = false;
    };
  }, [draft.categoryId]);

  function setLayout(patch: Partial<StickerLayout>) {
    setDraft({ ...draft, layout: { ...draft.layout, ...patch } });
  }

  function changeBase(base: StickerBase) {
    // Switching base resets to that base's preset rows + size.
    setDraft({ ...draft, layout: basePreset(base) });
  }

  function updateField(id: string, patch: Partial<StickerField>) {
    setLayout({ fields: draft.layout.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) });
  }

  function removeField(id: string) {
    setLayout({ fields: draft.layout.fields.filter((f) => f.id !== id) });
  }

  function addField() {
    setLayout({ fields: [...draft.layout.fields, newFieldRow()] });
  }

  function moveField(id: string, dir: -1 | 1) {
    const arr = [...draft.layout.fields];
    const i = arr.findIndex((f) => f.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setLayout({ fields: arr });
  }

  // Build preview rows: show a representative value for each field.
  const previewRows: RenderRow[] = draft.layout.fields.map((f) => {
    let value = "";
    if (f.source === "static") value = f.staticText || "";
    else if (f.source === "attribute") value = attrs.find((a) => a.id === f.attributeId)?.name ?? "(attribute)";
    else if (f.source === "productName") value = "Sample Product";
    else if (f.source === "sku") value = "SKU-0001";
    else if (f.source === "brandName") value = selectedCat ? "Brand" : "Brand";
    else if (f.source === "instanceCode") value = "SKU-KCONE-0001";
    return { id: f.id, label: f.label, value };
  });

  const previewScale = draft.layout.base === "pioneer" ? 1.2 : 2.2; // on-screen zoom over true mm size

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 py-8">
      <div className="w-full max-w-4xl rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{draft.id ? "Edit Sticker Template" : "New Sticker Template"}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <div className="grid gap-5 px-5 py-5 lg:grid-cols-2">
          {/* ---- Left: settings ---- */}
          <div className="space-y-5">
            {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Template Name</label>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. Laminate — Standard Label"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Base Design</label>
              <div className="grid grid-cols-2 gap-2">
                {STICKER_BASES.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => changeBase(b)}
                    className={`rounded-lg border px-3 py-2 text-left text-xs ${draft.layout.base === b ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 hover:bg-slate-50"}`}
                  >
                    <div className="font-semibold capitalize">{b}</div>
                    <div className="text-[11px] text-slate-500">{BASE_META[b].size.w} × {BASE_META[b].size.h} mm</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Category</label>
              {selectedCat ? (
                <div className="flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-800">{selectedCat.name}</div>
                    <div className="font-mono text-[11px] text-slate-400">{selectedCat.code}</div>
                  </div>
                  <button type="button" onClick={() => { setDraft({ ...draft, categoryId: "" }); setCatQuery(""); }} className="ml-3 shrink-0 text-xs font-medium text-brand-600 hover:underline">
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
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-200">
                    {matches.list.length === 0 ? (
                      <div className="px-3 py-4 text-center text-sm text-slate-400">No matching categories.</div>
                    ) : (
                      <ul className="divide-y divide-slate-100">
                        {matches.list.map((c) => (
                          <li key={c.id}>
                            <button type="button" onClick={() => setDraft({ ...draft, categoryId: c.id })} className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50">
                              <span className="truncate text-sm text-slate-700">{c.name}</span>
                              <span className="ml-3 shrink-0 font-mono text-[11px] text-slate-400">{c.code}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Field rows editor */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">Field Rows</label>
                <button type="button" onClick={addField} className="text-xs font-medium text-brand-600 hover:underline">+ Add row</button>
              </div>
              {!selectedCat && <p className="mb-2 text-[11px] text-amber-600">Select a category to map attribute fields.</p>}
              {attrsLoading && <p className="mb-2 text-[11px] text-slate-400">Loading attributes…</p>}
              <div className="space-y-2">
                {draft.layout.fields.map((f, idx) => (
                  <div key={f.id} className="rounded-lg border border-slate-200 p-2">
                    <div className="flex items-center gap-2">
                      <input
                        value={f.label}
                        onChange={(e) => updateField(f.id, { label: e.target.value })}
                        placeholder="Label"
                        className="w-32 rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                      <select
                        value={f.source}
                        onChange={(e) => updateField(f.id, { source: e.target.value as FieldSource })}
                        className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                      >
                        {Object.entries(FIELD_SOURCE_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                      <div className="flex shrink-0 items-center gap-1">
                        <button type="button" onClick={() => moveField(f.id, -1)} disabled={idx === 0} className="rounded border border-slate-200 px-1.5 py-1 text-[11px] text-slate-500 hover:bg-slate-50 disabled:opacity-30">↑</button>
                        <button type="button" onClick={() => moveField(f.id, 1)} disabled={idx === draft.layout.fields.length - 1} className="rounded border border-slate-200 px-1.5 py-1 text-[11px] text-slate-500 hover:bg-slate-50 disabled:opacity-30">↓</button>
                        <button type="button" onClick={() => removeField(f.id)} className="rounded border border-rose-200 px-1.5 py-1 text-[11px] text-rose-600 hover:bg-rose-50">✕</button>
                      </div>
                    </div>
                    {f.source === "attribute" && (
                      <select
                        value={f.attributeId ?? ""}
                        onChange={(e) => {
                          const a = attrs.find((x) => x.id === e.target.value);
                          updateField(f.id, { attributeId: e.target.value || null, attributeCode: a?.code ?? null });
                        }}
                        className="mt-2 w-full rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                      >
                        <option value="">— map to attribute —</option>
                        {attrs.map((a) => (
                          <option key={a.id} value={a.id}>{a.name} ({a.code})</option>
                        ))}
                      </select>
                    )}
                    {f.source === "static" && (
                      <input
                        value={f.staticText ?? ""}
                        onChange={(e) => updateField(f.id, { staticText: e.target.value })}
                        placeholder="Static text"
                        className="mt-2 w-full rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Base art toggles */}
            <div className="flex flex-wrap gap-3">
              {([["showBrandLogo", "Brand Logo"], ["showQr", "QR Code"], ["showBarcode", "Barcode"]] as const).map(([key, label]) => (
                <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={draft.layout[key]} onChange={(e) => setLayout({ [key]: e.target.checked } as Partial<StickerLayout>)} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                  {label}
                </label>
              ))}
            </div>

            {/* QR link — the URL each QR opens (tokens fill per product copy) */}
            {draft.layout.showQr && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">QR Link (URL the QR opens)</label>
                <input
                  value={draft.layout.qrLink}
                  onChange={(e) => setLayout({ qrLink: e.target.value })}
                  placeholder="https://kc.store/p/{instanceCode}"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-400">Tokens:</span>
                  {QR_LINK_TOKENS.map((tk) => (
                    <button
                      key={tk}
                      type="button"
                      onClick={() => setLayout({ qrLink: `${draft.layout.qrLink}${tk}` })}
                      className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 hover:bg-slate-100"
                    >
                      {tk}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-slate-400">Each copy fills the tokens, so every QR opens its own link. Leave blank to encode the instance code.</p>
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
              <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* ---- Right: live preview ---- */}
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Live Preview ({draft.layout.size.w} × {draft.layout.size.h} mm)</div>
            <div className="flex justify-center overflow-auto rounded-lg border border-slate-200 bg-slate-100 p-6">
              <div style={{ transform: `scale(${previewScale})`, transformOrigin: "top center" }}>
                <div className="shadow-md ring-1 ring-slate-300">
                  <StickerRender
                    layout={draft.layout}
                    rows={previewRows}
                    brandName="Brand"
                    qrUrl={null}
                    barcodeValue="SKU-KCONE-0001"
                    bottomCode="D28.05.01"
                  />
                </div>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">QR fills in per product copy at print time. Values shown are samples.</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
          <button type="button" onClick={onSave} disabled={busy} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
            {busy ? "Saving..." : draft.id ? "Save Changes" : "Create Template"}
          </button>
        </div>
      </div>
    </div>
  );
}

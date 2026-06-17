"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DATA_TYPES, SECTION_GROUPS, dataTypeLabel, slugFromName } from "@/lib/attributeMeta";
import { levelMeta } from "@/lib/categoryLevels";
import IconButton from "@/components/ui/IconButton";

export type AttrRow = {
  id: string;
  name: string;
  code: string;
  dataType: string;
  unit: string | null;
  sectionGroup: string | null;
  isVariant: boolean;
  isPriceable: boolean;
  isRequired: boolean;
  status: string;
  options: string[];
  mappedCount: number;
  mappedCategories: MappedCategory[];
};

export type MappedCategory = { mapId: string; categoryId: string; name: string; level?: number };

const emptyForm = {
  name: "",
  code: "",
  dataType: "string",
  unit: "",
  sectionGroup: "",
  isVariant: false,
  isPriceable: false,
  isRequired: false,
  optionsText: "",
};

export default function AttributesClient({ initial, readOnly = false, canRequest = false }: { initial: AttrRow[]; readOnly?: boolean; canRequest?: boolean }) {
  const router = useRouter();
  const requestMode = readOnly && canRequest; // Branch Admin: create = request (HO approval)
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AttrRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [codeTouched, setCodeTouched] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Category mapping — domain-wise cascading picker
  const [mappings, setMappings] = useState<MappedCategory[]>([]);
  const [catChain, setCatChain] = useState<{ id: string; name: string }[]>([]);
  const [catOptions, setCatOptions] = useState<{ id: string; name: string; hasChildren: boolean }[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [mapBusy, setMapBusy] = useState(false);

  // "View all categories" modal (read-only) for attributes mapped to many categories
  const [viewing, setViewing] = useState<AttrRow | null>(null);
  const [viewQuery, setViewQuery] = useState("");

  // Load domains (roots) whenever the modal opens.
  useEffect(() => {
    if (open) loadChildren(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function loadChildren(parentId: string | null) {
    setCatLoading(true);
    try {
      const res = await fetch(`/api/categories/children?parentId=${parentId ?? ""}`);
      const data = await res.json();
      setCatOptions(data.categories ?? []);
    } catch {
      setCatOptions([]);
    } finally {
      setCatLoading(false);
    }
  }

  async function pickLevel(o: { id: string; name: string; hasChildren: boolean }) {
    setCatChain((prev) => [...prev, { id: o.id, name: o.name }]);
    if (o.hasChildren) await loadChildren(o.id);
    else setCatOptions([]);
  }

  async function goToDepth(n: number) {
    const newChain = catChain.slice(0, n);
    setCatChain(newChain);
    const parent = newChain[newChain.length - 1];
    await loadChildren(parent ? parent.id : null);
  }

  function addCurrentCategory() {
    const leaf = catChain[catChain.length - 1];
    if (!leaf) return;
    addMapping({ id: leaf.id, name: catChain.map((c) => c.name).join(" › "), level: catChain.length });
  }

  async function addMapping(cat: { id: string; name: string; level?: number }) {
    if (mappings.some((m) => m.categoryId === cat.id)) return;
    setError("");
    // Create mode: no attribute id yet — stage locally, map after save.
    if (!editing) {
      setMappings((prev) => [...prev, { mapId: `pending-${cat.id}`, categoryId: cat.id, name: cat.name, level: cat.level }]);
      goToDepth(0);
      return;
    }
    // Edit mode: persist the mapping immediately.
    setMapBusy(true);
    try {
      const res = await fetch(`/api/categories/${cat.id}/attributes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attributeId: editing.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not map category");
        return;
      }
      setMappings((prev) => [...prev, { mapId: data.mapId, categoryId: cat.id, name: cat.name, level: cat.level }]);
      goToDepth(0);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setMapBusy(false);
    }
  }

  async function removeMapping(m: MappedCategory) {
    // Staged (create-mode) mapping — just drop it locally.
    if (m.mapId.startsWith("pending-")) {
      setMappings((prev) => prev.filter((x) => x.categoryId !== m.categoryId));
      return;
    }
    setMapBusy(true);
    try {
      const res = await fetch(`/api/category-attributes/${m.mapId}`, { method: "DELETE" });
      if (res.ok) {
        setMappings((prev) => prev.filter((x) => x.mapId !== m.mapId));
        router.refresh();
      }
    } finally {
      setMapBusy(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = (q ? initial.filter((a) => a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q)) : initial).filter((a) => a.status !== "archived");
    // group by sectionGroup
    const groups = new Map<string, AttrRow[]>();
    for (const a of rows) {
      const g = a.sectionGroup || "Ungrouped";
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(a);
    }
    return [...groups.entries()];
  }, [initial, query]);

  function startCreate() {
    setEditing(null);
    setForm({ ...emptyForm });
    setCodeTouched(false);
    setError("");
    setMappings([]);
    setCatChain([]);
    setOpen(true);
  }

  function startEdit(a: AttrRow) {
    setEditing(a);
    setForm({
      name: a.name,
      code: a.code,
      dataType: a.dataType,
      unit: a.unit ?? "",
      sectionGroup: a.sectionGroup ?? "",
      isVariant: a.isVariant,
      isPriceable: a.isPriceable,
      isRequired: a.isRequired,
      optionsText: a.options.join("\n"),
    });
    setCodeTouched(true);
    setError("");
    setMappings(a.mappedCategories);
    setCatChain([]);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        code: form.code,
        dataType: form.dataType,
        unit: form.unit || null,
        sectionGroup: form.sectionGroup || null,
        isVariant: form.isVariant,
        isPriceable: form.isPriceable,
        isRequired: form.isRequired,
      };
      if (form.dataType === "enum") {
        payload.options = form.optionsText.split("\n").map((s) => s.trim()).filter(Boolean);
      }
      const res = await fetch(editing ? `/api/attributes/${editing.id}` : "/api/attributes", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Save failed");
        return;
      }
      if (data.pending) {
        alert("Attribute submitted for HO approval. It'll appear once approved.");
        setOpen(false);
        router.refresh();
        return;
      }
      // Fresh HO attribute: map the categories staged in the form.
      if (!editing && data.attribute?.id && mappings.length > 0) {
        const newId = String(data.attribute.id);
        await Promise.all(
          mappings.map((m) =>
            fetch(`/api/categories/${m.categoryId}/attributes`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ attributeId: newId }),
            })
          )
        );
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(a: AttrRow) {
    setBusy(true);
    await fetch(`/api/attributes/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: a.status === "active" ? "retired" : "active" }),
    });
    setBusy(false);
    router.refresh();
  }

  async function remove(a: AttrRow) {
    if (!confirm(`Archive attribute "${a.name}"? You can restore it later from Archived.`)) return;
    setBusy(true);
    const res = await fetch("/api/archive", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entity: "attribute", id: a.id, action: "archive" }) });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      alert(d?.error || "Could not archive this attribute.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search attributes…"
          className="flex-1 max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <span className="text-sm text-slate-500">{initial.length} total</span>
        {(!readOnly || canRequest) && (
          <button
            onClick={startCreate}
            className="ml-auto rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700"
          >
            {requestMode ? "+ Request Attribute" : "+ New Attribute"}
          </button>
        )}
      </div>

      {initial.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white/60 backdrop-blur-md p-10 text-center text-sm text-slate-400">
          No attributes yet. Click <strong>New Attribute</strong> to define your first one (e.g. Unit Thickness, Color, Fire Rating).
        </div>
      ) : (
        filtered.map(([group, rows]) => (
          <div key={group} className="rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md overflow-hidden">
            <div className="px-4 py-2 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {group} <span className="text-slate-400">· {rows.length}</span>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {rows.map((a) => (
                  <tr key={a.id} className={`group ${a.status === "retired" ? "opacity-50" : ""}`}>
                    <td className="px-4 py-2.5 font-medium w-1/3">
                      {a.name}
                      <span className="ml-2 font-mono text-[11px] text-slate-400">{a.code}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {dataTypeLabel(a.dataType)}
                        {a.unit ? ` · ${a.unit}` : ""}
                      </span>
                      {a.dataType === "enum" && (
                        <span className="ml-2 text-xs text-slate-400">{a.options.length} options</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 space-x-1">
                      {a.isVariant && <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">variant</span>}
                      {a.isPriceable && <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600">priceable</span>}
                      {a.isRequired && <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">required</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {a.mappedCount === 0 ? (
                        <span className="text-slate-400">Not mapped</span>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1">
                          {a.mappedCategories.slice(0, 4).map((c) => (
                            <span key={c.mapId} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              {c.name}
                            </span>
                          ))}
                          {a.mappedCount > 4 && (
                            <button
                              type="button"
                              onClick={() => { setViewing(a); setViewQuery(""); }}
                              className="px-1.5 py-0.5 rounded bg-brand-100 text-brand-700 font-medium hover:bg-brand-200"
                            >
                              +{a.mappedCount - 4} more
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {readOnly ? (
                        <span className="text-xs text-slate-400 italic">View only</span>
                      ) : (
                        <div className="inline-flex items-center gap-2">
                          <IconButton kind="edit" tone="primary" title="Edit" onClick={() => startEdit(a)} />
                          <IconButton kind={a.status === "active" ? "retire" : "activate"} title={a.status === "active" ? "Deactivate" : "Activate"} onClick={() => toggleStatus(a)} disabled={busy} />
                          <IconButton kind="archive" title="Archive" onClick={() => remove(a)} disabled={busy} />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}

      {viewing && (
        <div
          className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 px-4 py-8 overflow-y-auto"
          onClick={() => setViewing(null)}
        >
          <div
            className="bg-white/95 backdrop-blur-md rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold truncate">Categories — {viewing.name}</h3>
              <button onClick={() => setViewing(null)} aria-label="Close" className="text-slate-400 hover:text-slate-700 shrink-0">✕</button>
            </div>
            <p className="text-xs text-slate-500">
              {viewing.mappedCount} categories mapped · inherits down to all sub-categories.
            </p>
            <input
              value={viewQuery}
              onChange={(e) => setViewQuery(e.target.value)}
              placeholder="Filter categories…"
              autoFocus
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {(() => {
              const q = viewQuery.trim().toLowerCase();
              const list = q
                ? viewing.mappedCategories.filter((c) => c.name.toLowerCase().includes(q))
                : viewing.mappedCategories;
              return (
                <div className="max-h-80 overflow-y-auto rounded-md border border-slate-200 divide-y divide-slate-100">
                  {list.length === 0 ? (
                    <div className="px-3 py-8 text-center text-xs text-slate-400">No matches.</div>
                  ) : (
                    list.map((c) => (
                      <div key={c.mapId} className="px-3 py-2 text-sm text-slate-700">{c.name}</div>
                    ))
                  )}
                </div>
              );
            })()}
            <div className="flex justify-end">
              <button onClick={() => setViewing(null)} className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 px-4 py-8 overflow-y-auto">
          <form onSubmit={save} className="bg-white/60 backdrop-blur-md rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <h3 className="text-lg font-bold">{editing ? "Edit attribute" : requestMode ? "Request attribute" : "New attribute"}</h3>
            {requestMode && !editing && (
              <p className="text-xs text-slate-500">Submitted to HO Admin — added only after approval.</p>
            )}
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm((f) => ({ ...f, name, code: codeTouched ? f.code : slugFromName(name) }));
                  }}
                  required
                  autoFocus
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="e.g. Unit Thickness"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Code</label>
                <input
                  value={form.code}
                  onChange={(e) => { setForm((f) => ({ ...f, code: e.target.value })); setCodeTouched(true); }}
                  required
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="unit-thickness"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Type</label>
                <select
                  value={form.dataType}
                  onChange={(e) => setForm((f) => ({ ...f, dataType: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {DATA_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Unit (optional)</label>
                <input
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="mm, kg, ft…"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Section group</label>
              <select
                value={form.sectionGroup}
                onChange={(e) => setForm((f) => ({ ...f, sectionGroup: e.target.value }))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">— None —</option>
                {SECTION_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            {form.dataType === "enum" && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Dropdown options (one per line)</label>
                <textarea
                  value={form.optionsText}
                  onChange={(e) => setForm((f) => ({ ...f, optionsText: e.target.value }))}
                  rows={4}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder={"Matte\nGlossy\nTextured"}
                />
              </div>
            )}

            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.isRequired} onChange={(e) => setForm((f) => ({ ...f, isRequired: e.target.checked }))} />
                Required (default)
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.isVariant} onChange={(e) => setForm((f) => ({ ...f, isVariant: e.target.checked }))} />
                Varies per variant
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.isPriceable} onChange={(e) => setForm((f) => ({ ...f, isPriceable: e.target.checked }))} />
                Priceable
              </label>
            </div>

            {!requestMode && (
              <div className="space-y-2 border-t border-slate-100 pt-4">
                <label className="text-sm font-medium">Mapped categories</label>
                <p className="text-xs text-slate-500">
                  {editing
                    ? "Add or remove which categories this attribute applies to. It inherits down to all sub-categories."
                    : "Pick which categories this attribute applies to. They'll be mapped when you save. It inherits down to all sub-categories."}
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {mappings.length === 0 ? (
                    <span className="text-xs text-slate-400">Not mapped to any category yet.</span>
                  ) : (
                    mappings.map((m) => (
                      <span key={m.mapId} className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white/70 text-slate-700 text-xs px-2 py-1">
                        {m.level ? <span className={`h-2 w-2 rounded-full ${levelMeta(m.level).dot}`} title={levelMeta(m.level).label} /> : null}
                        {m.name}
                        <button
                          type="button"
                          onClick={() => removeMapping(m)}
                          disabled={mapBusy}
                          aria-label={`Remove ${m.name}`}
                          className="text-slate-400 hover:text-red-600 disabled:opacity-50"
                        >
                          ✕
                        </button>
                      </span>
                    ))
                  )}
                </div>

                {/* Domain-wise cascading picker */}
                <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50/60 p-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button type="button" onClick={() => goToDepth(0)} className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-brand-600">
                      Domains
                    </button>
                    {catChain.map((c, i) => {
                      const m = levelMeta(i + 1);
                      return (
                        <span key={c.id} className="flex items-center gap-1.5">
                          <span className="text-slate-300">›</span>
                          <button type="button" onClick={() => goToDepth(i + 1)} title={m.label} className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium ${m.badge}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
                            {c.name}
                          </button>
                        </span>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider">
                    <span className={`h-2 w-2 rounded-full ${levelMeta(catChain.length + 1).dot}`} />
                    <span className="text-slate-500">
                      {catOptions.length === 0 && catChain.length > 0 ? "Deepest level reached" : `Choose ${levelMeta(catChain.length + 1).label}`}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <select
                      value=""
                      onChange={(e) => {
                        const o = catOptions.find((x) => x.id === e.target.value);
                        if (o) pickLevel(o);
                      }}
                      disabled={catLoading || catOptions.length === 0}
                      className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="">
                        {catLoading
                          ? "Loading…"
                          : catOptions.length === 0
                          ? catChain.length
                            ? "No further sub-categories"
                            : "No domains"
                          : `Select ${levelMeta(catChain.length + 1).label}…`}
                      </option>
                      {catOptions
                        .filter((o) => !mappings.some((m) => m.categoryId === o.id))
                        .map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                            {o.hasChildren ? " ›" : ""}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={addCurrentCategory}
                      disabled={mapBusy || catChain.length === 0}
                      className="shrink-0 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">
                Cancel
              </button>
              <button type="submit" disabled={busy} className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-60">
                {busy ? "Submitting…" : requestMode ? "Submit Request" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

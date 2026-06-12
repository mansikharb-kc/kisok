"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { dataTypeLabel } from "@/lib/attributeMeta";

type EffItem = {
  mapId: string;
  isOwn: boolean;
  sourceCategoryName: string | null;
  isRequired: boolean;
  isSearchable: boolean;
  displayOrder: number;
  attribute: {
    id: string;
    name: string;
    code: string;
    dataType: string;
    unit: string | null;
    sectionGroup: string | null;
    options: string[];
  };
};

type LibAttr = {
  id: string;
  name: string;
  code: string;
  dataType: string;
  unit: string | null;
  sectionGroup: string | null;
  status: string;
};

export default function CategoryAttributePanel({
  categoryId,
  categoryName,
  levelLabel,
  onClose,
}: {
  categoryId: string;
  categoryName: string;
  levelLabel: string;
  onClose: () => void;
}) {
  const [items, setItems] = useState<EffItem[]>([]);
  const [library, setLibrary] = useState<LibAttr[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addQuery, setAddQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [effRes, libRes] = await Promise.all([
      fetch(`/api/categories/${categoryId}/attributes`),
      fetch(`/api/attributes`),
    ]);
    const eff = await effRes.json();
    const lib = await libRes.json();
    setItems(eff.items ?? []);
    setLibrary((lib.attributes ?? []).filter((a: LibAttr) => a.status === "active"));
    setLoading(false);
  }, [categoryId]);

  useEffect(() => {
    load();
  }, [load]);

  const effectiveIds = useMemo(() => new Set(items.map((i) => i.attribute.id)), [items]);
  const addable = useMemo(() => {
    const q = addQuery.trim().toLowerCase();
    return library
      .filter((a) => !effectiveIds.has(a.id))
      .filter((a) => (q ? a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q) : true))
      .slice(0, 50);
  }, [library, effectiveIds, addQuery, items]);

  // group by section group
  const groups = useMemo(() => {
    const m = new Map<string, EffItem[]>();
    for (const it of [...items].sort((a, b) => a.displayOrder - b.displayOrder)) {
      const g = it.attribute.sectionGroup || "Ungrouped";
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(it);
    }
    return [...m.entries()];
  }, [items]);

  async function mapAttr(attributeId: string) {
    setBusy(true);
    await fetch(`/api/categories/${categoryId}/attributes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attributeId }),
    });
    setBusy(false);
    setAdding(false);
    setAddQuery("");
    load();
  }

  async function unmap(it: EffItem) {
    if (!confirm(`Remove "${it.attribute.name}" from ${categoryName}?`)) return;
    setBusy(true);
    await fetch(`/api/category-attributes/${it.mapId}`, { method: "DELETE" });
    setBusy(false);
    load();
  }

  async function toggle(it: EffItem, field: "isRequired" | "isSearchable") {
    setBusy(true);
    await fetch(`/api/category-attributes/${it.mapId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: !it[field] }),
    });
    setBusy(false);
    load();
  }

  return (
    <div className="w-[420px] shrink-0 border-l border-slate-200 bg-white h-[calc(100vh-4rem)] sticky top-0 overflow-y-auto">
      <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400">{levelLabel} · attributes</div>
          <h3 className="font-bold text-slate-800">{categoryName}</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {items.length} effective ({items.filter((i) => i.isOwn).length} own, {items.filter((i) => !i.isOwn).length} inherited)
          </p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-lg leading-none">✕</button>
      </div>

      <div className="px-5 py-3 border-b border-slate-100">
        {!adding ? (
          <button
            onClick={() => setAdding(true)}
            className="w-full rounded-md bg-brand-600 text-white py-2 text-sm font-medium hover:bg-brand-700"
          >
            + Map attribute
          </button>
        ) : (
          <div className="rounded-lg border border-slate-200">
            <input
              value={addQuery}
              onChange={(e) => setAddQuery(e.target.value)}
              autoFocus
              placeholder="Search attribute library…"
              className="w-full px-3 py-2 text-sm border-b border-slate-200 focus:outline-none"
            />
            <div className="max-h-52 overflow-y-auto">
              {addable.length === 0 ? (
                <div className="px-3 py-3 text-xs text-slate-400">No more attributes to map. Create them in the Attributes page.</div>
              ) : (
                addable.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => mapAttr(a.id)}
                    disabled={busy}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
                  >
                    <span className="font-medium">{a.name}</span>
                    <span className="text-[11px] text-slate-400">{dataTypeLabel(a.dataType)}{a.unit ? ` · ${a.unit}` : ""}</span>
                    {a.sectionGroup && <span className="ml-auto text-[10px] text-slate-400">{a.sectionGroup}</span>}
                  </button>
                ))
              )}
            </div>
            <button onClick={() => { setAdding(false); setAddQuery(""); }} className="w-full px-3 py-1.5 text-xs text-slate-500 border-t border-slate-100 hover:bg-slate-50">
              Cancel
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="px-5 py-10 text-center text-sm text-slate-400">Loading…</div>
      ) : items.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-slate-400">
          No attributes yet. Click <strong>Map attribute</strong> to add. Attributes mapped here are inherited by all sub-categories.
        </div>
      ) : (
        groups.map(([group, rows]) => (
          <div key={group} className="px-5 py-3 border-b border-slate-100">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">{group}</div>
            <div className="space-y-2">
              {rows.map((it) => (
                <div key={it.mapId} className="rounded-lg border border-slate-200 p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-800">{it.attribute.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {dataTypeLabel(it.attribute.dataType)}{it.attribute.unit ? ` · ${it.attribute.unit}` : ""}
                    </span>
                    {!it.isOwn && (
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-600">
                        ↑ {it.sourceCategoryName}
                      </span>
                    )}
                  </div>
                  {it.attribute.dataType === "enum" && it.attribute.options.length > 0 && (
                    <div className="mt-1 text-[11px] text-slate-400">{it.attribute.options.join(", ")}</div>
                  )}
                  <div className="mt-2 flex items-center gap-3 text-[11px]">
                    {it.isOwn ? (
                      <>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input type="checkbox" checked={it.isRequired} disabled={busy} onChange={() => toggle(it, "isRequired")} />
                          Required
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input type="checkbox" checked={it.isSearchable} disabled={busy} onChange={() => toggle(it, "isSearchable")} />
                          Searchable
                        </label>
                        <button onClick={() => unmap(it)} disabled={busy} className="ml-auto text-red-600 hover:underline">Remove</button>
                      </>
                    ) : (
                      <span className="text-slate-400">
                        {it.isRequired ? "Required" : "Optional"}{it.isSearchable ? " · Searchable" : ""} · inherited (read-only)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

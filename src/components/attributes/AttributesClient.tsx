"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DATA_TYPES, SECTION_GROUPS, dataTypeLabel, slugFromName } from "@/lib/attributeMeta";

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
};

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

export default function AttributesClient({ initial }: { initial: AttrRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AttrRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [codeTouched, setCodeTouched] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = q ? initial.filter((a) => a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q)) : initial;
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
    if (!confirm(`Delete attribute "${a.name}"? If mapped to categories it will be retired instead.`)) return;
    setBusy(true);
    await fetch(`/api/attributes/${a.id}`, { method: "DELETE" });
    setBusy(false);
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
        <button
          onClick={startCreate}
          className="ml-auto rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700"
        >
          + New Attribute
        </button>
      </div>

      {initial.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
          No attributes yet. Click <strong>New Attribute</strong> to define your first one (e.g. Unit Thickness, Color, Fire Rating).
        </div>
      ) : (
        filtered.map(([group, rows]) => (
          <div key={group} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
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
                    <td className="px-4 py-2.5 text-xs text-slate-400">{a.mappedCount} categories</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap space-x-3">
                      <button onClick={() => startEdit(a)} className="text-brand-600 hover:underline text-xs">Edit</button>
                      <button onClick={() => toggleStatus(a)} disabled={busy} className="text-slate-500 hover:underline text-xs">
                        {a.status === "active" ? "Retire" : "Activate"}
                      </button>
                      <button onClick={() => remove(a)} disabled={busy} className="text-red-600 hover:underline text-xs">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 px-4 py-8 overflow-y-auto">
          <form onSubmit={save} className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <h3 className="text-lg font-bold">{editing ? "Edit attribute" : "New attribute"}</h3>
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

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">
                Cancel
              </button>
              <button type="submit" disabled={busy} className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-60">
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

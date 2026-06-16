"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LEVELS, levelMeta } from "@/lib/categoryLevels";
import { buildParentOptions, FlatCat } from "@/lib/categoryTree";

export default function CategoryCreateForm({
  flat,
  initialLevel = 1,
  initialParentId = null,
  lockContext = false,
  isRequest = false,
}: {
  flat: FlatCat[];
  initialLevel?: number;
  initialParentId?: string | null;
  lockContext?: boolean;
  isRequest?: boolean;
}) {
  const router = useRouter();
  const parents = useMemo(() => buildParentOptions(flat), [flat]);
  const byId = useMemo(() => new Map(parents.map((p) => [p.id, p])), [parents]);

  function chainOf(id: string | null): Record<number, string> {
    const out: Record<number, string> = {};
    let cur = id ? byId.get(id) : undefined;
    while (cur) {
      out[cur.level] = cur.id;
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return out;
  }

  const [level, setLevel] = useState(initialLevel);
  const [sel, setSel] = useState<Record<number, string>>(() =>
    lockContext ? chainOf(initialParentId) : {},
  );
  const [queries, setQueries] = useState<Record<number, string>>({});
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const meta = levelMeta(level);
  const needsParent = level > 1;
  const ancestorLevels = Array.from({ length: level - 1 }, (_, i) => i + 1);
  const parentId = needsParent ? sel[level - 1] ?? null : null;
  const names = text.split("\n").map((s) => s.trim()).filter(Boolean);
  const canSubmit = names.length > 0 && (!needsParent || !!parentId);

  function optionsForLevel(k: number) {
    if (k === 1) return parents.filter((p) => p.level === 1);
    const parentSel = sel[k - 1];
    if (!parentSel) return [];
    return parents.filter((p) => p.level === k && p.parentId === parentSel);
  }

  function pickLevel(l: number) {
    if (lockContext) return;
    setLevel(l);
    setSel({});
    setQueries({});
  }

  function selectAt(k: number, id: string) {
    setSel((prev) => {
      const next: Record<number, string> = {};
      for (let i = 1; i < k; i++) if (prev[i]) next[i] = prev[i];
      next[k] = id;
      return next;
    });
  }

  function clearAt(k: number) {
    setSel((prev) => {
      const next: Record<number, string> = {};
      for (let i = 1; i < k; i++) if (prev[i]) next[i] = prev[i];
      return next;
    });
  }

  function goBack() {
    router.push("/masters/categories");
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!canSubmit) {
      setError(needsParent && !parentId ? `Select the parent ${levelMeta(level - 1).label}` : "Enter at least one name");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/categories/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId, names }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Create failed");
        return;
      }
      if (data.pending) {
        alert(`Submitted ${data.requested ?? names.length} categor${(data.requested ?? names.length) > 1 ? "ies" : "y"} for HO approval. They'll appear once approved.`);
      }
      goBack();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-xl bg-brand-600 text-white flex items-center justify-center text-xl">▤</div>
        <div>
          <h1 className="text-2xl font-bold">{isRequest ? "Request New Category" : "Create New Category"}</h1>
          <p className="text-sm text-slate-500">
            {isRequest ? "Submitted to HO Admin — added only after approval" : "Add a new category to the hierarchy"}
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="bg-white/60 backdrop-blur-md rounded-2xl border border-slate-200 p-7 space-y-6">
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>
        )}

        {/* Level selector */}
        <div className="space-y-2">
          <label className="text-sm font-semibold">
            Category Level <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-5 gap-2">
            {LEVELS.map((l, idx) => {
              const lv = idx + 1;
              const active = lv === level;
              const disabled = lockContext && lv !== level;
              return (
                <button
                  type="button"
                  key={l.label}
                  onClick={() => pickLevel(lv)}
                  disabled={disabled}
                  className={`rounded-lg border px-2 py-2.5 flex items-center justify-center gap-1.5 transition ${
                    active ? "border-brand-500 ring-2 ring-brand-200 bg-brand-50" : "border-slate-200 hover:border-slate-300"
                  } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${l.badge}`}>{l.label}</span>
                  <span className="text-sm font-semibold text-slate-700">{l.short}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${meta.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
              {meta.short}
            </span>
            {meta.label} level selected
          </div>
        </div>

        {/* Cascading parent path */}
        {needsParent && (
          <div className="space-y-4">
            <label className="text-sm font-semibold">
              Parent path <span className="text-red-500">*</span>
              <span className="ml-2 font-normal text-xs text-slate-400">
                Pick {ancestorLevels.map((k) => levelMeta(k).label).join(" → ")}
              </span>
            </label>

            {ancestorLevels.map((k) => {
              const lm = levelMeta(k);
              if (k > 1 && !sel[k - 1]) return null;
              const selectedId = sel[k];
              const selectedNode = selectedId ? byId.get(selectedId) : null;
              const opts = optionsForLevel(k);
              const q = (queries[k] ?? "").trim().toLowerCase();
              const filtered = (q ? opts.filter((o) => o.name.toLowerCase().includes(q)) : opts).slice(0, 50);

              return (
                <div key={k} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${lm.badge}`}>{lm.label}</span>
                    {selectedNode && (
                      <span className="text-sm font-medium text-slate-700">
                        {selectedNode.number} · {selectedNode.name}
                      </span>
                    )}
                    {selectedNode && !lockContext && (
                      <button type="button" onClick={() => clearAt(k)} className="text-xs text-brand-600 hover:underline">
                        change
                      </button>
                    )}
                  </div>

                  {!selectedNode && (
                    <div className="rounded-lg border border-slate-200">
                      <input
                        value={queries[k] ?? ""}
                        onChange={(e) => setQueries((p) => ({ ...p, [k]: e.target.value }))}
                        placeholder={`Search ${lm.label}…`}
                        className="w-full px-3 py-2 text-sm border-b border-slate-200 focus:outline-none"
                      />
                      <div className="max-h-44 overflow-y-auto">
                        {filtered.length === 0 ? (
                          <div className="px-3 py-3 text-xs text-slate-400">
                            No {lm.label} found{k > 1 ? " under the selected parent" : ""}. Create one first.
                          </div>
                        ) : (
                          filtered.map((o) => (
                            <button
                              type="button"
                              key={o.id}
                              onClick={() => selectAt(k, o.id)}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex gap-2"
                            >
                              <span className="text-xs text-slate-400 font-mono">{o.number}</span>
                              {o.name}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Names */}
        <div className="space-y-2">
          <label className="text-sm font-semibold">
            {meta.label} Name <span className="text-red-500">*</span>
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder={`Enter ${meta.label.toLowerCase()} name (one per line)`}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-y"
          />
          <p className="text-xs text-slate-400">
             Add multiple names (one per line) to create them all at once
            {names.length > 0 && <span className="text-slate-500"> — {names.length} will be created</span>}
          </p>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="submit"
            disabled={busy || !canSubmit}
            className="rounded-lg bg-brand-500 text-white py-3 text-sm font-semibold hover:bg-brand-600 disabled:opacity-50"
          >
            {busy ? "Submitting…" : `${isRequest ? "Request" : "Create"} ${meta.label}${names.length > 1 ? "s" : ""}`}
          </button>
          <button
            type="button"
            onClick={goBack}
            className="rounded-lg border border-slate-300 py-3 text-sm font-semibold hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

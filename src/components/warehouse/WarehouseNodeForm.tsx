"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ALLOWED_CHILDREN,
  ALLOWED_ROOT_TYPES,
  CAT_LEVELS,
  CategoryOption,
  combineCode,
  DEFAULT_FLAGS,
  LocationNode,
  NODE_TYPES,
  NodeType,
  nodeMeta,
} from "@/lib/warehouseMeta";

export default function WarehouseNodeForm({
  branchId,
  programId,
  programName,
  categories,
  parentNode,
  editNode,
}: {
  branchId: string;
  programId: string;
  programName: string;
  categories: CategoryOption[];
  parentNode: LocationNode | null;
  editNode: LocationNode | null;
}) {
  const router = useRouter();
  const backHref = `/branch/warehouse?program=${programId}`;

  const initialType: NodeType = editNode
    ? (editNode.nodeType as NodeType)
    : parentNode
    ? (ALLOWED_CHILDREN[parentNode.nodeType]?.[0] ?? "CUSTOM")
    : "WAREHOUSE";
  const initialFlags = editNode
    ? { isPlacementEligible: editNode.isPlacementEligible, isScreenMountable: editNode.isScreenMountable }
    : DEFAULT_FLAGS[initialType] ?? { isPlacementEligible: false, isScreenMountable: false };

  const [form, setForm] = useState({
    name: editNode?.name ?? "",
    code: editNode?.code ?? (parentNode?.code ? (parentNode.code.endsWith("-") ? parentNode.code : `${parentNode.code}-`) : ""),
    nodeType: initialType,
    categoryId: editNode?.categoryId ?? "",
    isPlacementEligible: initialFlags.isPlacementEligible,
    quantity: editNode?.quantity ?? 1,
    isScreenMountable: initialFlags.isScreenMountable,
  });
  const [isCodeManual, setIsCodeManual] = useState(!!editNode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Cascading category picker (Domain → Group → Family, up to L3)
  const catById = useMemo(() => new Map<string, CategoryOption>(categories.map((c) => [String(c.id), c])), [categories]);
  const childrenOf = (pid: string | null) =>
    categories.filter((c) => String(c.parentId ?? "") === String(pid ?? "")).sort((a, b) => a.name.localeCompare(b.name));
  const selChain = useMemo(() => {
    const out: CategoryOption[] = [];
    let cur: string | null = form.categoryId ? String(form.categoryId) : null;
    let guard = 0;
    while (cur && catById.has(cur) && guard++ < 10) {
      const c = catById.get(cur)!;
      out.unshift(c);
      cur = c.parentId ? String(c.parentId) : null;
    }
    return out;
  }, [form.categoryId, catById]);
  const l1Sel = selChain[0] ? String(selChain[0].id) : "";
  const l2Sel = selChain[1] ? String(selChain[1].id) : "";
  const l3Sel = selChain[2] ? String(selChain[2].id) : "";

  const typeChoices: NodeType[] = editNode
    ? [...NODE_TYPES]
    : parentNode
    ? ALLOWED_CHILDREN[parentNode.nodeType] ?? [...NODE_TYPES]
    : ALLOWED_ROOT_TYPES;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const body = {
        name: form.name,
        code: form.code || null,
        nodeType: form.nodeType,
        categoryId: form.categoryId || null,
        isPlacementEligible: form.isPlacementEligible,
        quantity: form.isPlacementEligible ? Math.max(1, Number(form.quantity) || 1) : 1,
        isScreenMountable: form.isScreenMountable,
      };
      const res = editNode
        ? await fetch(`/api/location-nodes/${editNode.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/location-nodes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ branchId, programId, parentId: parentNode?.id ?? null, ...body }),
          });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      router.push(backHref);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  const I = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white/60 backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-brand-500";

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <button type="button" onClick={() => router.push(backHref)} className="text-sm text-slate-500 hover:text-slate-800">‹ Back to Warehouse</button>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">
          {editNode ? `Edit — ${editNode.name}` : parentNode ? `Add sub-node under “${parentNode.name}”` : "Add Warehouse"}
        </h1>
        <p className="text-sm text-slate-500">Program: <span className="font-medium">{programName}</span></p>
      </div>

      {error && <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}

      <form onSubmit={save} className="space-y-5 rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-6">
        {/* Node type */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Node type</label>
          <div className="flex flex-wrap gap-2">
            {typeChoices.map((t) => {
              const m = nodeMeta(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    const flags = DEFAULT_FLAGS[t] ?? { isPlacementEligible: false, isScreenMountable: false };
                    setForm((f) => ({ ...f, nodeType: t, ...flags }));
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    form.nodeType === t ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                  title={m.desc}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        {/* Name */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Name <span className="text-red-500">*</span></label>
          <input
            value={form.name}
            onChange={(e) => {
              const newName = e.target.value;
              setForm((f) => {
                const next = { ...f, name: newName };
                if (!editNode && !isCodeManual) {
                  const parentCode = parentNode?.code ?? "";
                  next.code = newName.trim()
                    ? combineCode(parentCode, newName)
                    : parentCode ? (parentCode.endsWith("-") ? parentCode : `${parentCode}-`) : "";
                }
                return next;
              });
            }}
            required
            autoFocus
            placeholder={
              form.nodeType === "WAREHOUSE" ? "e.g. Immersive Hub" :
              form.nodeType === "BLOCK" ? "e.g. Block / Docket D1" :
              form.nodeType === "RACK" ? "e.g. Rack R1" :
              form.nodeType === "TRAY" ? "e.g. Tray T1" : "e.g. Custom Zone"
            }
            className={I}
          />
        </div>

        {/* Code */}
        <div className="space-y-1">
          <label className="text-sm font-medium">
            Code <span className="text-red-500">*</span>
            {parentNode?.code && <span className="text-xs text-slate-400 font-normal ml-1">(Parent prefix: {parentNode.code})</span>}
          </label>
          <input
            value={form.code}
            onChange={(e) => { setIsCodeManual(true); setForm((f) => ({ ...f, code: e.target.value })); }}
            required
            placeholder="e.g. WH-01, BLK-A, RCK-1, TRY-1"
            className={`${I} font-mono`}
          />
          <p className="text-[11px] text-slate-400">Letters, numbers, - and _ only</p>
        </div>

        {/* Category — cascading up to L3 */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Category <span className="text-slate-400 font-normal text-xs ml-1">(Optional, up to Family / L3)</span></label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select value={l1Sel} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))} className={I}>
              <option value="">— Domain —</option>
              {childrenOf(null).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={l2Sel} disabled={!l1Sel} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value || l1Sel }))} className={`${I} disabled:opacity-50`}>
              <option value="">{l1Sel ? "— Group (optional) —" : "—"}</option>
              {l1Sel && childrenOf(l1Sel).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={l3Sel} disabled={!l2Sel} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value || l2Sel }))} className={`${I} disabled:opacity-50`}>
              <option value="">{l2Sel ? "— Family (optional) —" : "—"}</option>
              {l2Sel && childrenOf(l2Sel).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <p className="text-[11px] text-slate-400">Pick Domain → Group → Family (up to L3). Used by OB Exec during placement.</p>
          {selChain.length > 0 && (
            <table className="mt-2 w-full text-xs border border-slate-200 rounded overflow-hidden">
              <thead>
                <tr className="bg-slate-50 text-slate-500">
                  <th className="px-2 py-1 text-left font-medium">Level</th>
                  <th className="px-2 py-1 text-left font-medium">Category</th>
                  <th className="px-2 py-1 text-left font-medium">Code</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selChain.map((c, i) => (
                  <tr key={c.id}>
                    <td className="px-2 py-1 text-slate-500">{CAT_LEVELS[i] ?? `L${i + 1}`}</td>
                    <td className="px-2 py-1 font-medium text-slate-800">{c.name}</td>
                    <td className="px-2 py-1 font-mono text-slate-400">{c.code}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Flags */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Flags</label>
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
            <input type="checkbox" checked={form.isPlacementEligible} onChange={(e) => setForm((f) => ({ ...f, isPlacementEligible: e.target.checked }))} className="mt-0.5" />
            <div>
              <div className="text-sm font-medium text-slate-800">Placement eligible</div>
              <div className="text-xs text-slate-500">Products / samples can be physically placed here. A location ID will be generated.</div>
            </div>
          </label>
          {form.isPlacementEligible && (
            <div className="ml-3 pl-6 border-l-2 border-slate-200 space-y-1">
              <label className="text-sm font-medium">Quantity <span className="text-red-500">*</span></label>
              <input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value === "" ? 1 : Math.max(1, Number(e.target.value)) }))}
                className={`${I} max-w-[160px]`}
              />
              <p className="text-[11px] text-slate-400">How many can be placed at this location. Default 1.</p>
            </div>
          )}
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
            <input type="checkbox" checked={form.isScreenMountable} onChange={(e) => setForm((f) => ({ ...f, isScreenMountable: e.target.checked }))} className="mt-0.5" />
            <div>
              <div className="text-sm font-medium text-slate-800">Screen mountable</div>
              <div className="text-xs text-slate-500">A display screen can be bound to this node (RMS Phase 2).</div>
            </div>
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={() => router.push(backHref)} className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={busy} className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-60">
            {busy ? "Saving..." : editNode ? "Save changes" : "Add node"}
          </button>
        </div>
      </form>
    </div>
  );
}

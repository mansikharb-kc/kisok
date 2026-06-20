"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ALLOWED_CHILDREN,
  ALLOWED_ROOT_TYPES,
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

  const flowSteps = useMemo<Array<{ id: string; name: string; level: string; datatype: string }> | null>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`wh_flow_${programId}`);
      if (saved) return JSON.parse(saved);
    }
    return null;
  }, [programId]);

  const initialType: NodeType = useMemo(() => {
    if (editNode) return editNode.nodeType as NodeType;
    if (flowSteps) {
      if (!parentNode) {
        return (flowSteps[0]?.level as NodeType) || "WAREHOUSE";
      }
      const parentStepIdx = flowSteps.findIndex((s) => s.level === parentNode.nodeType);
      return (flowSteps[parentStepIdx + 1]?.level as NodeType) || "CUSTOM";
    }
    return parentNode
      ? (ALLOWED_CHILDREN[parentNode.nodeType]?.[0] ?? "CUSTOM")
      : "WAREHOUSE";
  }, [editNode, parentNode, flowSteps]);

  const initialFlags = editNode
    ? { isPlacementEligible: editNode.isPlacementEligible, isScreenMountable: editNode.isScreenMountable }
    : DEFAULT_FLAGS[initialType] ?? { isPlacementEligible: false, isScreenMountable: false };

  const [form, setForm] = useState({
    name: editNode?.name ?? "",
    code: editNode?.code ?? (parentNode?.code ? (parentNode.code.endsWith("-") ? parentNode.code : `${parentNode.code}-`) : ""),
    nodeType: initialType,
    isPlacementEligible: initialFlags.isPlacementEligible,
    quantity: editNode?.quantity ?? 1,
    isScreenMountable: initialFlags.isScreenMountable,
  });
  const [isCodeManual, setIsCodeManual] = useState(!!editNode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Categories — pick MULTIPLE (Domain → Group → Family cascade, up to L3)
  const catById = useMemo(() => new Map<string, CategoryOption>(categories.map((c) => [String(c.id), c])), [categories]);
  const childrenOf = (pid: string | null) =>
    categories.filter((c) => String(c.parentId ?? "") === String(pid ?? "")).sort((a, b) => a.name.localeCompare(b.name));
  function pathOf(id: string) {
    const out: string[] = [];
    let cur: string | null = id;
    let g = 0;
    while (cur && catById.has(cur) && g++ < 10) {
      const c: CategoryOption = catById.get(cur)!;
      out.unshift(c.name);
      cur = c.parentId ? String(c.parentId) : null;
    }
    return out.join(" › ");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pickedCats, setPickedCats] = useState<{ id: string; path: string }[]>(
    (editNode?.nodeCategories ?? []).map((nc: any) => ({ id: String(nc.categoryId), path: pathOf(String(nc.categoryId)) }))
  );
  const [pickCatId, setPickCatId] = useState("");
  const pickChain = useMemo(() => {
    const out: CategoryOption[] = [];
    let cur: string | null = pickCatId || null;
    let g = 0;
    while (cur && catById.has(cur) && g++ < 10) {
      const c: CategoryOption = catById.get(cur)!;
      out.unshift(c);
      cur = c.parentId ? String(c.parentId) : null;
    }
    return out;
  }, [pickCatId, catById]);
  const l1Sel = pickChain[0] ? String(pickChain[0].id) : "";
  const l2Sel = pickChain[1] ? String(pickChain[1].id) : "";
  const l3Sel = pickChain[2] ? String(pickChain[2].id) : "";

  function addPicked() {
    if (!pickCatId || pickedCats.some((c) => c.id === pickCatId)) return;
    setPickedCats((prev) => [...prev, { id: pickCatId, path: pathOf(pickCatId) }]);
    setPickCatId("");
  }

  const typeChoices: NodeType[] = useMemo(() => {
    if (flowSteps) {
      if (editNode) {
        return [editNode.nodeType as NodeType];
      }
      if (!parentNode) {
        const rootLevel = flowSteps[0]?.level as NodeType;
        return rootLevel ? [rootLevel] : ["WAREHOUSE"];
      }
      const parentStepIdx = flowSteps.findIndex((s) => s.level === parentNode.nodeType);
      const nextLevel = flowSteps[parentStepIdx + 1]?.level as NodeType;
      return nextLevel ? [nextLevel] : ["CUSTOM"];
    }
    return editNode
      ? [...NODE_TYPES]
      : parentNode
      ? ALLOWED_CHILDREN[parentNode.nodeType] ?? [...NODE_TYPES]
      : ALLOWED_ROOT_TYPES;
  }, [flowSteps, parentNode, editNode]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const body = {
        name: form.name,
        code: form.code || null,
        nodeType: form.nodeType,
        categoryIds: pickedCats.map((c) => c.id),
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
        <h1 className="text-2xl font-bold text-slate-900">
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
              const customName = flowSteps?.find((s) => s.level === t)?.name || t;
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
                  {customName}
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
              let newName = e.target.value;
              const currentStep = flowSteps?.find((s) => s.level === form.nodeType);
              if (currentStep?.datatype?.toLowerCase() === "string") {
                newName = newName.toUpperCase();
              }
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
              (() => {
                const custom = flowSteps?.find((s) => s.level === form.nodeType);
                if (custom) return `e.g. ${custom.name}`;
                return form.nodeType === "WAREHOUSE" ? "e.g. Immersive Hub" :
                  form.nodeType === "BLOCK" ? "e.g. Block / Docket D1" :
                  form.nodeType === "RACK" ? "e.g. Rack R1" :
                  form.nodeType === "TRAY" ? "e.g. Tray T1" : "e.g. Custom Zone";
              })()
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
            onChange={(e) => {
              setIsCodeManual(true);
              let val = e.target.value;
              const currentStep = flowSteps?.find((s) => s.level === form.nodeType);
              if (currentStep?.datatype?.toLowerCase() === "string") {
                val = val.toUpperCase();
              }
              setForm((f) => ({ ...f, code: val }));
            }}
            required
            placeholder="e.g. WH-01, BLK-A, RCK-1, TRY-1"
            className={`${I} font-mono`}
          />
          <p className="text-[11px] text-slate-400">Letters, numbers, - and _ only</p>
        </div>

        {/* Categories — pick MULTIPLE (cascade up to L3) */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Categories <span className="text-slate-400 font-normal text-xs ml-1">(Optional, up to Family / L3 — add multiple)</span></label>
          {pickedCats.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {pickedCats.map((c) => (
                <span key={c.id} className="inline-flex items-center gap-1.5 rounded bg-slate-100 text-slate-700 text-xs px-2 py-1">
                  {c.path}
                  <button type="button" onClick={() => setPickedCats((p) => p.filter((x) => x.id !== c.id))} className="text-slate-400 hover:text-red-600">✕</button>
                </span>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select value={l1Sel} onChange={(e) => setPickCatId(e.target.value)} className={I}>
              <option value="">— Domain —</option>
              {childrenOf(null).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={l2Sel} disabled={!l1Sel} onChange={(e) => setPickCatId(e.target.value || l1Sel)} className={`${I} disabled:opacity-50`}>
              <option value="">{l1Sel ? "— Group (optional) —" : "—"}</option>
              {l1Sel && childrenOf(l1Sel).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={l3Sel} disabled={!l2Sel} onChange={(e) => setPickCatId(e.target.value || l2Sel)} className={`${I} disabled:opacity-50`}>
              <option value="">{l2Sel ? "— Family (optional) —" : "—"}</option>
              {l2Sel && childrenOf(l2Sel).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={addPicked} disabled={!pickCatId} className="rounded-md bg-slate-800 text-white px-3 py-1.5 text-xs font-medium disabled:opacity-40">+ Add category</button>
            <span className="text-[11px] text-slate-400">Pick Domain → Group → Family, then Add. Repeat for multiple.</span>
          </div>
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

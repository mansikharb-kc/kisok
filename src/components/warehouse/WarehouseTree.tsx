"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LocationNode, NODE_META, nodeMeta, ALLOWED_CHILDREN } from "@/lib/warehouseMeta";

export type { LocationNode } from "@/lib/warehouseMeta";

type TreeNode = LocationNode & { children: TreeNode[] };

export default function WarehouseTree({
  programId,
  programName,
  initial,
  canEdit = false,
}: {
  programId: string;
  programName: string;
  initial: LocationNode[];
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const [flowSteps, setFlowSteps] = useState<Array<{ id: string; name: string; level: string; datatype: string }>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`wh_flow_${programId}`);
      if (saved) return JSON.parse(saved);
    }
    if (programName.toLowerCase().includes("catalogue") || programName.toLowerCase().includes("library")) {
      return [
        { id: "L1", name: "Cabinet", level: "WAREHOUSE", datatype: "String" },
        { id: "L2", name: "Shelf", level: "RACK", datatype: "String" },
        { id: "L3", name: "Folder", level: "TRAY", datatype: "String" }
      ];
    }
    return [
      { id: "L1", name: "Warehouse", level: "WAREHOUSE", datatype: "String" },
      { id: "L2", name: "Block / Area", level: "BLOCK", datatype: "String" },
      { id: "L3", name: "Rack / Shelf", level: "RACK", datatype: "String" },
      { id: "L4", name: "Tray / Bin", level: "TRAY", datatype: "String" }
    ];
  });

  const [flowDefined, setFlowDefined] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`wh_flow_defined_${programId}`);
      return saved === "true";
    }
    return false;
  });

  const newHref = (params: Record<string, string>) =>
    `/branch/warehouse/new?${new URLSearchParams({ program: programId, ...params }).toString()}`;

  // Build tree from flat list
  const roots = useMemo<TreeNode[]>(() => {
    const map = new Map<string, TreeNode>();
    for (const n of initial) map.set(n.id, { ...n, children: [] });
    const roots: TreeNode[] = [];
    for (const node of map.values()) {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    const sort = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => a.name.localeCompare(b.name));
      nodes.forEach((n) => sort(n.children));
    };
    sort(roots);
    return roots;
  }, [initial]);

  // Search filtering
  const { visible } = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { visible: null as Set<string> | null };
    const vis = new Set<string>();
    const walk = (n: TreeNode): boolean => {
      let childMatch = false;
      for (const c of n.children) childMatch = walk(c) || childMatch;
      const self =
        n.name.toLowerCase().includes(q) ||
        (n.code ?? "").toLowerCase().includes(q) ||
        n.nodeType.toLowerCase().includes(q);
      if (self || childMatch) { vis.add(n.id); return true; }
      return false;
    };
    roots.forEach(walk);
    return { visible: vis };
  }, [query, roots]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }


  async function toggleStatus(node: LocationNode) {
    setBusy(true);
    await fetch(`/api/location-nodes/${node.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: node.status === "active" ? "inactive" : "active" }),
    });
    setBusy(false);
    router.refresh();
  }

  async function remove(node: LocationNode) {
    if (node._count.copies > 0) {
      alert(
        `Cannot delete "${node.name}" — it has ${node._count.copies} product copies placed here.\n\nPer policy (PRD §B5), all copies must be relocated to another location before this node can be removed.`
      );
      return;
    }
    if (!confirm(`Delete "${node.name}"? ${node._count.children > 0 ? "It has sub-nodes and will be deactivated instead." : "This cannot be undone."}`)) return;
    setBusy(true);
    await fetch(`/api/location-nodes/${node.id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  const blockCount = initial.filter((n) => n.nodeType === "BLOCK").length;
  const rackCount = initial.filter((n) => n.nodeType === "RACK").length;
  const totalCategories = new Set(initial.filter((n) => n.categoryId).map((n) => String(n.categoryId))).size;
  const totalQuantity = initial.reduce((sum, n) => sum + (n._count?.copies ?? 0), 0);

  // Recursive renderer
  function renderNodes(nodes: TreeNode[], depth = 0): React.ReactNode {
    return nodes.map((n) => {
      if (visible && !visible.has(n.id)) return null;
      const meta = nodeMeta(n.nodeType);
      const hasChildren = n.children.length > 0;
      const isOpen = query ? true : expanded.has(n.id);
      const isInactive = n.status === "inactive";
      const allowedChildren = ALLOWED_CHILDREN[n.nodeType] ?? [];

      return (
        <div key={n.id}>
          <div
            className={`group flex items-center gap-2 py-2.5 pr-3 border-b border-slate-100 hover:bg-slate-50 ${isInactive ? "opacity-50" : ""}`}
            style={{ paddingLeft: `${depth * 28 + 12}px` }}
          >
            {/* Expand toggle */}
            {hasChildren ? (
              <button
                onClick={() => toggle(n.id)}
                className="w-5 h-5 shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-700"
              >
                <span className={`text-[10px] transition-transform inline-block ${isOpen ? "rotate-90" : ""}`}>▶</span>
              </button>
            ) : (
              <span className="w-5 shrink-0" />
            )}

            {/* Icon */}
            <span className="text-base shrink-0">{meta.icon}</span>

            {/* Type badge */}
            <span className={`text-[10px] px-2 py-0.5 rounded font-semibold shrink-0 ${meta.badge}`}>
              {flowSteps.find((s) => s.level === n.nodeType)?.name || n.nodeType}
            </span>

            {/* Name + code */}
            <span className="text-sm font-medium text-slate-800 truncate">{n.name}</span>
            {n.code && (
              <span className="font-mono text-[11px] text-slate-400 shrink-0">{n.code}</span>
            )}

            {/* Category tag */}
            {n.category && (
              <div className="flex flex-col items-start gap-0.5 shrink-0">
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-655 font-medium">
                  {n.category.name}
                </span>
                {n.category.categoryAttributes && n.category.categoryAttributes.length > 0 && (
                  <span className="text-[9px] text-slate-400 font-mono pl-1 max-w-[200px] truncate" title={n.category.categoryAttributes.map((ca) => ca.attribute.name).join(", ")}>
                    {n.category.categoryAttributes.map((ca) => ca.attribute.name).join(", ")}
                  </span>
                )}
              </div>
            )}

            {/* Flags */}
            <div className="flex items-center gap-1.5 shrink-0">
              {n.isPlacementEligible && (
                <>
                  <span title="Placement eligible" className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 font-medium"> Placement</span>
                  {n.copies && n.copies.length > 0 ? (
                    n.copies.some((c) => c.copyRole === "MASTER") ? (
                      <span title="Contains Master copy" className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-medium shadow-sm">
                         Master
                      </span>
                    ) : (
                      <span title="Contains Slave copy" className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-750 border border-indigo-200 font-medium shadow-sm">
                         Slave
                      </span>
                    )
                  ) : (
                    <span title="Empty location" className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-250 font-medium">
                      ○ Empty
                    </span>
                  )}
                </>
              )}
              {n.isScreenMountable && (
                <span title="Screen mountable" className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-medium"> Screen</span>
              )}

            </div>

            {/* Status badge */}
            {isInactive && (
              <span className="text-[10px] text-slate-400 border border-slate-300 rounded px-1.5 shrink-0">inactive</span>
            )}

            {/* Child count */}
            {hasChildren && (
              <span className="text-xs text-slate-400 shrink-0 ml-auto mr-3">
                {n._count.children} sub
              </span>
            )}
            {n._count.copies > 0 && (
              <span className="text-xs text-slate-400 shrink-0">
                {n._count.copies} copies
              </span>
            )}

            {/* Hover actions */}
            <div className="ml-auto hidden group-hover:flex items-center gap-3 shrink-0">
              {canEdit && allowedChildren.length > 0 && (
                <Link href={newHref({ parentId: n.id })} className="text-xs text-brand-600 hover:underline whitespace-nowrap">
                  + Sub
                </Link>
              )}
              {canEdit && (
                <Link href={newHref({ editId: n.id })} className="text-xs text-slate-600 hover:underline">Edit</Link>
              )}
              {canEdit && (
                <button
                  onClick={() => toggleStatus(n)}
                  disabled={busy}
                  className="text-xs text-slate-500 hover:underline"
                >
                  {n.status === "active" ? "Deactivate" : "Activate"}
                </button>
              )}
              {canEdit && (
                <button
                  onClick={() => remove(n)}
                  disabled={busy}
                  className="text-xs text-red-600 hover:underline"
                >
                  Delete
                </button>
              )}
            </div>
          </div>

          {/* Children */}
          {isOpen && hasChildren && renderNodes(n.children, depth + 1)}
        </div>
      );
    });
  }

  if (!flowDefined) {
    return (
      <div className="space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Warehouse &amp; Locations</h1>
          <p className="text-sm text-slate-500 mt-1">
            Specify the hierarchical nomenclature flow for program <span className="font-semibold text-slate-700">{programName}</span>.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-md p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">Configure Onboarding Nomenclature &amp; Flow</h2>
            <p className="text-xs text-slate-500 mt-1">
              First define what the flow levels are (with Step ID, Name, Level and Datatype), and then proceed to define actual physical locations.
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-150 bg-white/30">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 w-16">ID</th>
                  <th className="px-4 py-3">Level Name</th>
                  <th className="px-4 py-3 w-48">Node Level / Type</th>
                  <th className="px-4 py-3 w-64">Datatype / Function</th>
                  <th className="px-4 py-3 text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 bg-white/40">
                {flowSteps.map((step, idx) => (
                  <tr key={step.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-500 font-semibold">{step.id}</td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={step.name}
                        onChange={(e) => {
                          const next = [...flowSteps];
                          next[idx].name = e.target.value;
                          setFlowSteps(next);
                        }}
                        placeholder="e.g. Warehouse, Block, Rack..."
                        className="w-full rounded border border-slate-300 px-2.5 py-1.5 focus:ring-1 focus:ring-brand-500 bg-white text-xs font-semibold"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={step.level}
                        onChange={(e) => {
                          const next = [...flowSteps];
                          next[idx].level = e.target.value;
                          next[idx].datatype = "String";
                          setFlowSteps(next);
                        }}
                        className="w-full rounded border border-slate-300 px-2.5 py-1.5 focus:ring-1 focus:ring-brand-500 bg-white text-xs font-semibold cursor-pointer"
                      >
                        <option value="WAREHOUSE">WAREHOUSE</option>
                        <option value="BLOCK">BLOCK</option>
                        <option value="RACK">RACK</option>
                        <option value="TRAY">TRAY</option>
                        <option value="CUSTOM">CUSTOM</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={step.datatype}
                        onChange={(e) => {
                          const next = [...flowSteps];
                          next[idx].datatype = e.target.value;
                          setFlowSteps(next);
                        }}
                        className="w-full rounded border border-slate-300 px-2.5 py-1.5 focus:ring-1 focus:ring-brand-500 bg-white text-xs font-semibold cursor-pointer"
                      >
                        <option value="String">String</option>
                        <option value="Number">Number</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          const next = flowSteps.filter((x) => x.id !== step.id).map((x, i) => ({ ...x, id: `L${i + 1}` }));
                          setFlowSteps(next);
                        }}
                        disabled={flowSteps.length <= 1}
                        className="text-xs text-red-500 hover:text-red-700 font-bold disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={() => {
                const nextId = `L${flowSteps.length + 1}`;
                setFlowSteps([...flowSteps, { id: nextId, name: "", level: "CUSTOM", datatype: "String" }]);
              }}
              className="rounded-md border border-slate-300 text-slate-700 bg-white px-4 py-2 text-xs font-semibold hover:bg-slate-50 transition"
            >
              + Add Level
            </button>

            <button
              type="button"
              onClick={() => {
                if (flowSteps.some(s => !s.name.trim())) {
                  alert("Please enter names for all flow levels.");
                  return;
                }
                localStorage.setItem(`wh_flow_${programId}`, JSON.stringify(flowSteps));
                localStorage.setItem(`wh_flow_defined_${programId}`, "true");
                setFlowDefined(true);
              }}
              className="rounded-md bg-brand-600 text-white px-5 py-2.5 text-xs font-bold hover:bg-brand-700 transition"
            >
              Confirm Flow &amp; Define Locations
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Warehouse &amp; Locations</h1>
        <p className="text-sm text-slate-500 mt-1">
          Building the location tree for program{" "}
          <span className="font-semibold text-slate-700">{programName}</span>. Hierarchy:{" "}
          <span className="font-semibold text-slate-700">{flowSteps.map((s) => s.name).join(" → ")}</span>. Each node can be flagged for product placement and/or screen mounting.
        </p>
      </div>

      {/* Visual Flow Indicator */}
      <div className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-4 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Active Nomenclature &amp; Onboarding Flow
          </span>
          <button
            onClick={() => {
              if (confirm("Are you sure you want to adjust the nomenclature flow? Your created locations will remain, but you can adjust the flow level structure.")) {
                localStorage.setItem(`wh_flow_defined_${programId}`, "false");
                setFlowDefined(false);
              }
            }}
            className="text-[11px] text-brand-600 hover:text-brand-855 font-bold hover:underline"
          >
            Adjust Flow Setup
          </button>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 py-1">
          {flowSteps.map((step, idx) => (
            <div key={step.id} className="flex items-center gap-3">
              <div className="flex flex-col bg-slate-55 border border-slate-200 rounded-lg p-2.5 shadow-xxs max-w-[200px]">
                <div className="text-[10px] font-bold text-slate-400 font-mono leading-none">{step.id}</div>
                <div className="text-xs font-bold text-slate-800 mt-1">{step.name}</div>
                <div className="flex gap-1.5 mt-1">
                  <span className="text-[9px] font-semibold text-brand-700 bg-brand-50 border border-brand-100 rounded px-1.5 py-0.25 uppercase">
                    {step.level}
                  </span>
                  <span className="text-[9px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.25">
                    {step.datatype.split(" ")[0]}
                  </span>
                </div>
              </div>
              {idx < flowSteps.length - 1 && (
                <span className="text-slate-400 font-bold text-sm">➔</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">No. of Blocks</div>
          <div className="mt-1 text-3xl font-bold text-slate-900">{blockCount}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">No. of Racks</div>
          <div className="mt-1 text-3xl font-bold text-slate-900">{rackCount}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Categories</div>
          <div className="mt-1 text-3xl font-bold text-slate-900">{totalCategories}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Quantity</div>
          <div className="mt-1 text-3xl font-bold text-slate-900">{totalQuantity}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search nodes..."
            className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        {canEdit && (
          <Link
            href={newHref({})}
            className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700"
          >
            + Add Warehouse
          </Link>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        {flowSteps.map((step) => {
          const meta = nodeMeta(step.level);
          return (
            <span key={step.id} className={`px-2 py-0.5 rounded font-semibold ${meta.badge}`} title={step.datatype}>
              {step.name}
            </span>
          );
        })}
        <span className="ml-2 text-slate-400">· Hover rows for actions</span>
      </div>

      {/* Main Container */}
      <div className="rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md overflow-hidden">
        {roots.length === 0 ? (
          <div className="px-4 py-16 text-center text-slate-400 text-sm">
            <div className="text-4xl mb-3"></div>
            No locations yet. Click <strong>Add Warehouse</strong> to build your location tree.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {renderNodes(roots)}
          </div>
        )}
      </div>

    </div>
  );
}

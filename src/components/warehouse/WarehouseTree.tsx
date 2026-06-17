"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

export type LocationNode = {
  id: string;
  parentId: string | null;
  nodeType: string;
  name: string;
  code: string | null;
  categoryId: string | null;
  category: {
    id: string;
    name: string;
    code: string;
    categoryAttributes?: {
      attribute: {
        name: string;
        code: string;
      };
    }[];
  } | null;
  path: string | null;
  depth: number;
  isPlacementEligible: boolean;
  isScreenMountable: boolean;
  locationId: string | null;
  status: string;
  _count: { children: number; copies: number };
  copies?: { copyRole: string }[];
};

export type CategoryOption = {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
  categoryAttributes?: {
    attribute: {
      id: string;
      name: string;
      code: string;
    };
  }[];
};

type TreeNode = LocationNode & { children: TreeNode[] };

const NODE_TYPES = ["WAREHOUSE", "BLOCK", "RACK", "TRAY", "CUSTOM"] as const;
type NodeType = (typeof NODE_TYPES)[number];

const NODE_META: Record<NodeType, { badge: string; icon: string; desc: string }> = {
  WAREHOUSE: { badge: "bg-purple-100 text-purple-700", icon: "", desc: "Top-level warehouse / zone" },
  BLOCK:     { badge: "bg-indigo-100 text-indigo-700", icon: "", desc: "Block (docket) — carries the RMS screen" },
  RACK:      { badge: "bg-amber-100 text-amber-700",   icon: "", desc: "Rack — placement eligible" },
  TRAY:      { badge: "bg-green-100 text-green-700",   icon: "", desc: "Tray — placement eligible" },
  CUSTOM:    { badge: "bg-slate-100 text-slate-600",   icon: "", desc: "Custom node type" },
};

function nodeMeta(type: string) {
  return NODE_META[type as NodeType] ?? NODE_META.CUSTOM;
}

function cleanCodeSegment(name: string): string {
  return name
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9_-]/g, "")
    .replace(/-+/g, "-");
}

function combineCode(parentCode: string, segment: string): string {
  const parent = parentCode.trim();
  const child = cleanCodeSegment(segment);
  if (!parent) return child;
  if (parent.endsWith("-") || child.startsWith("-")) {
    return `${parent}${child}`.replace(/-+/g, "-");
  }
  return `${parent}-${child}`;
}

// Allowed child types per parent — warehouse hierarchy:
// WAREHOUSE -> BLOCK -> RACK -> TRAY -> CUSTOM
// A BLOCK (docket) is screen-mountable; RACK and TRAY are placement-eligible.
const ALLOWED_CHILDREN: Record<string, NodeType[]> = {
  WAREHOUSE: ["BLOCK", "RACK", "CUSTOM"],
  BLOCK:     ["RACK", "CUSTOM"],
  RACK:      ["TRAY", "CUSTOM"],
  TRAY:      ["CUSTOM"],
  CUSTOM:    ["CUSTOM", "RACK", "TRAY"],
};

// Default flag suggestions per node type (helps the user pre-fill sensibly)
const DEFAULT_FLAGS: Record<string, { isPlacementEligible: boolean; isScreenMountable: boolean }> = {
  WAREHOUSE: { isPlacementEligible: false, isScreenMountable: false },
  BLOCK:     { isPlacementEligible: false, isScreenMountable: true  },
  RACK:      { isPlacementEligible: true,  isScreenMountable: false },
  TRAY:      { isPlacementEligible: true,  isScreenMountable: false },
  CUSTOM:    { isPlacementEligible: false, isScreenMountable: false },
};

const emptyForm = {
  name: "",
  code: "",
  nodeType: "BLOCK" as NodeType,
  categoryId: "",
  isPlacementEligible: false,
  isScreenMountable: false,
};

export default function WarehouseTree({
  branchId,
  programId,
  programName,
  initial,
  categories,
}: {
  branchId: string;
  programId: string;
  programName: string;
  initial: LocationNode[];
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [isCodeManual, setIsCodeManual] = useState(false);

  // Create / edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<LocationNode | null>(null);
  const [parentNode, setParentNode] = useState<TreeNode | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  // Filter and sort L1 (Domain) categories only
  const l1Categories = useMemo(() => {
    return categories
      .filter((c) => !c.parentId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [categories]);

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

  function openCreate(parent: TreeNode | null) {
    setEditingNode(null);
    setParentNode(parent);
    setIsCodeManual(false);
    const allowed = parent ? ALLOWED_CHILDREN[parent.nodeType] : (["WAREHOUSE"] as NodeType[]);
    const defaultType = allowed[0] ?? "CUSTOM";
    const flags = DEFAULT_FLAGS[defaultType] ?? { isPlacementEligible: false, isScreenMountable: false };
    setForm({
      ...emptyForm,
      nodeType: defaultType,
      code: parent?.code ? (parent.code.endsWith("-") ? parent.code : `${parent.code}-`) : "",
      ...flags,
    });
    setError("");
    setModalOpen(true);
  }

  function openEdit(node: LocationNode) {
    setEditingNode(node);
    setParentNode(null);
    setIsCodeManual(true);
    setForm({
      name: node.name,
      code: node.code ?? "",
      nodeType: node.nodeType as NodeType,
      categoryId: node.categoryId ?? "",
      isPlacementEligible: node.isPlacementEligible,
      isScreenMountable: node.isScreenMountable,
    });
    setError("");
    setModalOpen(true);
  }

  async function saveNode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      let res: Response;
      if (editingNode) {
        res = await fetch(`/api/location-nodes/${editingNode.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            code: form.code || null,
            nodeType: form.nodeType,
            categoryId: form.categoryId || null,
            isPlacementEligible: form.isPlacementEligible,
            isScreenMountable: form.isScreenMountable,
          }),
        });
      } else {
        res = await fetch("/api/location-nodes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            branchId,
            programId,
            parentId: parentNode?.id ?? null,
            name: form.name,
            code: form.code || null,
            nodeType: form.nodeType,
            categoryId: form.categoryId || null,
            isPlacementEligible: form.isPlacementEligible,
            isScreenMountable: form.isScreenMountable,
          }),
        });
      }
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Save failed"); return; }
      // Auto-expand parent after adding child
      if (parentNode) setExpanded((prev) => new Set([...prev, parentNode.id]));
      setModalOpen(false);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
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

  const totalNodes = initial.length;
  const placementNodes = initial.filter((n) => n.isPlacementEligible).length;
  const warehouseCount = roots.length;

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
              {n.nodeType}
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
              {n.locationId && (
                <span className="font-mono text-[10px] text-slate-400">{n.locationId}</span>
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
              {allowedChildren.length > 0 && (
                <button
                  onClick={() => openCreate(n)}
                  className="text-xs text-brand-600 hover:underline whitespace-nowrap"
                >
                  + Sub
                </button>
              )}
              <button onClick={() => openEdit(n)} className="text-xs text-slate-600 hover:underline">Edit</button>
              <button
                onClick={() => toggleStatus(n)}
                disabled={busy}
                className="text-xs text-slate-500 hover:underline"
              >
                {n.status === "active" ? "Deactivate" : "Activate"}
              </button>
              <button
                onClick={() => remove(n)}
                disabled={busy}
                className="text-xs text-red-600 hover:underline"
              >
                Delete
              </button>
            </div>
          </div>

          {/* Children */}
          {isOpen && hasChildren && renderNodes(n.children, depth + 1)}
        </div>
      );
    });
  }

  const allowedRootTypes: NodeType[] = ["WAREHOUSE"];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Warehouse & Locations</h1>
        <p className="text-sm text-slate-500 mt-1">
          Building the location tree for program{" "}
          <span className="font-semibold text-slate-700">{programName}</span>. Hierarchy:
          Warehouse → Block → Rack → Tray. Each node can be flagged for product placement and/or screen mounting.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Nodes</div>
          <div className="mt-1 text-3xl font-bold text-slate-900">{totalNodes}</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-white/60 backdrop-blur-md p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Placement Eligible</div>
          <div className="mt-1 text-3xl font-bold text-emerald-600">{placementNodes}</div>
        </div>
        <div className="rounded-xl border border-purple-200 bg-white/60 backdrop-blur-md p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-purple-600">Warehouses</div>
          <div className="mt-1 text-3xl font-bold text-purple-500">{warehouseCount}</div>
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
        <button
          onClick={() => openCreate(null)}
          className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700"
        >
          + Add Warehouse
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        {Object.entries(NODE_META).map(([type, meta]) => (
          <span key={type} className={`px-2 py-0.5 rounded font-semibold ${meta.badge}`} title={meta.desc}>
            {meta.icon} {type}
          </span>
        ))}
        <span className="ml-2 text-slate-400">· Hover rows for actions · BLOCK = screen · RACK/TRAY = placement</span>
      </div>

      {/* Tree */}
      <div className="rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md overflow-hidden">
        {roots.length === 0 ? (
          <div className="px-4 py-16 text-center text-slate-400 text-sm">
            <div className="text-4xl mb-3"></div>
            No locations yet. Click <strong>Add Warehouse</strong> to build your location tree.
          </div>
        ) : (
          renderNodes(roots)
        )}
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 px-4 py-10 overflow-y-auto">
          <form
            onSubmit={saveNode}
            className="bg-white/60 backdrop-blur-md rounded-xl shadow-xl w-full max-w-md p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">
                {editingNode
                  ? `Edit — ${editingNode.name}`
                  : parentNode
                  ? `Add sub-node under "${parentNode.name}"`
                  : "Add Warehouse"}
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

            {/* Node type */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Node type</label>
              <div className="flex flex-wrap gap-2">
                {(editingNode
                  ? NODE_TYPES
                  : parentNode
                  ? ALLOWED_CHILDREN[parentNode.nodeType] ?? NODE_TYPES
                  : allowedRootTypes
                ).map((t) => {
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
                        form.nodeType === t
                          ? "border-brand-500 bg-brand-50 text-brand-700"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                      title={m.desc}
                    >
                      {m.icon} {t}
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
                    if (!editingNode && !isCodeManual) {
                      const parentCode = parentNode?.code ?? "";
                      next.code = newName.trim()
                        ? combineCode(parentCode, newName)
                        : (parentCode ? (parentCode.endsWith("-") ? parentCode : `${parentCode}-`) : "");
                    }
                    return next;
                  });
                }}
                required
                autoFocus
                placeholder={
                  form.nodeType === "WAREHOUSE" ? "e.g. Immersive Hub" :
                  form.nodeType === "BLOCK"     ? "e.g. Block / Docket D1" :
                  form.nodeType === "RACK"      ? "e.g. Rack R1" :
                  form.nodeType === "TRAY"      ? "e.g. Tray T1" : "e.g. Custom Zone"
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Code */}
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Code <span className="text-red-500">*</span>
                {parentNode?.code && (
                  <span className="text-xs text-slate-400 font-normal ml-1">
                    (Parent prefix: {parentNode.code})
                  </span>
                )}
              </label>
              <input
                value={form.code}
                onChange={(e) => {
                  setIsCodeManual(true);
                  setForm((f) => ({ ...f, code: e.target.value }));
                }}
                required
                placeholder="e.g. WH-01, BLK-A, RCK-1, TRY-1"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <p className="text-[11px] text-slate-400">Letters, numbers, - and _ only</p>
            </div>

            {/* Category */}
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Category <span className="text-slate-400 font-normal text-xs ml-1">(Optional)</span>
              </label>
              <select
                value={form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white/60 backdrop-blur-md"
              >
                <option value="">— None / Select Category —</option>
                {l1Categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400">
                Tag this node with a product category — e.g. Rack A1 holds Faucets. Used by OB Exec during placement.
              </p>
              {(() => {
                const selectedCat = categories.find((c) => String(c.id) === String(form.categoryId));
                const attrs = selectedCat?.categoryAttributes?.map((ca) => ca.attribute) || [];
                if (!form.categoryId) return null;
                return (
                  <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
                      Category Attributes
                    </span>
                    {attrs.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {attrs.map((attr) => (
                          <span key={attr.id} className="inline-flex items-center text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 font-medium">
                            {attr.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No attributes defined for this category.</p>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Flags */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Flags</label>
              <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={form.isPlacementEligible}
                  onChange={(e) => setForm((f) => ({ ...f, isPlacementEligible: e.target.checked }))}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm font-medium text-slate-800"> Placement eligible</div>
                  <div className="text-xs text-slate-500">Products / samples can be physically placed here. A location ID will be generated.</div>
                </div>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={form.isScreenMountable}
                  onChange={(e) => setForm((f) => ({ ...f, isScreenMountable: e.target.checked }))}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm font-medium text-slate-800"> Screen mountable</div>
                  <div className="text-xs text-slate-500">A display screen can be bound to this node (RMS Phase 2).</div>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-60"
              >
                {busy ? "Saving..." : editingNode ? "Save changes" : "Add node"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

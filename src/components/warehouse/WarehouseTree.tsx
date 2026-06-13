"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

export type LocationNode = {
  id: string;
  parentId: string | null;
  nodeType: string;
  name: string;
  code: string | null;
  path: string | null;
  depth: number;
  isPlacementEligible: boolean;
  isScreenMountable: boolean;
  locationId: string | null;
  status: string;
  _count: { children: number; copies: number };
};

type TreeNode = LocationNode & { children: TreeNode[] };

const NODE_TYPES = ["WAREHOUSE", "BLOCK", "RACK", "TRAY", "CUSTOM"] as const;
type NodeType = (typeof NODE_TYPES)[number];

const NODE_META: Record<NodeType, { badge: string; icon: string }> = {
  WAREHOUSE: { badge: "bg-purple-100 text-purple-700", icon: "🏭" },
  BLOCK:     { badge: "bg-blue-100 text-blue-700",    icon: "🗂️" },
  RACK:      { badge: "bg-amber-100 text-amber-700",  icon: "📦" },
  TRAY:      { badge: "bg-green-100 text-green-700",  icon: "🗃️" },
  CUSTOM:    { badge: "bg-slate-100 text-slate-600",  icon: "📌" },
};

function nodeMeta(type: string) {
  return NODE_META[type as NodeType] ?? NODE_META.CUSTOM;
}

// Which child types are allowed under each parent type
const ALLOWED_CHILDREN: Record<string, NodeType[]> = {
  WAREHOUSE: ["BLOCK", "RACK", "CUSTOM"],
  BLOCK:     ["RACK", "CUSTOM"],
  RACK:      ["TRAY", "CUSTOM"],
  TRAY:      ["CUSTOM"],
  CUSTOM:    ["CUSTOM"],
};

const emptyForm = {
  name: "",
  code: "",
  nodeType: "BLOCK" as NodeType,
  isPlacementEligible: false,
  isScreenMountable: false,
};

export default function WarehouseTree({
  branchId,
  initial,
}: {
  branchId: string;
  initial: LocationNode[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Create / edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<LocationNode | null>(null);
  const [parentNode, setParentNode] = useState<TreeNode | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

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
    const allowed = parent ? ALLOWED_CHILDREN[parent.nodeType] : (["WAREHOUSE"] as NodeType[]);
    setForm({ ...emptyForm, nodeType: allowed[0] ?? "CUSTOM" });
    setError("");
    setModalOpen(true);
  }

  function openEdit(node: LocationNode) {
    setEditingNode(node);
    setParentNode(null);
    setForm({
      name: node.name,
      code: node.code ?? "",
      nodeType: node.nodeType as NodeType,
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
            parentId: parentNode?.id ?? null,
            name: form.name,
            code: form.code || null,
            nodeType: form.nodeType,
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
    if (!confirm(`Delete "${node.name}"? If it has sub-nodes or placed products it will be deactivated instead.`)) return;
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

            {/* Flags */}
            <div className="flex items-center gap-1 shrink-0">
              {n.isPlacementEligible && (
                <span title="Placement eligible" className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 font-medium">📍 Placement</span>
              )}
              {n.isScreenMountable && (
                <span title="Screen mountable" className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-medium">🖥️ Screen</span>
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
          Build your branch's physical location tree. Each node can be flagged for product placement and/or screen mounting.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Nodes</div>
          <div className="mt-1 text-3xl font-bold text-slate-900">{totalNodes}</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Placement Eligible</div>
          <div className="mt-1 text-3xl font-bold text-emerald-700">{placementNodes}</div>
        </div>
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-purple-600">Warehouses</div>
          <div className="mt-1 text-3xl font-bold text-purple-700">{warehouseCount}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search nodes…"
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
          <span key={type} className={`px-2 py-0.5 rounded font-semibold ${meta.badge}`}>
            {meta.icon} {type}
          </span>
        ))}
        <span className="ml-2 text-slate-400">· Click row to expand · Hover for actions</span>
      </div>

      {/* Tree */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {roots.length === 0 ? (
          <div className="px-4 py-16 text-center text-slate-400 text-sm">
            <div className="text-4xl mb-3">🏭</div>
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
            className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4"
          >
            <h3 className="text-lg font-bold">
              {editingNode
                ? `Edit — ${editingNode.name}`
                : parentNode
                ? `Add sub-node under "${parentNode.name}"`
                : "Add Warehouse"}
            </h3>

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
                      onClick={() => setForm((f) => ({ ...f, nodeType: t }))}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                        form.nodeType === t
                          ? "border-brand-500 bg-brand-50 text-brand-700"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
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
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                autoFocus
                placeholder={`e.g. ${form.nodeType === "WAREHOUSE" ? "Main Warehouse" : form.nodeType === "BLOCK" ? "Block A" : form.nodeType === "RACK" ? "Rack 1" : "Tray 1"}`}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Code */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Code <span className="text-slate-400 font-normal">(optional)</span></label>
              <input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="e.g. WH-01, BLK-A, RCK-1"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <p className="text-[11px] text-slate-400">Letters, numbers, - and _ only</p>
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
                  <div className="text-sm font-medium text-slate-800">📍 Placement eligible</div>
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
                  <div className="text-sm font-medium text-slate-800">🖥️ Screen mountable</div>
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
                {busy ? "Saving…" : editingNode ? "Save changes" : "Add node"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

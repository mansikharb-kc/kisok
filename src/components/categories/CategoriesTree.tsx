"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LEVELS, MAX_LEVEL, levelMeta, slugify } from "@/lib/categoryLevels";
import CategoryAttributePanel from "./CategoryAttributePanel";
import IconButton from "@/components/ui/IconButton";

export type FlatCategory = {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
  status: string;
};

type TreeNode = FlatCategory & {
  children: TreeNode[];
  level: number; // 1-based depth
  number: string; // "1.2.3"
};

export default function CategoriesTree({ initial, readOnly = false, canCreate = false }: { initial: FlatCategory[]; readOnly?: boolean; canCreate?: boolean }) {
  const requestMode = readOnly && canCreate; // Branch Admin: create = request (HO approval)
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<TreeNode | null>(null);

  // Edit modal state
  const [editing, setEditing] = useState<TreeNode | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Build the tree once from the flat list.
  const { roots } = useMemo(() => {
    const map = new Map<string, TreeNode>();
    for (const c of initial) map.set(c.id, { ...c, children: [], level: 0, number: "" });
    const roots: TreeNode[] = [];
    for (const node of map.values()) {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    const cmp = (a: TreeNode, b: TreeNode) => a.name.localeCompare(b.name);
    const assign = (nodes: TreeNode[], level: number, prefix: string) => {
      nodes.sort(cmp);
      nodes.forEach((n, i) => {
        n.level = level;
        n.number = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
        assign(n.children, level + 1, n.number);
      });
    };
    assign(roots, 1, "");
    return { roots };
  }, [initial]);

  // Search: a node is visible if it matches or has a matching descendant.
  const { visible, autoExpand } = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { visible: null as Set<string> | null, autoExpand: null as Set<string> | null };
    const vis = new Set<string>();
    const exp = new Set<string>();
    const walk = (n: TreeNode): boolean => {
      let childMatch = false;
      for (const c of n.children) childMatch = walk(c) || childMatch;
      const self = n.name.toLowerCase().includes(q);
      if (self || childMatch) {
        vis.add(n.id);
        if (childMatch) exp.add(n.id);
        return true;
      }
      return false;
    };
    roots.forEach(walk);
    return { visible: vis, autoExpand: exp };
  }, [query, roots]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function isOpen(id: string) {
    if (autoExpand) return autoExpand.has(id);
    return expanded.has(id);
  }

  function openCreateRoot() {
    router.push("/masters/categories/new");
  }

  function openCreateChild(parent: TreeNode) {
    const level = Math.min(parent.level + 1, MAX_LEVEL);
    router.push(`/masters/categories/new?level=${level}&parent=${parent.id}`);
  }

  function startEdit(node: TreeNode) {
    setEditing(node);
    setName(node.name);
    setCode(node.code);
    setCodeTouched(true);
    setError("");
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/categories/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Save failed");
        return;
      }
      setEditing(null);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function patchStatus(node: TreeNode) {
    setBusy(true);
    await fetch(`/api/categories/${node.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: node.status === "active" ? "retired" : "active" }),
    });
    setBusy(false);
    router.refresh();
  }

  async function remove(node: TreeNode) {
    if (!confirm(`Archive "${node.name}"? You can restore it later from Archived.`)) return;
    setBusy(true);
    await fetch("/api/archive", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entity: "category", id: node.id, action: "archive" }) });
    setBusy(false);
    router.refresh();
  }

  // Recursive render
  function renderNodes(nodes: TreeNode[]): React.ReactNode {
    return nodes.map((n) => {
      if (n.status === "archived") return null;
      if (visible && !visible.has(n.id)) return null;
      const meta = levelMeta(n.level);
      const hasChildren = n.children.length > 0;
      const open = isOpen(n.id);
      return (
        <div key={n.id}>
          <div
            className={`group flex items-center gap-2 py-2.5 pr-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer ${
              n.status === "retired" ? "opacity-50" : ""
            } ${selected?.id === n.id ? "bg-brand-50" : ""}`}
            style={{ paddingLeft: `${(n.level - 1) * 28 + 8}px` }}
            onClick={() => setSelected(n)}
          >
            {hasChildren ? (
              <button
                onClick={(e) => { e.stopPropagation(); toggle(n.id); }}
                className="w-5 h-5 shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-700"
                aria-label={open ? "Collapse" : "Expand"}
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform ${open ? "rotate-90" : ""}`}
                >
                  <polyline points="9 6 15 12 9 18" />
                </svg>
              </button>
            ) : (
              <span className="w-5 shrink-0" />
            )}

            <span className="text-xs text-slate-400 font-mono w-16 shrink-0">{n.number}</span>

            <span className={`text-[10px] px-2 py-0.5 rounded font-medium shrink-0 ${meta.badge}`}>
              {meta.label}
            </span>

            <span className="text-sm font-medium text-slate-800 truncate">{n.name}</span>

            {n.status === "retired" && (
              <span className="text-[10px] text-slate-400 border border-slate-300 rounded px-1.5">retired</span>
            )}

            <div className="ml-auto flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
              {(canCreate || !readOnly) && (
                <div className="hidden group-hover:flex items-center gap-2">
                  {canCreate && n.level < MAX_LEVEL && (
                    <IconButton kind="add" tone="primary" title={requestMode ? "Request sub-category" : "Add sub-category"} onClick={() => openCreateChild(n)} />
                  )}
                  {/* edit/retire/delete only for HO Admin */}
                  {!readOnly && (
                    <>
                      <IconButton kind="edit" title="Edit" onClick={() => startEdit(n)} />
                      <IconButton kind={n.status === "active" ? "retire" : "activate"} title={n.status === "active" ? "Retire" : "Activate"} onClick={() => patchStatus(n)} />
                      <IconButton kind="archive" title="Archive" onClick={() => remove(n)} />
                    </>
                  )}
                </div>
              )}
              {hasChildren && (
                <span className="text-xs text-slate-400 w-16 text-right">{n.children.length} items</span>
              )}
            </div>
          </div>
          {open && hasChildren && renderNodes(n.children)}
        </div>
      );
    });
  }

  return (
    <div className="flex gap-0">
      <div className="flex-1 min-w-0 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Category Master</h1>
        <p className="text-sm text-slate-500 mt-1">{LEVELS.map((l) => l.label).join(" → ")}</p>
        <p className="text-xs text-slate-400 mt-1">Tip: click any category row to view / map its attributes.</p>
      </div>

      {/* Search + add */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search categories…"
            className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        {canCreate && (
          <button
            onClick={openCreateRoot}
            className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700"
          >
            {requestMode ? "+ Request Category" : "+ New Category"}
          </button>
        )}
      </div>

      {/* Tree */}
      <div className="rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md overflow-hidden">
        {roots.length === 0 ? (
          <div className="px-4 py-12 text-center text-slate-400 text-sm">
            No categories yet. Click <strong>New Category</strong> to create your first one.
          </div>
        ) : (
          renderNodes(roots)
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        {LEVELS.map((l) => (
          <span key={l.label} className={`px-2 py-0.5 rounded font-medium ${l.badge}`}>
            {l.label}
          </span>
        ))}
        <span className="text-slate-400 ml-2">
          {roots.length} domains · {initial.length} total
        </span>
      </div>
      </div>

      {/* Attribute panel (opens when a category is selected) */}
      {selected && (
        <CategoryAttributePanel
          key={selected.id}
          categoryId={selected.id}
          categoryName={selected.name}
          levelLabel={levelMeta(selected.level).label}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Edit modal (name + code) */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <form onSubmit={saveEdit} className="bg-white/60 backdrop-blur-md rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold">Edit category</h3>

            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-sm font-medium">Name</label>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!codeTouched) setCode(slugify(e.target.value));
                }}
                required
                autoFocus
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Code</label>
              <input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setCodeTouched(true);
                }}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <p className="text-[11px] text-slate-400">Unique. Letters, numbers, - and _ only.</p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-60"
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

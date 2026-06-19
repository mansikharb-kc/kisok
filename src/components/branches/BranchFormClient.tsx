"use client";

import Link from "next/link";
import { isNonEmptyString } from "@/lib/validation";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";

type BranchStatus = "active" | "inactive";

type BranchFormValues = {
  name: string;
  branchCode: string;
  status: BranchStatus;
};

async function readApiResponse(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as { error?: string; branch?: { id: string } };
  } catch {
    return { error: text };
  }
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export default function BranchFormClient({
  mode,
  branchId,
  initialValues,
  initialCategories,
  title,
  description,
  submitLabel,
  successRedirect,
}: {
  mode: "create" | "edit";
  branchId?: string;
  initialValues: BranchFormValues;
  initialCategories?: string[];
  title: string;
  description: string;
  submitLabel: string;
  successRedirect: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<BranchFormValues>(initialValues);
  const [codeTouched, setCodeTouched] = useState(mode === "edit");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialCategories ?? []);

  useEffect(() => {
    setForm(initialValues);
    setCodeTouched(mode === "edit");
  }, [initialValues, mode]);

  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await fetch("/api/categories");
        const data = await res.json();
        if (res.ok) {
          setCategories(data.categories ?? []);
        }
      } catch {
        /* ignore */
      }
    }
    loadCategories();
  }, []);

  const l1Domains = useMemo(() => {
    return categories.filter((c) => !c.parentId && c.status === "active");
  }, [categories]);

  const l2GroupsByL1 = useMemo(() => {
    const map: Record<string, any[]> = {};
    categories.forEach((c) => {
      if (c.parentId && c.status === "active") {
        if (!map[String(c.parentId)]) map[String(c.parentId)] = [];
        map[String(c.parentId)].push(c);
      }
    });
    return map;
  }, [categories]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Validate required fields
    if (!isNonEmptyString(form.name)) {
      setError("Branch Name is required");
      return;
    }
    if (!isNonEmptyString(form.branchCode)) {
      setError("Branch Code is required");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(mode === "edit" && branchId ? `/api/branches/${branchId}` : "/api/branches", {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, categoryIds: selectedCategories }),
      });
      const data = await readApiResponse(res);
      if (!res.ok) {
        setError((data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : null) || "Save failed");
        return;
      }
      const nextId = mode === "edit" ? branchId : data && typeof data === "object" && "branch" in data && data.branch ? data.branch.id : branchId;
      if (!nextId) {
        setError("Saved, but branch id was not returned by the API.");
        return;
      }
      router.push(successRedirect.replace("[id]", String(nextId)));
      router.refresh();
    } catch {
      setError("Request failed. Check your session or network connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-600">{description}</p>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <form onSubmit={onSubmit} className="space-y-6 rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-md p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-900">Branch Name</label>
            <input
              value={form.name}
              onChange={(e) => {
                const value = e.target.value;
                setForm((current) => ({ ...current, name: value, branchCode: codeTouched ? current.branchCode : slugify(value) }));
              }}
              required
              autoFocus
              className="w-full rounded-xl border border-slate-300 bg-white/60 backdrop-blur-md px-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              placeholder="e.g. KC One"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-900">Branch Code</label>
            <input
              value={form.branchCode}
              onChange={(e) => {
                setForm((current) => ({ ...current, branchCode: e.target.value }));
                setCodeTouched(true);
              }}
              required
              className="w-full rounded-xl border border-slate-300 bg-white/60 backdrop-blur-md px-4 py-3 text-sm font-mono focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              placeholder="kc-one"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-900">Status</label>
          <select
            value={form.status}
            onChange={(e) => setForm((current) => ({ ...current, status: e.target.value as BranchStatus }))}
            className="w-full rounded-xl border border-slate-300 bg-white/60 backdrop-blur-md px-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
 
        <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-slate-900">Categories</label>
              {l1Domains.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const activeIds = categories.filter((c) => c.status === "active").map((c) => c.id);
                    const allSelected = l1Domains.length > 0 && l1Domains.every((l1) => selectedCategories.includes(l1.id));
                    if (allSelected) {
                      setSelectedCategories([]);
                    } else {
                      setSelectedCategories(activeIds);
                    }
                  }}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700 uppercase tracking-wider"
                >
                  {l1Domains.length > 0 && l1Domains.every((l1) => selectedCategories.includes(l1.id)) ? "Deselect All Categories" : "Select All Categories"}
                </button>
              )}
            </div>
            <div className="rounded-xl border border-slate-300 bg-white/60 backdrop-blur-md p-4 space-y-3 max-h-72 overflow-y-auto shadow-inner">
              {l1Domains.length === 0 ? (
                <span className="text-xs text-slate-400">Loading categories...</span>
              ) : (
                l1Domains.map((l1) => {
                  const groups = l2GroupsByL1[l1.id] || [];
                  const isSelected = selectedCategories.includes(l1.id);
                  const allGroupsSelected = groups.length > 0 && groups.map((g) => g.id).every((id) => selectedCategories.includes(id));
                  return (
                    <div key={l1.id} className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            if (checked) {
                              setSelectedCategories((prev) => [...prev, l1.id]);
                            } else {
                              const groupIds = groups.map((g) => g.id);
                              setSelectedCategories((prev) => prev.filter((id) => id !== l1.id && !groupIds.includes(id)));
                            }
                          }}
                          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-4 w-4"
                        />
                        {l1.name}
                      </label>

                      {isSelected && groups.length > 0 && (
                        <div className="pl-6 border-l border-slate-200 space-y-2 py-1">
                          <div className="flex items-center justify-between">
                            <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">Groups (Optional)</span>
                            <button
                              type="button"
                              onClick={() => {
                                const groupIds = groups.map((g) => g.id);
                                if (allGroupsSelected) {
                                  setSelectedCategories((prev) => prev.filter((id) => !groupIds.includes(id)));
                                } else {
                                  setSelectedCategories((prev) => {
                                    const filtered = prev.filter((id) => !groupIds.includes(id));
                                    return [...filtered, ...groupIds];
                                  });
                                }
                              }}
                              className="text-[10px] font-semibold text-brand-600 hover:text-brand-700 uppercase tracking-wider"
                            >
                              {allGroupsSelected ? "Deselect All" : "Select All"}
                            </button>
                          </div>
                          <div className="grid gap-2 grid-cols-2">
                            {groups.map((l2) => {
                              const isL2Selected = selectedCategories.includes(l2.id);
                              return (
                                <label key={l2.id} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={isL2Selected}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      if (checked) {
                                        setSelectedCategories((prev) => [...prev, l2.id]);
                                      } else {
                                        setSelectedCategories((prev) => prev.filter((id) => id !== l2.id));
                                      }
                                    }}
                                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-3.5 w-3.5"
                                  />
                                  {l2.name}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Branch master follows BRD: name, branch code, and status only. Warehouse and location setup live separately in Branch Setup.
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link href="/masters/branches" className="rounded-xl border border-slate-300 bg-white/60 backdrop-blur-md px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? "Saving…" : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
"use client";

import Link from "next/link";
import { isNonEmptyString } from "@/lib/validation";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
  title,
  description,
  submitLabel,
  successRedirect,
}: {
  mode: "create" | "edit";
  branchId?: string;
  initialValues: BranchFormValues;
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

  useEffect(() => {
    setForm(initialValues);
    setCodeTouched(mode === "edit");
  }, [initialValues, mode]);

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
        body: JSON.stringify(form),
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
        <Link href="/masters/branches" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
          Back to branches
        </Link>
        <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-600">{description}</p>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <form onSubmit={onSubmit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
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
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-mono focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              placeholder="kc-one"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-900">Status</label>
          <select
            value={form.status}
            onChange={(e) => setForm((current) => ({ ...current, status: e.target.value as BranchStatus }))}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Branch master follows BRD: name, branch code, and status only. Warehouse and location setup live separately in Branch Setup.
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link href="/masters/branches" className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
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
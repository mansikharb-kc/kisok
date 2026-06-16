"use client";

import Link from "next/link";
import { isNonEmptyString } from "@/lib/validation";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ProgramRow } from "./ProgramsClient";

type ProgramStatus = "active" | "inactive";

type FormValues = {
  name: string;
  code: string;
  status: ProgramStatus;
};

async function readApiResponse(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as { error?: string; program?: ProgramRow };
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
    .slice(0, 60);
}

export default function ProgramFormClient({
  mode,
  programId,
  initialValues,
  title,
  description,
  submitLabel,
  successRedirect,
}: {
  mode: "create" | "edit";
  programId?: string;
  initialValues: FormValues;
  title: string;
  description: string;
  submitLabel: string;
  successRedirect: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormValues>(initialValues);
  const [codeTouched, setCodeTouched] = useState(mode === "edit");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(initialValues);
    setCodeTouched(mode === "edit");
  }, [initialValues, mode]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    // Validate required fields
    if (!isNonEmptyString(form.name)) {
      setError("Program Name is required");
      return;
    }
    if (!isNonEmptyString(form.code)) {
      setError("Program Code is required");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(mode === "edit" && programId ? `/api/programs/${programId}` : "/api/programs", {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await readApiResponse(res);
      if (!res.ok) {
        setError((data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : null) || "Save failed");
        return;
      }
      const nextId = data && typeof data === "object" && "program" in data && data.program ? data.program.id : programId;
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
        <Link href="/masters/programs" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
          Back to programs
        </Link>
        <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-600">{description}</p>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <form onSubmit={onSubmit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-900">Program Name</label>
            <input
              value={form.name}
              onChange={(e) => {
                const value = e.target.value;
                setForm((current) => ({ ...current, name: value, code: codeTouched ? current.code : slugify(value) }));
              }}
              required
              autoFocus
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              placeholder="e.g. Retail Display"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-900">Code</label>
            <input
              value={form.code}
              onChange={(e) => {
                setForm((current) => ({ ...current, code: e.target.value }));
                setCodeTouched(true);
              }}
              required
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-mono focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              placeholder="retail-display"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-900">Status</label>
          <select
            value={form.status}
            onChange={(e) => setForm((current) => ({ ...current, status: e.target.value as ProgramStatus }))}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          HO programs do not need approval. Bind attributes from the separate Attributes page after save.
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link href="/masters/programs" className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
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
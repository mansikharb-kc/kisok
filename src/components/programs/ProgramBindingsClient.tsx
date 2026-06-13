"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AttributeRow, ProgramRow } from "./ProgramsClient";

function groupAttributes(attributes: AttributeRow[]) {
  const groups = new Map<string, AttributeRow[]>();
  for (const attribute of attributes) {
    const groupName = attribute.sectionGroup || "Ungrouped";
    if (!groups.has(groupName)) groups.set(groupName, []);
    groups.get(groupName)!.push(attribute);
  }
  return [...groups.entries()];
}

async function readApiResponse(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as { error?: string; program?: ProgramRow };
  } catch {
    return { error: text };
  }
}

function AttributeChecklist({
  title,
  attributes,
  selectedIds,
  onToggle,
}: {
  title: string;
  attributes: AttributeRow[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const grouped = useMemo(() => groupAttributes(attributes), [attributes]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-600">Pick the existing attributes that belong to this bucket.</p>
        </div>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
          {selectedIds.size}
        </span>
      </div>

      <div className="mt-4 max-h-[34rem] space-y-3 overflow-y-auto pr-1">
        {grouped.map(([groupName, rows]) => (
          <div key={groupName} className="space-y-2">
            <div className="px-1 text-xs font-bold uppercase tracking-widest text-slate-500">{groupName}</div>
            <div className="space-y-2">
              {rows.map((attribute) => {
                const checked = selectedIds.has(attribute.id);
                return (
                  <label
                    key={attribute.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
                      checked ? "border-brand-300 bg-brand-50" : "border-slate-200 bg-white hover:border-brand-200 hover:bg-brand-50/30"
                    } ${attribute.status !== "active" ? "opacity-70" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(attribute.id)}
                      className="mt-0.5 h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900">{attribute.name}</div>
                      <div className="mt-0.5 text-xs font-mono text-slate-500">{attribute.code}</div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600">
                          {attribute.dataType}
                        </span>
                        {attribute.sectionGroup ? (
                          <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600">
                            {attribute.sectionGroup}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProgramBindingsClient({ program, attributes }: { program: ProgramRow; attributes: AttributeRow[] }) {
  const router = useRouter();
  const [definitionSelected, setDefinitionSelected] = useState<Set<string>>(
    new Set(program.definitionAttributes.map((attribute) => attribute.id)),
  );
  const [commonSelected, setCommonSelected] = useState<Set<string>>(
    new Set(program.commonAttributes.map((attribute) => attribute.id)),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function saveBindings() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/programs/${program.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          definitionAttributeIds: [...definitionSelected],
          commonAttributeIds: [...commonSelected],
        }),
      });
      const data = await readApiResponse(res);
      if (!res.ok) {
        setError((data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : null) || "Save failed");
        return;
      }
      router.refresh();
    } catch {
      setError("Request failed. Check your session or network connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href={`/masters/programs/${program.id}`} className="text-sm font-semibold text-brand-600 hover:text-brand-700">
            Back to program details
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">{program.name} bindings</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">This page only groups existing attributes under the program. Definition attributes are contract terms; common attributes are shared product fields.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/masters/programs/${program.id}/edit`} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Edit core
          </Link>
          <Link href="/masters/programs" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            List
          </Link>
          <button
            type="button"
            onClick={saveBindings}
            disabled={busy}
            className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save mappings"}
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <div className="grid gap-5 lg:grid-cols-2">
        <AttributeChecklist
          title="Contract Attributes"
          attributes={attributes}
          selectedIds={definitionSelected}
          onToggle={(id) => {
            setDefinitionSelected((prev) => {
              const next = new Set(prev);
              next.has(id) ? next.delete(id) : next.add(id);
              return next;
            });
          }}
        />
        <AttributeChecklist
          title="Common Product Attributes"
          attributes={attributes}
          selectedIds={commonSelected}
          onToggle={(id) => {
            setCommonSelected((prev) => {
              const next = new Set(prev);
              next.has(id) ? next.delete(id) : next.add(id);
              return next;
            });
          }}
        />
      </div>
    </div>
  );
}
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import IconButton from "@/components/ui/IconButton";

export type AttributeRow = {
  id: string;
  name: string;
  code: string;
  dataType: string;
  sectionGroup: string | null;
  status: string;
};

export type ProgramRow = {
  id: string;
  name: string;
  code: string;
  status: string;
  definitionAttributes: AttributeRow[];
  commonAttributes: AttributeRow[];
  branchCount: number;
  contractCount: number;
  localCount: number;
};

type ProgramStatus = "active" | "inactive";

const emptyForm = {
  name: "",
  code: "",
  status: "active" as ProgramStatus,
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function groupAttributes(attributes: AttributeRow[]) {
  const groups = new Map<string, AttributeRow[]>();
  for (const attribute of attributes) {
    const groupName = attribute.sectionGroup || "Ungrouped";
    if (!groups.has(groupName)) groups.set(groupName, []);
    groups.get(groupName)!.push(attribute);
  }
  return [...groups.entries()];
}

function attributeLabel(attribute: AttributeRow) {
  return `${attribute.name} · ${attribute.code}`;
}

export default function ProgramsClient({
  initialPrograms,
  readOnly = false,
}: {
  initialPrograms: ProgramRow[];
  attributes: AttributeRow[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return initialPrograms;
    return initialPrograms.filter((program) => {
      const haystack = [
        program.name,
        program.code,
        program.status,
        ...program.definitionAttributes.map(attributeLabel),
        ...program.commonAttributes.map(attributeLabel),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [initialPrograms, query]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative max-w-md flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search programs..."
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-3 lg:ml-auto">
          <span className="text-sm text-slate-500">{initialPrograms.length} total</span>
          {!readOnly && (
            <button type="button" onClick={() => router.push("/masters/programs/new")} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
              + New Program
            </button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white/60 backdrop-blur-md px-6 py-16 text-center">
          <h4 className="text-base font-semibold text-slate-800">No programs created yet</h4>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">Create a program first. Then open its detail or edit page separately.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md overflow-hidden">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium w-[26%]">Program</th>
                <th className="px-4 py-3 text-left font-medium w-[16%]">Code</th>
                <th className="px-4 py-3 text-left font-medium w-[14%]">Status</th>
                <th className="px-4 py-3 text-left font-medium w-[32%]">Usage</th>
                <th className="px-4 py-3 text-right font-medium w-[12%]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((program) => (
                <tr
                  key={program.id}
                  onClick={() => router.push(`/masters/programs/${program.id}`)}
                  className={`cursor-pointer hover:bg-slate-50 ${program.status === "inactive" ? "opacity-70" : ""}`}
                >
                  <td className="px-4 py-3 align-middle">
                    <div className="font-semibold text-slate-900 truncate">{program.name}</div>
                    <div className="text-[11px] text-slate-400">ID {program.id}</div>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-white">{program.code}</span>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold capitalize text-white ${program.status === "active" ? "bg-emerald-600" : "bg-slate-500"}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      {program.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-middle text-[11px] text-slate-500 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <span><span className="font-semibold text-slate-700">{program.branchCount}</span> branches</span>
                      <span className="text-slate-300">·</span>
                      <span><span className="font-semibold text-slate-700">{program.contractCount}</span> contracts</span>
                      <span className="text-slate-300">·</span>
                      <span><span className="font-semibold text-slate-700">{program.localCount}</span> local records</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 align-middle text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex justify-end gap-2">
                      <IconButton kind="view" title="View" onClick={() => router.push(`/masters/programs/${program.id}`)} />
                      {!readOnly && (
                        <IconButton kind="edit" title="Edit" tone="primary" onClick={() => router.push(`/masters/programs/${program.id}/edit`)} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
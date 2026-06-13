"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

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
  attributes,
}: {
  initialPrograms: ProgramRow[];
  attributes: AttributeRow[];
}) {
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

  const totalBindings = initialPrograms.reduce(
    (sum, program) => sum + program.definitionAttributes.length + program.commonAttributes.length,
    0,
  );

  const activeCount = initialPrograms.filter((program) => program.status === "active").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="group rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm transition-all hover:shadow-md hover:border-slate-300">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Programs</div>
              <div className="mt-2 text-4xl font-bold text-slate-900">{initialPrograms.length}</div>
            </div>
            <div className="text-3xl opacity-10 group-hover:opacity-15 transition-opacity">📋</div>
          </div>
          {initialPrograms.length === 0 && (
            <div className="mt-3 text-xs text-slate-400">Start by creating your first program.</div>
          )}
        </div>

        <div className="group rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm transition-all hover:shadow-md hover:border-emerald-300">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Active</div>
              <div className="mt-2 text-4xl font-bold text-emerald-700">{activeCount}</div>
            </div>
            <div className="text-3xl opacity-20 group-hover:opacity-30 transition-opacity">✓</div>
          </div>
          <div className="mt-3 h-1 w-full rounded-full bg-emerald-100">
            <div className="h-full rounded-full bg-emerald-400" style={{ width: `${initialPrograms.length > 0 ? (activeCount / initialPrograms.length) * 100 : 0}%` }} />
          </div>
        </div>

        <div className="group rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-5 shadow-sm transition-all hover:shadow-md hover:border-brand-300">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-brand-600">Attributes</div>
              <div className="mt-2 text-4xl font-bold text-brand-700">{attributes.length}</div>
            </div>
            <div className="text-3xl opacity-20 group-hover:opacity-30 transition-opacity">🏷️</div>
          </div>
          <div className="mt-3 text-xs text-slate-500">Available for mapping</div>
        </div>

        <div className="group rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm transition-all hover:shadow-md hover:border-indigo-300">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Bindings</div>
              <div className="mt-2 text-4xl font-bold text-indigo-700">{totalBindings}</div>
            </div>
            <div className="text-3xl opacity-20 group-hover:opacity-30 transition-opacity">🔗</div>
          </div>
          <div className="mt-3 text-xs text-slate-500">Across all programs</div>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-2xl flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search programs, codes, or bound attributes…"
            className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-12 pr-4 text-sm placeholder-slate-400 shadow-sm transition-all focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>
        <div className="inline-flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200">
          <div className="h-2 w-2 rounded-full bg-brand-500"></div>
          {rows.length} {rows.length === 1 ? "program" : "programs"} shown
        </div>
        <Link
          href="/masters/programs/new"
          className="flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-brand-700 hover:shadow-xl active:scale-95"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Program
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">Program Master List</h3>
          <p className="mt-1 text-xs text-slate-500">Open details, edit, or attribute bindings on separate pages.</p>
        </div>

        {rows.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
              <svg className="h-8 w-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h4 className="text-lg font-semibold text-slate-900">No programs created yet</h4>
            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-600">Create a program first. Then open its detail, edit, or attribute-binding page separately.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1060px] text-sm">
              <thead className="bg-white text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Program</th>
                  <th className="px-4 py-3 text-left font-medium">Code</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Attributes</th>
                  <th className="px-4 py-3 text-left font-medium">Usage</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((program) => (
                  <tr key={program.id} className={`hover:bg-brand-50/40 ${program.status === "inactive" ? "opacity-70" : ""}`}>
                    <td className="px-4 py-3 align-middle">
                      <Link href={`/masters/programs/${program.id}`} className="block">
                        <div className="font-semibold text-slate-900 transition-colors hover:text-brand-700">{program.name}</div>
                        <div className="text-[11px] text-slate-400">ID {program.id}</div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 align-middle font-mono text-[11px] text-slate-600">{program.code}</td>
                    <td className="px-4 py-3 align-middle">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${program.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${program.status === "active" ? "bg-emerald-500" : "bg-slate-300"}`} />
                        {program.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle text-xs text-slate-500">
                      <div>{program.definitionAttributes.length} definition</div>
                      <div>{program.commonAttributes.length} common</div>
                    </td>
                    <td className="px-4 py-3 align-middle text-xs text-slate-500">
                      <div>{program.branchCount} branches</div>
                      <div>{program.contractCount} contracts</div>
                      <div>{program.localCount} local records</div>
                    </td>
                    <td className="px-4 py-3 align-middle text-right whitespace-nowrap min-w-[320px]">
                      <div className="inline-flex flex-nowrap justify-end gap-2">
                        <Link href={`/masters/programs/${program.id}`} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50">
                          View
                        </Link>
                        <Link href={`/masters/programs/${program.id}/attributes`} className="rounded-full border border-brand-200 px-3 py-1.5 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50">
                          Bindings
                        </Link>
                        <Link href={`/masters/programs/${program.id}/edit`} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50">
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
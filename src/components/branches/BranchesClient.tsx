"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type BranchRow = {
  id: string;
  name: string;
  branchCode: string;
  status: string;
};

export default function BranchesClient({ initial }: { initial: BranchRow[] }) {
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return initial;
    return initial.filter((branch) => {
      const haystack = [branch.name, branch.branchCode, branch.status].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [initial, query]);

  const activeCount = initial.filter((branch) => branch.status === "active").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Active</div>
          <div className="mt-2 text-4xl font-bold text-emerald-700">{activeCount}</div>
        </div>
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Master records</div>
          <div className="mt-2 text-4xl font-bold text-indigo-700">{initial.length}</div>
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
            placeholder="Search branches or branch codes…"
            className="w-full rounded-xl border border-slate-300 bg-white/60 backdrop-blur-md py-3 pl-12 pr-4 text-sm placeholder-slate-400 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>
        <Link href="/masters/branches/new" className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-brand-700">
          New Branch
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-md shadow-sm">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">Branch Master List</h3>
          <p className="mt-1 text-xs text-slate-500">Branch master only. Warehouse and location setup live in the Branch Setup area.</p>
        </div>

        {rows.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <h4 className="text-lg font-semibold text-slate-900">No branches found</h4>
            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-600">Create the first branch master row to start the warehouse and branch setup flow.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-white/60 backdrop-blur-md text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Branch</th>
                  <th className="px-4 py-3 text-left font-medium">Code</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((branch) => (
                  <tr key={branch.id} className={`hover:bg-brand-50/40 ${branch.status === "inactive" ? "opacity-70" : ""}`}>
                    <td className="px-4 py-3 align-middle">
                      <Link href={`/masters/branches/${branch.id}`} className="block">
                        <div className="font-semibold text-slate-900 hover:text-brand-700">{branch.name}</div>
                        <div className="text-[11px] text-slate-400">ID {branch.id}</div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 align-middle font-mono text-[11px] text-slate-600">{branch.branchCode}</td>
                    <td className="px-4 py-3 align-middle">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${branch.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${branch.status === "active" ? "bg-emerald-500" : "bg-slate-300"}`} />
                        {branch.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle text-right whitespace-nowrap min-w-[320px]">
                      <div className="inline-flex flex-nowrap justify-end gap-2">
                        <Link href={`/masters/branches/${branch.id}`} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                          View
                        </Link>
                        <Link href={`/masters/branches/${branch.id}/edit`} className="rounded-full border border-brand-200 px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50">
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
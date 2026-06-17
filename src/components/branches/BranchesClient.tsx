"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import IconButton from "@/components/ui/IconButton";

export type BranchRow = {
  id: string;
  name: string;
  branchCode: string;
  status: string;
};

export default function BranchesClient({ initial }: { initial: BranchRow[] }) {
  const router = useRouter();
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
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Branches</h1>
        <p className="mt-1 text-sm text-slate-500">Branch master only. Warehouse and location setup live in the Branch Setup area.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Active</div>
          <div className="mt-2 text-4xl font-bold text-emerald-600">{activeCount}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Master records</div>
          <div className="mt-2 text-4xl font-bold text-indigo-600">{initial.length}</div>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative max-w-md flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search branches or codes..."
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex items-center gap-3 lg:ml-auto">
          <span className="text-sm text-slate-500">{initial.length} total</span>
          <button type="button" onClick={() => router.push("/masters/branches/new")} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            + New Branch
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white/60 backdrop-blur-md px-6 py-16 text-center">
          <h4 className="text-base font-semibold text-slate-800">No branches found</h4>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">Create the first branch master row to start the warehouse and branch setup flow.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md overflow-hidden">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium w-[40%]">Branch</th>
                <th className="px-4 py-3 text-left font-medium w-[22%]">Code</th>
                <th className="px-4 py-3 text-left font-medium w-[22%]">Status</th>
                <th className="px-4 py-3 text-right font-medium w-[16%]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((branch) => (
                <tr
                  key={branch.id}
                  onClick={() => router.push(`/masters/branches/${branch.id}`)}
                  className={`cursor-pointer hover:bg-slate-50 ${branch.status === "inactive" ? "opacity-70" : ""}`}
                >
                  <td className="px-4 py-3 align-middle">
                    <div className="font-semibold text-slate-900 truncate">{branch.name}</div>
                    <div className="text-[11px] text-slate-400">ID {branch.id}</div>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-white">{branch.branchCode}</span>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${branch.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${branch.status === "active" ? "bg-emerald-500" : "bg-slate-300"}`} />
                      {branch.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-middle text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex justify-end gap-2">
                      <IconButton kind="view" title="View" onClick={() => router.push(`/masters/branches/${branch.id}`)} />
                      <IconButton kind="edit" title="Edit" tone="primary" onClick={() => router.push(`/masters/branches/${branch.id}/edit`)} />
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
"use client";

import { useState } from "react";
import BrandDetailsModal from "@/components/brands/BrandDetailsModal";

interface LeadAssignmentsTableProps {
  assignments: any[];
}

export default function LeadAssignmentsTable({ assignments }: LeadAssignmentsTableProps) {
  const [selectedBrandDetailsId, setSelectedBrandDetailsId] = useState<string | null>(null);

  return (
    <div className="bg-white/60 backdrop-blur-md rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Task Assignments & Progress Tracking</h2>
          <p className="text-xs text-slate-500 mt-0.5">Track onboarding activities assigned to executives</p>
        </div>
        <a href="/ops/assignments" className="text-xs font-semibold text-brand-600 hover:underline">
          Manage Assignments →
        </a>
      </div>
      {assignments.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-400">
          No active assignments. Start by assigning a seller to an executive.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 text-[10px] font-semibold uppercase tracking-wider">
                <th className="px-5 py-3">Assigned Exec</th>
                <th className="px-5 py-3">Seller &amp; Program</th>
                <th className="px-5 py-3">Associated Brands</th>
                <th className="px-5 py-3">Progress</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {assignments.map((a: any) => (
                <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold">
                        {a.exec.fullName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800">{a.exec.fullName}</div>
                        <div className="text-[10px] text-slate-400">{a.exec.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-slate-800">{a.seller.name}</div>
                    <div className="text-xs text-slate-400 font-mono">
                      {a.seller.sellerCode} {a.program ? `· ${a.program.name}` : ""}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {a.seller.sellerBrands.map((sb: any) => (
                        <button
                          key={sb.brand.code}
                          type="button"
                          onClick={() => setSelectedBrandDetailsId(sb.brand.id)}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-brand-50 hover:bg-brand-100 text-brand-700 hover:text-brand-800 font-semibold border border-brand-200 transition-all text-left shadow-sm hover:scale-[1.03]"
                        >
                          {sb.brand.name}
                        </button>
                      ))}
                      {a.seller.sellerBrands.length === 0 && (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-slate-700">{a.onboardedCount} SKU{a.onboardedCount !== 1 ? "s" : ""} onboarded</div>
                  </td>
                  <td className="px-5 py-3.5">
                    {a.onboardedCount > 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-emerald-600 text-white px-2.5 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-amber-600 text-white px-2.5 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        Pending Onboarding
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BrandDetailsModal
        brandId={selectedBrandDetailsId}
        onClose={() => setSelectedBrandDetailsId(null)}
      />
    </div>
  );
}

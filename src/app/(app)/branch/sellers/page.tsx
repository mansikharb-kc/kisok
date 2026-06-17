import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";
import Link from "next/link";
import { formatDaysToYMD } from "@/lib/brandMeta";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasRole(session.roles, "BRANCH_ADMIN")) redirect("/dashboard");

  const branchRole = session.roles.find((r) => r.code === "BRANCH_ADMIN" && r.branchId);
  const branchId = branchRole?.branchId ? BigInt(branchRole.branchId) : null;
  if (!branchId) redirect("/dashboard");

  const sellers = await prisma.seller.findMany({
    where: { branchId, status: { not: "archived" } },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: {
      sellerBrands: { include: { brand: { select: { name: true, code: true } } } },
      contracts: { include: { program: { select: { name: true } } } },
      assignments: { include: { exec: { select: { fullName: true } } } },
      _count: { select: { consignments: true, localRecords: true } },
    },
  });

  const rows = serialize(sellers) as any[];

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900">Sellers</h1>
          <span className="text-[11px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">View only</span>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Sellers registered at this branch. Managed by the Onboarding Lead.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 backdrop-blur-md p-12 text-center text-sm text-slate-400">
          No sellers registered yet. The Onboarding Lead manages sellers.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Seller</th>
                <th className="px-4 py-3 text-left font-medium">Membership ID</th>
                <th className="px-4 py-3 text-left font-medium">Brands</th>
                <th className="px-4 py-3 text-left font-medium">Programs / Contracts</th>
                <th className="px-4 py-3 text-left font-medium">Fitout Period ( In Days )</th>
                <th className="px-4 py-3 text-left font-medium">Assigned Exec</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((s: any) => (
                <tr key={s.id} className={`hover:bg-slate-50 ${s.status !== "active" ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3 align-middle">
                    <div className="font-semibold text-slate-800">{s.name}</div>
                    <div className="font-mono text-[11px] text-slate-400">{s.sellerCode}</div>
                  </td>
                  <td className="px-4 py-3 align-middle font-mono text-xs text-slate-600">
                    {s.membershipId ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex flex-wrap gap-1">
                      {s.sellerBrands.length === 0
                        ? <span className="text-slate-300 text-xs">—</span>
                        : s.sellerBrands.map((sb: any) => (
                          <span key={sb.brand.code} className="text-[11px] px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">
                            {sb.brand.name}
                          </span>
                        ))
                      }
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex flex-wrap gap-1">
                      {s.contracts.length === 0
                        ? <span className="text-slate-300 text-xs">—</span>
                        : s.contracts.map((c: any) => (
                          <span key={c.id} className={`text-[11px] px-2 py-0.5 rounded-full ${c.verified ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                            {c.program.name} {c.verified ? "✓" : ""}
                          </span>
                        ))
                      }
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex flex-wrap gap-1">
                      {s.contracts.length === 0
                        ? <span className="text-slate-300 text-xs">—</span>
                        : s.contracts.map((c: any) => {
                          const rawDays = c.fitoutPeriod ? c.fitoutPeriod.replace(/\D/g, "") : "";
                          const ymd = formatDaysToYMD(c.fitoutPeriod);
                          return (
                            <span key={c.id} className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium border border-slate-200">
                              {c.program.name}: {rawDays ? `${rawDays} Days` : <span className="text-slate-400">N/A</span>}
                              {ymd && ` (${ymd})`}
                            </span>
                          );
                        })
                      }
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle text-xs text-slate-600">
                    {s.assignments.length === 0
                      ? <span className="text-amber-500">Unassigned</span>
                      : s.assignments.map((a: any) => a.exec.fullName).join(", ")
                    }
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${s.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${s.status === "active" ? "bg-emerald-500" : "bg-slate-300"}`} />
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-middle text-[11px] text-slate-500">
                    <div>{s._count.consignments} consignments</div>
                    <div>{s._count.localRecords} products</div>
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

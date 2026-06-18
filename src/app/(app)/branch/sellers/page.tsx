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
          <table className="w-full table-fixed text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
              <tr>
                <th className="px-4 py-3 text-left whitespace-nowrap w-[15%]">Seller</th>
                <th className="px-3 py-3 text-center whitespace-nowrap w-[12%]">Membership ID</th>
                <th className="px-4 py-3 text-left whitespace-nowrap w-[11%]">Brands</th>
                <th className="px-4 py-3 text-left whitespace-nowrap w-[13%]">Programs</th>
                <th className="px-4 py-3 text-left whitespace-nowrap w-[14%]">Fitout Period</th>
                <th className="px-4 py-3 text-left whitespace-nowrap w-[11%]">Assigned Exec</th>
                <th className="px-4 py-3 text-left whitespace-nowrap w-[8%]">Status</th>
                <th className="px-4 py-3 text-left whitespace-nowrap w-[16%]">Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((s: any) => (
                <tr key={s.id} className={`hover:bg-slate-50 ${s.status !== "active" ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3 align-top">
                    <div className="font-semibold text-slate-800 truncate">{s.name}</div>
                    <div className="font-mono text-[11px] text-slate-400 truncate">{s.sellerCode}</div>
                  </td>
                  <td className="px-3 py-3 align-top text-center">
                    {s.membershipId
                      ? <span className="inline-block rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-white whitespace-nowrap">{s.membershipId}</span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {s.sellerBrands.length === 0
                      ? <span className="text-slate-300 text-xs">—</span>
                      : <div className="flex flex-col gap-0.5 text-xs text-slate-600">
                          {s.sellerBrands.map((sb: any) => <span key={sb.brand.code} className="truncate">{sb.brand.name}</span>)}
                        </div>}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {s.contracts.length === 0
                      ? <span className="text-slate-300 text-xs">—</span>
                      : <div className="flex flex-col gap-0.5 text-xs">
                          {s.contracts.map((c: any) => (
                            <span key={c.id} className={c.verified ? "text-emerald-600" : "text-amber-600"}>
                              {c.program.name}{c.verified ? " ✓" : ""}
                            </span>
                          ))}
                        </div>}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {s.contracts.length === 0
                      ? <span className="text-slate-300 text-xs">—</span>
                      : <div className="flex flex-col gap-0.5 text-xs text-slate-600">
                          {s.contracts.map((c: any) => {
                            const rawDays = c.fitoutPeriod ? c.fitoutPeriod.replace(/\D/g, "") : "";
                            const ymd = formatDaysToYMD(c.fitoutPeriod);
                            return (
                              <span key={c.id}>
                                <span className="font-medium text-slate-700">{rawDays ? `${rawDays} days` : "N/A"}</span>
                                {ymd ? <span className="text-slate-400"> ({ymd})</span> : null}
                              </span>
                            );
                          })}
                        </div>}
                  </td>
                  <td className="px-4 py-3 align-top text-xs">
                    {s.assignments.length === 0
                      ? <span className="inline-flex items-center gap-1.5 text-amber-600 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                          Unassigned
                        </span>
                      : <span className="text-slate-600">{s.assignments.map((a: any) => a.exec.fullName).join(", ")}</span>}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-white ${s.status === "active" ? "bg-emerald-600" : "bg-slate-500"}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      <span className="capitalize">{s.status}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top text-[11px] text-slate-500 whitespace-nowrap">
                    <div><span className="font-semibold text-slate-700">{s._count.consignments}</span> consignments</div>
                    <div><span className="font-semibold text-slate-700">{s._count.localRecords}</span> products</div>
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

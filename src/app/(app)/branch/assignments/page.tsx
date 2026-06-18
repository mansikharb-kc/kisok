import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasRole(session.roles, "BRANCH_ADMIN")) redirect("/dashboard");

  const branchRole = session.roles.find((r) => r.code === "BRANCH_ADMIN" && r.branchId);
  const branchId = branchRole?.branchId ? BigInt(branchRole.branchId) : null;
  if (!branchId) redirect("/dashboard");

  const assignments = await prisma.sellerAssignment.findMany({
    where: { seller: { branchId } },
    orderBy: { assignedAt: "desc" },
    include: {
      seller: {
        select: {
          name: true, sellerCode: true, membershipId: true, status: true,
          sellerBrands: { include: { brand: { select: { name: true } } } },
        },
      },
      exec: { select: { fullName: true, email: true } },
    },
  });

  // Group by exec
  const byExec = new Map<string, { exec: { fullName: string; email: string }; sellers: any[] }>();
  for (const a of serialize(assignments) as any[]) {
    const key = a.exec.email;
    if (!byExec.has(key)) byExec.set(key, { exec: a.exec, sellers: [] });
    byExec.get(key)!.sellers.push(a.seller);
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900">Assignments</h1>
          <span className="text-[11px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">View only</span>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Which Onboarding Exec is handling which seller. Managed by the Onboarding Lead.
        </p>
      </div>

      {byExec.size === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 backdrop-blur-md p-12 text-center text-sm text-slate-400">
          No assignments yet. The Onboarding Lead assigns sellers to execs.
        </div>
      ) : (
        <div className="space-y-4">
          {[...byExec.values()].map(({ exec, sellers }) => (
            <div key={exec.email} className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {exec.fullName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-slate-800 text-sm">{exec.fullName}</div>
                  <div className="text-[11px] text-slate-400">{exec.email} · OB Exec · {sellers.length} seller{sellers.length !== 1 ? "s" : ""}</div>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {sellers.map((s: any) => (
                  <div key={s.sellerCode} className={`flex items-center gap-4 px-5 py-3 ${s.status !== "active" ? "opacity-50" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-800 text-sm">{s.name}</div>
                      <div className="font-mono text-[11px] text-slate-400">{s.sellerCode} {s.membershipId ? `· ${s.membershipId}` : ""}</div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {s.sellerBrands.map((sb: any) => (
                        <span key={sb.brand.name} className="text-[11px] px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">
                          {sb.brand.name}
                        </span>
                      ))}
                    </div>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold text-white capitalize ${s.status === "active" ? "bg-emerald-600" : "bg-slate-500"}`}>
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

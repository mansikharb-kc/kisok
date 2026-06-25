import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";
import OnboardingList from "@/components/ops/OnboardingList";
import ClickableRow from "@/components/ops/ClickableRow";
import OnboardingStatusSelect from "@/components/ops/OnboardingStatusSelect";
import { updateAssignmentOnboardingStatus } from "@/lib/onboardingStatusHelper";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const isExec = hasRole(session.roles, "OB_EXEC");
  const isLead = hasRole(session.roles, "ONB_LEAD");
  if (!isExec && !isLead) redirect("/dashboard");

  // Branch comes from the OB_EXEC (preferred) or ONB_LEAD (read-only) role entry.
  const roleEntry =
    session.roles.find((r) => r.code === "OB_EXEC" && r.branchId) ??
    session.roles.find((r) => r.code === "ONB_LEAD" && r.branchId);
  const branchId = roleEntry?.branchId ? BigInt(roleEntry.branchId) : null;
  if (!branchId) redirect("/dashboard");

  // OB_EXEC: restrict to sellers ASSIGNED to this exec. ONB_LEAD: whole branch (read-only).
  let sellerFilter: { in: bigint[] } | undefined;
  let obExecAssignmentsList: any[] = [];
  if (isExec) {
    const assignments = await prisma.sellerAssignment.findMany({
      where: { obExecUserId: BigInt(session.uid), seller: { branchId } },
      orderBy: { assignedAt: "desc" },
    });

    // Sync onboarding status of all tasks to ensure they match current pipelines and flags
    await Promise.all(assignments.map((a) => updateAssignmentOnboardingStatus(a.id)));

    // Re-fetch assignments with all details now that their onboardingStatus columns are synced
    const updatedAssignments = await prisma.sellerAssignment.findMany({
      where: { obExecUserId: BigInt(session.uid), seller: { branchId } },
      orderBy: { assignedAt: "desc" },
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            sellerCode: true,
            membershipId: true,
            status: true,
            sellerBrands: { include: { brand: { select: { id: true, name: true, code: true } } } },
            directConsignments: { select: { id: true } },
          },
        },
        program: { select: { id: true, name: true, code: true } },
      },
    });

    const sellerIds = updatedAssignments.map((a) => a.sellerId);
    // No assignments → match nothing (sentinel id keeps the type a bigint[]).
    sellerFilter = { in: sellerIds.length ? sellerIds : [BigInt(0)] };

    const detailed = await Promise.all(
      updatedAssignments.map(async (a) => {
        const onboardedCount = await prisma.localOnboardingRecord.count({
          where: {
            sellerId: a.sellerId,
            branchId,
            ...(a.programId ? { programId: a.programId } : {}),
          },
        });
        return {
          ...a,
          onboardedCount,
        };
      })
    );
    obExecAssignmentsList = serialize(detailed) as any[];
  }
  const where = { branchId, ...(sellerFilter ? { sellerId: sellerFilter } : {}) };

  const [records, branch] = await Promise.all([
    prisma.localOnboardingRecord.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        product: {
          select: {
            name: true,
            sku: true,
            brand: { select: { id: true, name: true, code: true } },
            category: { select: { name: true, code: true } },
          },
        },
        seller: { select: { name: true, sellerCode: true } },
        program: { select: { name: true, code: true } },
        tickets: {
          select: {
            id: true,
            ticketNo: true,
            type: true,
            status: true,
          },
        },
      },
    }),
    prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } }),
  ]);

  const rows = serialize(records) as any[];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Product Onboarding</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isExec
              ? `Products you have onboarded for your assigned sellers at ${branch?.name ?? "your branch"}.`
              : `Onboarded products at ${branch?.name ?? "your branch"} (view only).`}
          </p>
        </div>
      </div>


      {isExec && (
        <div className="bg-white/60 backdrop-blur-md rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-800">Open Onboarding Tickets</h2>
            <p className="text-xs text-slate-500 mt-0.5">Sellers assigned to you for product onboarding</p>
          </div>
          {obExecAssignmentsList.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              No tasks assigned. Please contact your Onboarding Lead.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 text-[10px] font-semibold uppercase tracking-wider">
                    <th className="px-5 py-3">Seller Name &amp; Code</th>
                    <th className="px-5 py-3">Assigned Program</th>
                    <th className="px-5 py-3">Associated Brands</th>
                    <th className="px-5 py-3">Progress</th>
                    <th className="px-5 py-3">Onboarding Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {obExecAssignmentsList.map((a: any) => (
                    <ClickableRow
                      key={a.id}
                      href={`/ops/onboarding/task/${a.id}`}
                      className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
                    >
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                          {a.seller.name}
                          {a.seller.directConsignments && a.seller.directConsignments.length > 0 && (
                            <span className="inline-block text-[9px] bg-orange-50 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider">
                              Direct Consignment
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {a.seller.sellerCode} {a.seller.membershipId ? `· ${a.seller.membershipId}` : ""}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {a.program ? (
                          <div>
                            <span className="font-medium text-slate-700">{a.program.name}</span>
                            <div className="text-[10px] text-slate-400 font-mono">{a.program.code}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {a.seller.sellerBrands.map((sb: any) => (
                            <span key={sb.brand.code} className="text-[10px] px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 font-medium">
                              {sb.brand.name}
                            </span>
                          ))}
                          {a.seller.sellerBrands.length === 0 && (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-700">{a.onboardedCount} SKU{a.onboardedCount !== 1 ? "s" : ""}</span>
                          {a.onboardedCount === 0 && (
                            <span className="text-[10px] bg-amber-50 text-amber-700 font-medium px-1.5 py-0.5 rounded border border-amber-200">
                              Not Started
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <OnboardingStatusSelect assignmentId={a.id} status={a.onboardingStatus} />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          href={`/ops/onboarding/task/${a.id}`}
                          className="inline-flex items-center gap-1.5 rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
                        >
                          View Task
                        </Link>
                      </td>
                    </ClickableRow>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <OnboardingList records={rows} isExec={isExec} />
    </div>
  );
}

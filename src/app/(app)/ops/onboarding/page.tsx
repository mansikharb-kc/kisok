import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";
import OnboardingList from "@/components/ops/OnboardingList";

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
  if (isExec) {
    const assignments = await prisma.sellerAssignment.findMany({
      where: { obExecUserId: BigInt(session.uid), seller: { branchId } },
      select: { sellerId: true },
    });
    const sellerIds = assignments.map((a) => a.sellerId);
    // No assignments → match nothing (sentinel id keeps the type a bigint[]).
    sellerFilter = { in: sellerIds.length ? sellerIds : [BigInt(0)] };
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
            brand: { select: { name: true, code: true } },
            category: { select: { name: true, code: true } },
          },
        },
        seller: { select: { name: true, sellerCode: true } },
        program: { select: { name: true, code: true } },
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
        {isExec && (
          <Link
            href="/ops/onboarding/new"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
          >
            + Onboard Product
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Total Onboarded
          </div>
          <div className="mt-1 text-3xl font-bold text-slate-900">{rows.length}</div>
        </div>
      </div>

      <OnboardingList records={rows} />
    </div>
  );
}

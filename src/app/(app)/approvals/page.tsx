import { redirect } from "next/navigation";
import { prisma, serialize } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import ApprovalsClient, { type ChangeRequestRow } from "@/components/approvals/ApprovalsClient";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const session = await getSession();
  if (!session || !hasRole(session.roles, "HO_ADMIN")) redirect("/dashboard");

  const requests = await prisma.changeRequest.findMany({
    orderBy: { createdAt: "desc" },
  });

  const userIds = [...new Set(requests.map((r) => r.requestedBy).filter(Boolean) as bigint[])];
  const branchIds = [...new Set(requests.map((r) => r.branchId).filter(Boolean) as bigint[])];

  const [users, branches] = await Promise.all([
    userIds.length
      ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true } })
      : [],
    branchIds.length
      ? prisma.branch.findMany({ where: { id: { in: branchIds } }, select: { id: true, name: true } })
      : [],
  ]);

  const userMap = new Map(users.map((u) => [u.id.toString(), u.fullName]));
  const branchMap = new Map(branches.map((b) => [b.id.toString(), b.name]));

  const enriched: ChangeRequestRow[] = serialize(requests)
    .map((r: any) => ({
      id: r.id,
      type: r.type,
      payload: r.payload,
      branchId: r.branchId,
      branchName: r.branchId ? branchMap.get(String(r.branchId)) ?? "Unknown Branch" : null,
      requestedByName: r.requestedBy ? userMap.get(String(r.requestedBy)) ?? "Someone" : "System",
      status: r.status,
      decidedAt: r.decidedAt,
      reason: r.reason,
      createdAt: r.createdAt,
    }))
    // Pending first, recent within each group (createdAt already desc).
    .sort((a: ChangeRequestRow, b: ChangeRequestRow) => {
      const ap = a.status === "pending" ? 0 : 1;
      const bp = b.status === "pending" ? 0 : 1;
      return ap - bp;
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Approvals Inbox</h1>
        <p className="mt-1 text-sm text-slate-500">
          Review, approve, or reject change requests submitted by branches.
        </p>
      </div>
      <ApprovalsClient initialRequests={enriched} />
    </div>
  );
}

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";
import TicketsPageClient from "@/components/ops/TicketsPageClient";

export const dynamic = "force-dynamic";

export default async function OpsTicketsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const isProjectUser = hasRole(session.roles, "PROJECT_USER");
  const isConciergeManager = hasRole(session.roles, "CONCIERGE_MANAGER");
  const isOnbLead = hasRole(session.roles, "ONB_LEAD");

  if (!isProjectUser && !isConciergeManager && !isOnbLead) {
    redirect("/dashboard");
  }

  // Find active branch ID
  const roleEntry = session.roles.find(
    (r) => ["PROJECT_USER", "CONCIERGE_MANAGER", "ONB_LEAD"].includes(r.code) && r.branchId
  );
  const branchId = roleEntry?.branchId ? BigInt(roleEntry.branchId) : null;
  if (!branchId) redirect("/dashboard");

  const ticketWhere: any = { branchId };
  if (!isOnbLead) {
    ticketWhere.currentRole = isProjectUser ? "PROJECT_USER" : "CONCIERGE_MANAGER";
  }

  const ticketRows = await prisma.ticket.findMany({
    where: ticketWhere,
    orderBy: { updatedAt: "desc" },
    include: {
      seller: { select: { name: true, sellerCode: true } },
      brand: { select: { name: true } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });

  const tickets = serialize(ticketRows) as any[];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Assigned Tickets</h1>
        <p className="text-sm text-slate-500 mt-1">
          Track and resolve operational requests assigned to your role.
        </p>
      </div>

      <TicketsPageClient tickets={tickets} userRoles={session.roles.map(r => r.code)} />
    </div>
  );
}

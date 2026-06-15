import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";
import TicketsClient from "@/components/ops/TicketsClient";

export const dynamic = "force-dynamic";

export default async function ConsignmentsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasRole(session.roles, "OB_EXEC", "CONSIGNMENT_USER", "ONB_LEAD")) redirect("/dashboard");

  const roleEntry = session.roles.find(
    (r) => ["OB_EXEC", "CONSIGNMENT_USER", "ONB_LEAD"].includes(r.code) && r.branchId,
  );
  const branchId = roleEntry?.branchId ? BigInt(roleEntry.branchId) : null;
  if (!branchId) redirect("/dashboard");

  const isExec = hasRole(session.roles, "OB_EXEC");
  const isConsign = hasRole(session.roles, "CONSIGNMENT_USER");
  const isOverseer = hasRole(session.roles, "CONSIGNMENT_USER", "ONB_LEAD");
  const uid = BigInt(session.uid);

  const ticketWhere = isOverseer ? { branchId } : { branchId, raisedBy: uid };

  const [ticketRows, assignments] = await Promise.all([
    prisma.ticket.findMany({
      where: ticketWhere,
      orderBy: [{ updatedAt: "desc" }],
      include: {
        seller: { select: { name: true, sellerCode: true } },
        brand: { select: { name: true } },
        record: { include: { product: { select: { name: true, sku: true } } } },
        events: { orderBy: { createdAt: "asc" } },
      },
    }),
    isExec
      ? prisma.sellerAssignment.findMany({
          where: { obExecUserId: uid, seller: { branchId } },
          include: {
            seller: {
              select: {
                id: true,
                name: true,
                sellerCode: true,
                sellerBrands: { include: { brand: { select: { id: true, name: true } } } },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const tickets = serialize(ticketRows);
  const sellers = serialize(
    assignments.map((a) => ({
      id: a.seller.id,
      name: a.seller.name,
      sellerCode: a.seller.sellerCode,
      brands: a.seller.sellerBrands.map((sb) => sb.brand),
    })),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Consignment Tickets</h1>
        <p className="text-sm text-slate-500 mt-1">
          Sample / fabrication / damage requests bounce between OB Exec and Consignment User until resolved.
        </p>
      </div>
      <TicketsClient
        tickets={tickets as never[]}
        sellers={sellers as never[]}
        canRaise={isExec}
        isExec={isExec}
        isConsign={isConsign}
      />
    </div>
  );
}

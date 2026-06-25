import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";
import TicketsClient from "@/components/ops/TicketsClient";

export const dynamic = "force-dynamic";

export default async function ConsignmentsPage({
  searchParams,
}: {
  searchParams: { status?: string; tab?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasRole(session.roles, "OB_EXEC", "CONSIGNMENT_USER", "ONB_LEAD")) redirect("/dashboard");

  const initialStatus = searchParams.status || "";
  const initialTab = searchParams.tab || "tickets";

  const roleEntry = session.roles.find(
    (r) => ["OB_EXEC", "CONSIGNMENT_USER", "ONB_LEAD"].includes(r.code) && r.branchId,
  );
  const branchId = roleEntry?.branchId ? BigInt(roleEntry.branchId) : null;
  if (!branchId) redirect("/dashboard");

  const isExec = hasRole(session.roles, "OB_EXEC");
  const isConsign = hasRole(session.roles, "CONSIGNMENT_USER");
  const isLead = hasRole(session.roles, "ONB_LEAD");
  const isOverseer = hasRole(session.roles, "CONSIGNMENT_USER", "ONB_LEAD");
  const uid = BigInt(session.uid);

  // Filter tickets by active branch context
  const ticketWhere: any = { branchId };
  if (isConsign) {
    ticketWhere.type = { in: ["SAMPLE_REQUEST", "FABRICATION", "DAMAGE"] };
  }

  const [ticketRows, assignments, obExecs, consignmentRows] = await Promise.all([
    prisma.ticket.findMany({
      where: ticketWhere,
      orderBy: [{ updatedAt: "desc" }],
      include: {
        seller: { select: { name: true, sellerCode: true } },
        brand: { select: { name: true } },
        record: { include: { product: { select: { name: true, sku: true } } } },
        events: { orderBy: { createdAt: "asc" } },
        onboardingPipeline: true,
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
    isLead
      ? prisma.user.findMany({
          where: {
            roles: {
              some: {
                role: { code: "OB_EXEC" },
                branchId,
              },
            },
          },
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        })
      : Promise.resolve([]),
    prisma.consignment.findMany({
      where: { seller: { branchId } },
      orderBy: { updatedAt: "desc" },
      include: {
        seller: { select: { name: true, sellerCode: true } },
        brand: { select: { name: true } },
        items: {
          select: {
            id: true,
            description: true,
            expectedQty: true,
            receivedQty: true,
            sampleType: true,
            status: true,
          },
        },
      },
    }),
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
  const execs = serialize(obExecs);
  const consignments = serialize(consignmentRows);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Consignments &amp; Tickets</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage physical shipments, QC steps, and track requests between OB Exec and Consignment User.
        </p>
      </div>
      <TicketsClient
        tickets={tickets as never[]}
        sellers={sellers as never[]}
        execs={execs as never[]}
        consignments={consignments as never[]}
        canRaise={false}
        isExec={isExec}
        isConsign={isConsign}
        isLead={isLead}
        initialStatus={initialStatus}
        initialTab={initialTab}
      />
    </div>
  );
}

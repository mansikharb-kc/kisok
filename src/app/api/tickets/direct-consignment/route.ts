import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const createDirectSchema = z.object({
  sellerName: z.string().trim().min(1).max(150),
  brandName: z.string().trim().min(1).max(150),
  receivedDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  vehicleDetails: z.string().trim().max(255).optional().nullable(),
  quantityReceived: z.number().int().nonnegative(),
  boxQc: z.string().trim().max(100),
  photographUrl: z.string().trim().max(255).optional().nullable(),
  packingListDoc: z.string().trim().max(255).optional().nullable(),
  remarks: z.string().trim().max(2000).optional().nullable(),
  membershipId: z.string().trim().max(60).optional().nullable(),
  memberType: z.string().trim().max(40).optional().nullable(),
  salesperson: z.string().trim().max(120).optional().nullable(),
  spocName: z.string().trim().max(120).optional().nullable(),
  spocPhone: z.string().trim().max(30).optional().nullable(),
  spocEmail: z.string().trim().max(150).optional().nullable(),
});

function branchOf(session: any, codes: string[]): bigint | null {
  const r = session.roles.find((x: any) => codes.includes(x.code) && x.branchId);
  return r?.branchId ? BigInt(r.branchId) : null;
}

async function nextTicketNo(): Promise<string> {
  const existing = await prisma.ticket.findMany({
    where: { ticketNo: { startsWith: "TKT-" } },
    select: { ticketNo: true },
  });
  let max = 0;
  for (const e of existing) {
    const n = parseInt((e.ticketNo ?? "").split("-")[1] ?? "0", 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `TKT-${String(max + 1).padStart(4, "0")}`;
}

export const POST = handler(async (req: Request) => {
  const session = await requireRole("CONSIGNMENT_USER");
  const branchId = branchOf(session, ["CONSIGNMENT_USER"]);
  if (!branchId) return fail("No active branch role found", 403);

  const parsed = createDirectSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const ticketNo = await nextTicketNo();
  const ticket = await prisma.$transaction(async (tx) => {
    const t = await tx.ticket.create({
      data: {
        ticketNo,
        type: "DIRECT_CONSIGNMENT",
        branchId,
        title: `Direct Consignment: ${parsed.data.sellerName} - ${parsed.data.brandName}`,
        description: JSON.stringify(parsed.data),
        status: "WITH_LEAD",
        currentRole: "ONB_LEAD",
        raisedBy: BigInt(session.uid),
      },
    });

    await tx.ticketEvent.create({
      data: {
        ticketId: t.id,
        byUserId: BigInt(session.uid),
        action: "raise",
        fromRole: "CONSIGNMENT_USER",
        toRole: "ONB_LEAD",
        note: `Direct consignment received. Qty: ${parsed.data.quantityReceived}, QC: ${parsed.data.boxQc}. Pushed to Onboarding Lead.`,
      },
    });

    return t;
  });

  await writeAudit({
    actorUserId: session.uid,
    action: "ticket.create_direct",
    entityType: "Ticket",
    entityId: ticket.id,
    after: { ticketNo, type: "DIRECT_CONSIGNMENT", title: ticket.title },
  });

  return ok({ ticket }, { status: 201 });
});

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { TICKET_TYPE_VALUES } from "@/lib/ticketMeta";

// Branch id from whichever relevant role the caller holds.
function branchOf(session: { roles: { code: string; branchId: string | null }[] }, codes: string[]) {
  const r = session.roles.find((x) => codes.includes(x.code) && x.branchId);
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

export const GET = handler(async () => {
  const session = await requireRole("OB_EXEC", "CONSIGNMENT_USER", "ONB_LEAD");
  const branchId = branchOf(session, ["OB_EXEC", "CONSIGNMENT_USER", "ONB_LEAD"]);
  if (!branchId) return fail("No active branch role found", 403);

  // OB Exec (without consignment/lead) sees only tickets they raised.
  const isOverseer = session.roles.some((r) => ["CONSIGNMENT_USER", "ONB_LEAD"].includes(r.code));
  const where: { branchId: bigint; raisedBy?: bigint } = { branchId };
  if (!isOverseer) where.raisedBy = BigInt(session.uid);

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
    include: {
      seller: { select: { name: true, sellerCode: true } },
      brand: { select: { name: true } },
      record: { include: { product: { select: { name: true, sku: true } } } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  return ok({ tickets });
});

const createSchema = z.object({
  type: z.enum(TICKET_TYPE_VALUES as [string, ...string[]]),
  sellerId: z.coerce.bigint(),
  brandId: z.coerce.bigint().optional().nullable(),
  localRecordId: z.coerce.bigint().optional().nullable(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
});

export const POST = handler(async (req: Request) => {
  const session = await requireRole("OB_EXEC");
  const branchId = branchOf(session, ["OB_EXEC"]);
  if (!branchId) return fail("No active branch role found", 403);

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  const { type, sellerId, brandId, localRecordId, title, description } = parsed.data;

  const seller = await prisma.seller.findUnique({ where: { id: sellerId }, select: { branchId: true } });
  if (!seller || seller.branchId !== branchId) return fail("Seller not in your branch", 422);

  const ticketNo = await nextTicketNo();
  const ticket = await prisma.$transaction(async (tx) => {
    const t = await tx.ticket.create({
      data: {
        ticketNo,
        type,
        branchId,
        sellerId,
        brandId: brandId ?? null,
        localRecordId: localRecordId ?? null,
        title,
        description: description ?? null,
        status: "WITH_CONSIGNMENT",
        currentRole: "CONSIGNMENT_USER",
        raisedBy: BigInt(session.uid),
      },
    });
    await tx.ticketEvent.create({
      data: {
        ticketId: t.id,
        byUserId: BigInt(session.uid),
        action: "raise",
        fromRole: "OB_EXEC",
        toRole: "CONSIGNMENT_USER",
        note: description ?? null,
      },
    });
    return t;
  });

  await writeAudit({
    actorUserId: session.uid,
    action: "ticket.create",
    entityType: "Ticket",
    entityId: ticket.id,
    after: { ticketNo, type, title },
  });

  return ok({ ticket }, { status: 201 });
});

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

function parseId(id: string): bigint | null {
  try {
    return BigInt(id);
  } catch {
    return null;
  }
}

function branchOf(session: { roles: { code: string; branchId: string | null }[] }, codes: string[]) {
  const r = session.roles.find((x) => codes.includes(x.code) && x.branchId);
  return r?.branchId ? BigInt(r.branchId) : null;
}

const patchSchema = z.object({
  action: z.enum(["note", "send_to_exec", "send_to_consignment", "resolve", "close", "transfer"]),
  note: z.string().trim().max(1000).optional().nullable(),
  resolution: z.string().trim().max(500).optional().nullable(),
  targetExecId: z.string().optional().nullable(),
});

export const PATCH = handler(async (req: Request, ctx: { params: { id: string } }) => {
  const session = await requireRole("OB_EXEC", "CONSIGNMENT_USER", "ONB_LEAD");
  const id = parseId(ctx.params.id);
  if (id === null) return fail("Invalid id", 400);

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  const { action, note, resolution, targetExecId } = parsed.data;

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) return fail("Ticket not found", 404);

  const branchId = branchOf(session, ["OB_EXEC", "CONSIGNMENT_USER", "ONB_LEAD"]);
  if (!branchId || ticket.branchId !== branchId) return fail("Forbidden", 403);

  const isExec = session.roles.some((r) => r.code === "OB_EXEC");
  const isConsign = session.roles.some((r) => r.code === "CONSIGNMENT_USER");
  const isLead = session.roles.some((r) => r.code === "ONB_LEAD");

  let data: Record<string, unknown> = {};
  let fromRole: string | null = null;
  let toRole: string | null = null;

  if (action === "note") {
    fromRole = ticket.currentRole;
  } else if (action === "send_to_exec") {
    if (!isConsign || ticket.currentRole !== "CONSIGNMENT_USER") return fail("Only the Consignment User holding this ticket can send it to the exec", 403);
    data = { status: "WITH_EXEC", currentRole: "OB_EXEC" };
    fromRole = "CONSIGNMENT_USER";
    toRole = "OB_EXEC";
  } else if (action === "send_to_consignment") {
    if (!isExec || ticket.currentRole !== "OB_EXEC") return fail("Only the OB Exec holding this ticket can send it to consignment", 403);
    data = { status: "WITH_CONSIGNMENT", currentRole: "CONSIGNMENT_USER" };
    fromRole = "OB_EXEC";
    toRole = "CONSIGNMENT_USER";
  } else if (action === "resolve") {
    const ownerOk = (ticket.currentRole === "OB_EXEC" && isExec) || (ticket.currentRole === "CONSIGNMENT_USER" && isConsign);
    if (!ownerOk) return fail("Only the current holder can resolve this ticket", 403);
    data = { status: "RESOLVED", resolvedAt: new Date(), resolution: resolution ?? null };
    fromRole = ticket.currentRole;
  } else if (action === "close") {
    if (!isExec) return fail("Only an OB Exec can close a ticket", 403);
    data = { status: "CLOSED" };
    fromRole = "OB_EXEC";
  } else if (action === "transfer") {
    if (!isLead) return fail("Only the Onboarding Lead can transfer a ticket", 403);
    if (!targetExecId) return fail("Target exec is required for transfer", 422);
    const targetUserId = BigInt(targetExecId);
    const hasRoleInBranch = await prisma.userRole.findFirst({
      where: { userId: targetUserId, role: { code: "OB_EXEC" }, branchId },
    });
    if (!hasRoleInBranch) {
      return fail("Target user must be an Onboarding Exec in this branch", 422);
    }
    data = { raisedBy: targetUserId, status: "WITH_EXEC", currentRole: "OB_EXEC" };
    fromRole = ticket.currentRole;
    toRole = "OB_EXEC";
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = Object.keys(data).length ? await tx.ticket.update({ where: { id }, data }) : ticket;
    await tx.ticketEvent.create({
      data: { ticketId: id, byUserId: BigInt(session.uid), action, fromRole, toRole, note: note ?? null },
    });
    return u;
  });

  await writeAudit({
    actorUserId: session.uid,
    action: `ticket.${action}`,
    entityType: "Ticket",
    entityId: id,
    after: { ticketNo: updated.ticketNo, status: updated.status },
  });

  return ok({ ticket: updated });
});

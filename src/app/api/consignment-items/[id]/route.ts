import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const updateSchema = z
  .object({
    receivedQty: z.coerce.number().int().min(0).optional().nullable(),
    status: z.string().trim().min(1).max(20).optional(),
  })
  .refine((d) => d.receivedQty !== undefined || d.status !== undefined, {
    message: "Provide receivedQty and/or status to update",
  });

function parseId(id: string): bigint | null {
  try {
    return BigInt(id);
  } catch {
    return null;
  }
}

export const PATCH = handler(async (req: Request, { params }: { params: { id: string } }) => {
  const session = await requireRole("CONSIGNMENT_USER");
  const id = parseId(params.id);
  if (id === null) return fail("Invalid id", 400);

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const item = await prisma.consignmentItem.findUnique({
    where: { id },
    include: { consignment: { include: { seller: { select: { branchId: true } } } } },
  });
  if (!item) return fail("Consignment item not found", 404);

  const ownsBranch = session.roles.some(
    (r) =>
      r.code === "CONSIGNMENT_USER" &&
      String(r.branchId) === String(item.consignment.seller.branchId)
  );
  if (!ownsBranch) return fail("Forbidden — not your branch", 403);

  const data: { receivedQty?: number | null; status?: string } = {};
  if (parsed.data.receivedQty !== undefined) data.receivedQty = parsed.data.receivedQty;
  if (parsed.data.status !== undefined) data.status = parsed.data.status;

  const updated = await prisma.consignmentItem.update({ where: { id }, data });

  await writeAudit({
    actorUserId: session.uid,
    action: "consignmentItem.update",
    entityType: "ConsignmentItem",
    entityId: id,
    before: { receivedQty: item.receivedQty, status: item.status },
    after: { receivedQty: updated.receivedQty, status: updated.status },
  });

  return ok({ item: updated });
});

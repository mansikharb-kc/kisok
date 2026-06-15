import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const qcSchema = z.object({
  result: z.enum(["pass", "flag", "repair", "fabricate"]),
  notes: z.string().trim().max(500).optional().nullable(),
});

function parseId(id: string): bigint | null {
  try {
    return BigInt(id);
  } catch {
    return null;
  }
}

export const POST = handler(async (req: Request, { params }: { params: { id: string } }) => {
  const session = await requireRole("CONSIGNMENT_USER");
  const id = parseId(params.id);
  if (id === null) return fail("Invalid id", 400);

  const parsed = qcSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  const { result, notes } = parsed.data;

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

  // pass → item passed; flag/repair/fabricate → item flagged for follow-up.
  const itemStatus = result === "pass" ? "passed" : "flagged";

  const qc = await prisma.$transaction(async (tx) => {
    const record = await tx.qcRecord.create({
      data: {
        consignmentItemId: id,
        result,
        notes: notes ?? null,
        qcBy: BigInt(session.uid),
        qcAt: new Date(),
      },
    });
    await tx.consignmentItem.update({ where: { id }, data: { status: itemStatus } });
    return record;
  });

  await writeAudit({
    actorUserId: session.uid,
    action: "consignment.qc",
    entityType: "ConsignmentItem",
    entityId: id,
    after: { result, itemStatus },
  });

  return ok({ qcRecord: qc, itemStatus }, { status: 201 });
});

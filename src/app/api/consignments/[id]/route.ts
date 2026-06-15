import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

// Ordered consignment pipeline (BRD Module D).
const PIPELINE = [
  "initiated",
  "received",
  "in_buffer",
  "fabricating",
  "qc",
  "passed_back",
  "closed",
] as const;

const updateSchema = z.object({
  status: z.enum(PIPELINE),
});

function parseId(id: string): bigint | null {
  try {
    return BigInt(id);
  } catch {
    return null;
  }
}

export const PATCH = handler(async (req: Request, { params }: { params: { id: string } }) => {
  // Advancing the physical pipeline is the Consignment User's job.
  const session = await requireRole("CONSIGNMENT_USER");
  const id = parseId(params.id);
  if (id === null) return fail("Invalid id", 400);

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  const { status } = parsed.data;

  const consignment = await prisma.consignment.findUnique({
    where: { id },
    include: { seller: { select: { branchId: true } } },
  });
  if (!consignment) return fail("Consignment not found", 404);

  // Branch scoping — consignment branch is the seller's branch.
  const ownsBranch = session.roles.some(
    (r) => r.code === "CONSIGNMENT_USER" && String(r.branchId) === String(consignment.seller.branchId)
  );
  if (!ownsBranch) return fail("Forbidden — not your branch", 403);

  // Only allow forward movement by one step (or staying flagged at the same node).
  const fromIdx = PIPELINE.indexOf(consignment.status as (typeof PIPELINE)[number]);
  const toIdx = PIPELINE.indexOf(status);
  if (toIdx <= fromIdx) {
    return fail(`Cannot move from "${consignment.status}" back to "${status}".`, 400);
  }
  if (toIdx !== fromIdx + 1) {
    return fail(`Status must advance one step at a time (next: "${PIPELINE[fromIdx + 1]}").`, 400);
  }

  const updated = await prisma.consignment.update({
    where: { id },
    data: { status },
  });

  await writeAudit({
    actorUserId: session.uid,
    action: "consignment.status",
    entityType: "Consignment",
    entityId: id,
    before: { status: consignment.status },
    after: { status: updated.status },
  });

  return ok({ consignment: updated });
});

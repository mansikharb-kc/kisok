import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const updateSchema = z.object({
  label: z.string().trim().min(1).max(60),
  dimensions: z.string().trim().max(120).optional().nullable(),
  status: z.enum(["active", "inactive"]),
});

export const PATCH = handler(async (req: Request, { params }: { params: { id: string } }) => {
  const session = await requireRole("ONB_LEAD", "OB_EXEC");
  const id = BigInt(params.id);

  const sampleSize = await prisma.sampleSize.findUnique({ where: { id } });
  if (!sampleSize) return fail("Sample size not found", 404);

  // Verify ownership
  const ownsBranch = session.roles.some(
    (r) => (r.code === "ONB_LEAD" || r.code === "OB_EXEC") && String(r.branchId) === String(sampleSize.branchId)
  );
  if (!ownsBranch) return fail("Forbidden — not your branch", 403);

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const { label, dimensions, status } = parsed.data;

  // Check unique label constraint if changed
  if (label !== sampleSize.label) {
    const existing = await prisma.sampleSize.findFirst({
      where: { branchId: sampleSize.branchId, label },
    });
    if (existing) return fail(`Sample size label "${label}" already exists.`, 400);
  }

  const updated = await prisma.sampleSize.update({
    where: { id },
    data: {
      label,
      dimensions: dimensions ?? null,
      status,
    },
  });

  await writeAudit({
    actorUserId: session.uid,
    action: "sampleSize.update",
    entityType: "SampleSize",
    entityId: updated.id,
    before: { label: sampleSize.label, dimensions: sampleSize.dimensions, status: sampleSize.status },
    after: { label: updated.label, dimensions: updated.dimensions, status: updated.status },
  });

  return ok({ sampleSize: updated });
});

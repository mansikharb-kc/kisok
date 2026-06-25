import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const createSchema = z.object({
  branchId: z.coerce.bigint(),
  label: z.string().trim().min(1).max(60),
  dimensions: z.string().trim().max(120).optional().nullable(),
  status: z.enum(["active", "inactive"]).optional(),
});

export const POST = handler(async (req: Request) => {
  const session = await requireRole("ONB_LEAD", "OB_EXEC");
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const { branchId, label, dimensions, status } = parsed.data;

  // Verify branch ownership
  const ownsBranch = session.roles.some(
    (r) => (r.code === "ONB_LEAD" || r.code === "OB_EXEC") && String(r.branchId) === String(branchId)
  );
  if (!ownsBranch) return fail("Forbidden — not your branch", 403);

  // Check if unique label for this branch
  const existing = await prisma.sampleSize.findFirst({
    where: { branchId, label },
  });
  if (existing) return fail(`Sample size label "${label}" already exists in this branch.`, 400);

  const sampleSize = await prisma.sampleSize.create({
    data: {
      branchId,
      label,
      dimensions: dimensions ?? null,
      status: status ?? "active",
    },
  });

  await writeAudit({
    actorUserId: session.uid,
    action: "sampleSize.create",
    entityType: "SampleSize",
    entityId: sampleSize.id,
    after: { label: sampleSize.label, dimensions: sampleSize.dimensions, status: sampleSize.status },
  });

  return ok({ sampleSize }, { status: 201 });
});

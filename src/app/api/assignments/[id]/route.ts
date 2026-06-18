import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { ONBOARDING_STATUS_VALUES } from "@/lib/onboardingMeta";

function parseId(id: string): bigint | null {
  try {
    return BigInt(id);
  } catch {
    return null;
  }
}

const patchSchema = z.object({
  onboardingStatus: z.enum(ONBOARDING_STATUS_VALUES as [string, ...string[]]),
});

// OB Exec updates the onboarding status of an assignment they own.
export const PATCH = handler(async (req: Request, ctx: { params: { id: string } }) => {
  const session = await requireRole("OB_EXEC");
  const id = parseId(ctx.params.id);
  if (id === null) return fail("Invalid id", 400);

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const target = await prisma.sellerAssignment.findUnique({
    where: { id },
    select: { id: true, obExecUserId: true, onboardingStatus: true },
  });
  if (!target) return fail("Assignment not found", 404);
  if (String(target.obExecUserId) !== String(session.uid)) {
    return fail("You can only update your own assignments", 403);
  }

  const updated = await prisma.sellerAssignment.update({
    where: { id },
    data: { onboardingStatus: parsed.data.onboardingStatus },
  });

  await writeAudit({
    actorUserId: session.uid,
    action: "onboarding.status",
    entityType: "SellerAssignment",
    entityId: id,
    before: { onboardingStatus: target.onboardingStatus },
    after: { onboardingStatus: updated.onboardingStatus },
  });

  return ok({ assignment: { id: String(updated.id), onboardingStatus: updated.onboardingStatus } });
});

export const DELETE = handler(async (_req: Request, ctx: { params: { id: string } }) => {
  const session = await requireRole("ONB_LEAD");
  const id = parseId(ctx.params.id);
  if (id === null) return fail("Invalid id", 400);

  const roleEntry = session.roles.find((r) => r.code === "ONB_LEAD" && r.branchId);
  const branchId = roleEntry?.branchId ? BigInt(roleEntry.branchId) : null;
  if (!branchId) return fail("No active branch role found", 403);

  const target = await prisma.sellerAssignment.findUnique({
    where: { id },
    include: {
      seller: { select: { branchId: true, name: true } },
      program: { select: { name: true } },
      exec: { select: { fullName: true } },
    },
  });

  if (!target) return fail("Assignment not found", 404);
  if (target.seller.branchId !== branchId) return fail("Not authorized to remove this assignment", 403);

  await prisma.sellerAssignment.delete({ where: { id } });

  await writeAudit({
    actorUserId: session.uid,
    action: "seller.unassign",
    entityType: "SellerAssignment",
    entityId: id,
    before: {
      sellerName: target.seller.name,
      programName: target.program?.name ?? null,
      execName: target.exec.fullName,
    },
  });

  return ok({ deleted: true });
});

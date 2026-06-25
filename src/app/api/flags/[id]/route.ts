import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { serialize } from "@/lib/prisma";
import { updateAssignmentOnboardingStatus } from "@/lib/onboardingStatusHelper";

function parseId(id: string): bigint | null {
  try {
    return BigInt(id);
  } catch {
    return null;
  }
}

export const PUT = handler(async (req: Request, ctx: { params: { id: string } }) => {
  const session = await requireRole("HO_ADMIN", "BRANCH_ADMIN", "ONB_LEAD", "OB_EXEC");
  const flagId = parseId(ctx.params.id);
  if (flagId === null) return fail("Invalid flag ID", 400);

  const flag = await prisma.flag.findUnique({ where: { id: flagId } });
  if (!flag) return fail("Flag not found", 404);

  const updatedFlag = await prisma.flag.update({
    where: { id: flagId },
    data: {
      isResolved: true,
      resolvedAt: new Date(),
    },
    include: {
      pipeline: true,
    },
  });

  await updateAssignmentOnboardingStatus(updatedFlag.pipeline.assignmentId);

  return ok({ flag: serialize(updatedFlag) });
});

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const updateFlowSchema = z.object({
  branchId: z.coerce.bigint(),
  programId: z.coerce.bigint(),
  flowSteps: z.array(
    z.object({
      id: z.string(),
      name: z.string().trim().min(1, "Name cannot be empty"),
      level: z.string(),
      datatype: z.string(),
    })
  ),
});

export const POST = handler(async (req: Request) => {
  const session = await requireRole("BRANCH_ADMIN");

  const parsed = updateFlowSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const { branchId, programId, flowSteps } = parsed.data;

  // Confirm branch admin owns this branch
  const ownsThisBranch = session.roles.some(
    (r) => r.code === "BRANCH_ADMIN" && String(r.branchId) === String(branchId),
  );
  if (!ownsThisBranch) return fail("Forbidden — not your branch", 403);

  // Update BranchProgram
  const updated = await prisma.branchProgram.update({
    where: { branchId_programId: { branchId, programId } },
    data: { flowSteps },
  });

  await writeAudit({
    actorUserId: session.uid,
    action: "branch_program.update_flow",
    entityType: "BranchProgram",
    entityId: updated.id,
    after: { branchId: String(branchId), programId: String(programId), flowSteps },
  });

  return ok({ branchProgram: updated });
});

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

/** Resolve the caller's branch id from a BRANCH_ADMIN role. */
function branchIdFor(session: { roles: { code: string; branchId: string | null }[] }): bigint | null {
  const r = session.roles.find((r) => r.code === "BRANCH_ADMIN" && r.branchId);
  if (!r?.branchId) return null;
  try {
    return BigInt(r.branchId);
  } catch {
    return null;
  }
}

function parseId(id: string): bigint | null {
  try {
    return BigInt(id);
  } catch {
    return null;
  }
}

export const DELETE = handler(async (_req: Request, ctx: { params: { id: string } }) => {
  const session = await requireRole("BRANCH_ADMIN");
  const branchId = branchIdFor(session);
  if (branchId === null) return fail("No branch assigned to this admin", 422);

  const id = parseId(ctx.params.id);
  if (id === null) return fail("Invalid id", 400);

  const target = await prisma.branchProgram.findUnique({ where: { id } });
  if (!target || target.branchId !== branchId) return fail("Program not found for this branch", 404);
  if (target.approvalStatus === "approved") {
    return fail("Approved programs cannot be removed", 422);
  }

  await prisma.$transaction(async (tx) => {
    await tx.branchProgram.delete({ where: { id } });

    // Clean up any still-pending change request linked to this branch+program.
    await tx.changeRequest.deleteMany({
      where: {
        type: "BRANCH_PROGRAM",
        status: "pending",
        branchId,
        payload: {
          path: "$.programId",
          equals: target.programId.toString(),
        },
      },
    });
  });

  await writeAudit({
    actorUserId: session.uid,
    action: "branch_program.remove",
    entityType: "BranchProgram",
    entityId: id,
    before: {
      branchId: target.branchId.toString(),
      programId: target.programId.toString(),
      approvalStatus: target.approvalStatus,
    },
  });
  return ok({ deleted: true });
});

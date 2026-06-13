import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const decideRequestSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reason: z.string().trim().max(500).optional().nullable(),
});

export const PUT = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireRole("HO_ADMIN");
  const { id } = await params;
  const requestId = BigInt(id);

  const body = await req.json().catch(() => null);
  const parsed = decideRequestSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  }

  const { status, reason } = parsed.data;

  const request = await prisma.changeRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) return fail("Change request not found", 404);
  if (request.status !== "pending") return fail("This request is already decided.", 400);

  // If approved, apply the payload action based on type
  if (status === "approved") {
    try {
      if (request.type === "BRANCH_PROGRAM") {
        // Payload contains branchId and programId
        const payload = request.payload as { branchId?: string; programId?: string };
        if (payload?.branchId && payload?.programId) {
          const bId = BigInt(payload.branchId);
          const pId = BigInt(payload.programId);

          await prisma.branchProgram.update({
            where: {
              branchId_programId: {
                branchId: bId,
                programId: pId,
              },
            },
            data: {
              approvalStatus: "approved",
            },
          });
        }
      }
    } catch (err) {
      console.error("Failed to apply change request effects:", err);
      return fail("Failed to apply change request database modifications.", 500);
    }
  }

  const updated = await prisma.changeRequest.update({
    where: { id: requestId },
    data: {
      status,
      decidedBy: BigInt(session.uid),
      decidedAt: new Date(),
      reason: reason ?? null,
    },
  });

  await writeAudit({
    actorUserId: session.uid,
    action: `change_request.${status}`,
    entityType: "ChangeRequest",
    entityId: updated.id,
    before: { status: request.status },
    after: { status: updated.status, reason: updated.reason },
  });

  return ok({ request: updated });
});

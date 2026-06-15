import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

// Accept both the task-spec shape ({ decision }) and the legacy shape
// ({ status }) so existing callers keep working.
const decideSchema = z
  .object({
    decision: z.enum(["approved", "rejected"]).optional(),
    status: z.enum(["approved", "rejected"]).optional(),
    reason: z.string().trim().max(500).optional().nullable(),
  })
  .refine((v) => Boolean(v.decision || v.status), {
    message: "decision is required",
  });

async function decide(req: Request, ctx: { params: { id: string } }): Promise<NextResponse> {
  const session = await requireRole("HO_ADMIN");

  let requestId: bigint;
  try {
    requestId = BigInt(ctx.params.id);
  } catch {
    return fail("Invalid id", 400);
  }

  const body = await req.json().catch(() => null);
  const parsed = decideSchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const decision = (parsed.data.decision ?? parsed.data.status) as "approved" | "rejected";
  const reason = parsed.data.reason ?? null;

  const request = await prisma.changeRequest.findUnique({ where: { id: requestId } });
  if (!request) return fail("Change request not found", 404);
  if (request.status !== "pending") return fail("This request is already decided.", 400);

  const updated = await prisma.$transaction(async (tx) => {
    // Apply the type-specific side effect. Only BRANCH_PROGRAM is wired up now;
    // other types simply record the decision (generic handling).
    if (request.type === "BRANCH_PROGRAM") {
      const payload = request.payload as { branchId?: string; programId?: string } | null;
      if (payload?.branchId && payload?.programId) {
        await tx.branchProgram.update({
          where: {
            branchId_programId: {
              branchId: BigInt(payload.branchId),
              programId: BigInt(payload.programId),
            },
          },
          data: { approvalStatus: decision },
        });
      }
    }

    return tx.changeRequest.update({
      where: { id: requestId },
      data: {
        status: decision,
        decidedBy: BigInt(session.uid),
        decidedAt: new Date(),
        reason,
      },
    });
  });

  await writeAudit({
    actorUserId: session.uid,
    action: `changerequest.${decision}`,
    entityType: "ChangeRequest",
    entityId: updated.id,
    before: { status: request.status },
    after: { status: updated.status, reason: updated.reason },
  });

  return ok({ request: updated });
}

export const PATCH = handler(decide);
// Backwards-compatible alias for existing callers using PUT.
export const PUT = handler(decide);

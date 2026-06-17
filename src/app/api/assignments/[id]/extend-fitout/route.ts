import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

function parseId(id: string): bigint | null {
  try {
    return BigInt(id);
  } catch {
    return null;
  }
}

const extendSchema = z.object({
  days: z.coerce.number().int().positive("Days to extend must be a positive integer"),
  reason: z.string().trim().min(5, "Please provide a reason of at least 5 characters"),
});

export const POST = handler(async (req: Request, ctx: { params: { id: string } }) => {
  const session = await requireRole("OB_EXEC", "ONB_LEAD");
  const assignmentId = parseId(ctx.params.id);
  if (assignmentId === null) return fail("Invalid assignment ID", 400);

  const body = await req.json().catch(() => null);
  const parsed = extendSchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const { days, reason } = parsed.data;

  // Retrieve assignment
  const assignment = await prisma.sellerAssignment.findUnique({
    where: { id: assignmentId },
    select: { sellerId: true, programId: true, obExecUserId: true },
  });
  if (!assignment) return fail("Assignment not found", 404);

  // If role is OB_EXEC, must be assigned to this user
  const isExec = session.roles.some((r) => r.code === "OB_EXEC");
  if (isExec && assignment.obExecUserId !== BigInt(session.uid)) {
    return fail("Not authorized to modify this assignment", 403);
  }

  // Retrieve contract
  const contract = await prisma.sellerContract.findFirst({
    where: { sellerId: assignment.sellerId, programId: assignment.programId },
  });
  if (!contract) return fail("No program contract found for this assignment", 404);

  const oldFitout = parseInt(contract.fitoutPeriod || "0", 10);
  const newFitout = oldFitout + days;

  // Shift contract start and contract end forward by 'days' days
  const oldStart = contract.contractStart ? new Date(contract.contractStart) : null;
  const oldEnd = contract.contractEnd ? new Date(contract.contractEnd) : null;
  
  let newStart: Date | null = null;
  let newEnd: Date | null = null;

  if (oldStart) {
    newStart = new Date(oldStart);
    newStart.setDate(newStart.getDate() + days);
  }
  if (oldEnd) {
    newEnd = new Date(oldEnd);
    newEnd.setDate(newEnd.getDate() + days);
  }

  const updatedRemarks = contract.remarks
    ? `${contract.remarks}\n[Extension: +${days} days. Reason: ${reason}]`
    : `[Extension: +${days} days. Reason: ${reason}]`;

  // Update contract
  const updatedContract = await prisma.sellerContract.update({
    where: { id: contract.id },
    data: {
      fitoutPeriod: newFitout.toString(),
      contractStart: newStart,
      contractEnd: newEnd,
      remarks: updatedRemarks,
    },
  });

  // Write audit log
  await writeAudit({
    actorUserId: session.uid,
    action: "contract.extend_fitout",
    entityType: "SellerContract",
    entityId: contract.id,
    before: {
      fitoutPeriod: contract.fitoutPeriod,
      contractStart: contract.contractStart?.toISOString() ?? null,
      contractEnd: contract.contractEnd?.toISOString() ?? null,
      remarks: contract.remarks,
    },
    after: {
      fitoutPeriod: newFitout.toString(),
      contractStart: newStart?.toISOString() ?? null,
      contractEnd: newEnd?.toISOString() ?? null,
      remarks: updatedRemarks,
      extensionReason: reason,
    },
  });

  return ok({
    contractId: contract.id.toString(),
    fitoutPeriod: newFitout.toString(),
    contractStart: newStart ? newStart.toISOString().slice(0, 10) : null,
    contractEnd: newEnd ? newEnd.toISOString().slice(0, 10) : null,
  });
});

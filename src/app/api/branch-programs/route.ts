import { z } from "zod";
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

const addSchema = z.object({
  programId: z.coerce.bigint(),
  remarks: z.string().trim().min(1, "Remarks/Description is mandatory"),
});

export const GET = handler(async () => {
  const session = await requireRole("BRANCH_ADMIN");
  const branchId = branchIdFor(session);
  if (branchId === null) return fail("No branch assigned to this admin", 422);

  const branchPrograms = await prisma.branchProgram.findMany({
    where: { branchId },
    orderBy: { createdAt: "desc" },
    include: {
      program: { select: { id: true, name: true, code: true, status: true } },
    },
  });
  return ok({ branchPrograms });
});

export const POST = handler(async (req: Request) => {
  const session = await requireRole("BRANCH_ADMIN");
  const branchId = branchIdFor(session);
  if (branchId === null) return fail("No branch assigned to this admin", 422);

  const parsed = addSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  const { programId, remarks } = parsed.data;

  const program = await prisma.program.findUnique({ where: { id: programId } });
  if (!program) return fail("Program not found", 404);
  if (program.status !== "active") return fail("Program is not active", 422);

  const existing = await prisma.branchProgram.findUnique({
    where: { branchId_programId: { branchId, programId } },
  });
  if (existing) return fail("Program already requested for this branch", 409);

  let branchProgram;
  try {
    branchProgram = await prisma.$transaction(async (tx) => {
      const created = await tx.branchProgram.create({
        data: { branchId, programId, approvalStatus: "pending" },
      });

      await tx.changeRequest.create({
        data: {
          type: "BRANCH_PROGRAM",
          branchId,
          requestedBy: BigInt(session.uid),
          status: "pending",
          payload: {
            branchId: branchId.toString(),
            programId: programId.toString(),
            programName: program.name,
            remarks: remarks,
          },
        },
      });

      return created;
    });
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code?: string }).code === "P2002") {
      return fail("Program already requested for this branch", 409);
    }
    throw e;
  }

  await writeAudit({
    actorUserId: session.uid,
    action: "branch_program.request",
    entityType: "BranchProgram",
    entityId: branchProgram.id,
    after: {
      branchId: branchId.toString(),
      programId: programId.toString(),
      program: program.name,
      approvalStatus: branchProgram.approvalStatus,
      remarks: remarks,
    },
  });

  return ok({ branchProgram }, { status: 201 });
});

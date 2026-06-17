import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

// HO "New Program": creates the Program master and enables it for a branch.
// Member / contract / category data is filled later by the Onboarding Lead on
// the Add Seller page — NOT here.
const schema = z
  .object({
    branchId: z.coerce.bigint(),
    programId: z.coerce.bigint().optional().nullable(),
    programName: z.string().trim().max(150).optional().nullable(),
    programCode: z.string().trim().max(60).regex(/^[A-Za-z0-9_-]+$/).optional().nullable(),
  })
  .refine((d) => d.programId || (d.programName && d.programCode), {
    message: "Pick an existing program or provide a new program name + code",
  });

export const POST = handler(async (req: Request) => {
  const session = await requireRole("HO_ADMIN");
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  const d = parsed.data;

  const branch = await prisma.branch.findUnique({ where: { id: d.branchId } });
  if (!branch) return fail("Branch not found", 422);

  let programId = d.programId ?? null;
  if (!programId) {
    const dup = await prisma.program.findUnique({ where: { code: d.programCode! } });
    if (dup) return fail("A program with this code already exists — pick it instead.", 409);
    const program = await prisma.program.create({ data: { name: d.programName!, code: d.programCode! } });
    programId = program.id;
  }

  await prisma.branchProgram.upsert({
    where: { branchId_programId: { branchId: d.branchId, programId } },
    create: { branchId: d.branchId, programId, approvalStatus: "approved" },
    update: {},
  });

  await writeAudit({
    actorUserId: session.uid,
    action: "program.create",
    entityType: "Program",
    entityId: programId,
    after: { branchId: d.branchId.toString() },
  });

  return ok({ programId: programId.toString() }, { status: 201 });
});

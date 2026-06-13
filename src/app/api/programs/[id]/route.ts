import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  code: z.string().trim().min(1).max(60).regex(/^[A-Za-z0-9_-]+$/).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  definitionAttributeIds: z.array(z.coerce.bigint()).optional(),
  commonAttributeIds: z.array(z.coerce.bigint()).optional(),
});

function parseId(id: string): bigint | null {
  try {
    return BigInt(id);
  } catch {
    return null;
  }
}

async function loadProgram(id: bigint) {
  return prisma.program.findUnique({
    where: { id },
    include: {
      defAttrs: {
        include: {
          attribute: { select: { id: true, name: true, code: true, dataType: true, sectionGroup: true, status: true } },
        },
      },
      commonAttrs: {
        include: {
          attribute: { select: { id: true, name: true, code: true, dataType: true, sectionGroup: true, status: true } },
        },
      },
      _count: { select: { branchPrograms: true, contracts: true, localRecords: true } },
    },
  });
}

export const PATCH = handler(async (req: Request, ctx: { params: { id: string } }) => {
  const session = await requireRole("HO_ADMIN");
  const id = parseId(ctx.params.id);
  if (id === null) return fail("Invalid id", 400);

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  const { definitionAttributeIds, commonAttributeIds, ...data } = parsed.data;

  const program = await prisma.$transaction(async (tx) => {
    const updated = await tx.program.update({ where: { id }, data });

    if (definitionAttributeIds) {
      const definitionIds = [...new Set(definitionAttributeIds.map(String))];
      await tx.programDefinitionAttribute.deleteMany({ where: { programId: id } });
      if (definitionIds.length) {
        await tx.programDefinitionAttribute.createMany({
          data: definitionIds.map((attributeId) => ({ programId: id, attributeId: BigInt(attributeId) })),
        });
      }
    }

    if (commonAttributeIds) {
      const commonIds = [...new Set(commonAttributeIds.map(String))];
      await tx.programCommonAttribute.deleteMany({ where: { programId: id } });
      if (commonIds.length) {
        await tx.programCommonAttribute.createMany({
          data: commonIds.map((attributeId) => ({ programId: id, attributeId: BigInt(attributeId) })),
        });
      }
    }

    return updated;
  });

  const action = data.status && data.status !== program.status ? `program.${data.status === "inactive" ? "deactivate" : "activate"}` : "program.update";
  await writeAudit({
    actorUserId: session.uid,
    action,
    entityType: "Program",
    entityId: program.id,
    after: { name: program.name, code: program.code, status: program.status },
  });

  return ok({ program: await loadProgram(id) });
});

export const DELETE = handler(async (_req: Request, ctx: { params: { id: string } }) => {
  const session = await requireRole("HO_ADMIN");
  const id = parseId(ctx.params.id);
  if (id === null) return fail("Invalid id", 400);

  const target = await prisma.program.findUnique({ where: { id } });
  if (!target) return fail("Program not found", 404);

  const [branchPrograms, contracts, localRecords] = await Promise.all([
    prisma.branchProgram.count({ where: { programId: id } }),
    prisma.sellerContract.count({ where: { programId: id } }),
    prisma.localOnboardingRecord.count({ where: { programId: id } }),
  ]);

  if (branchPrograms > 0 || contracts > 0 || localRecords > 0) {
    const program = await prisma.program.update({ where: { id }, data: { status: "inactive" } });
    await writeAudit({ actorUserId: session.uid, action: "program.deactivate", entityType: "Program", entityId: id });
    return ok({ program, deactivated: true, reason: "in use — deactivated instead of deleted" });
  }

  await prisma.program.delete({ where: { id } });
  await writeAudit({ actorUserId: session.uid, action: "program.delete", entityType: "Program", entityId: id });
  return ok({ deleted: true });
});
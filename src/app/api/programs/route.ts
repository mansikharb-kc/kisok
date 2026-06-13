import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const createSchema = z.object({
  name: z.string().trim().min(1).max(150),
  code: z.string().trim().min(1).max(60).regex(/^[A-Za-z0-9_-]+$/, "code: letters, numbers, - and _ only"),
  status: z.enum(["active", "inactive"]).optional(),
  definitionAttributeIds: z.array(z.coerce.bigint()).optional(),
  commonAttributeIds: z.array(z.coerce.bigint()).optional(),
});

export const GET = handler(async () => {
  await requireRole("HO_ADMIN");
  const programs = await prisma.program.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
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
  return ok({ programs });
});

export const POST = handler(async (req: Request) => {
  const session = await requireRole("HO_ADMIN");
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const { definitionAttributeIds, commonAttributeIds, ...data } = parsed.data;
  const definitionIds = [...new Set((definitionAttributeIds ?? []).map(String))];
  const commonIds = [...new Set((commonAttributeIds ?? []).map(String))];

  const program = await prisma.$transaction(async (tx) => {
    const created = await tx.program.create({
      data: { name: data.name, code: data.code, status: data.status ?? "active" },
    });

    if (definitionIds.length) {
      await tx.programDefinitionAttribute.createMany({
        data: definitionIds.map((attributeId) => ({ programId: created.id, attributeId: BigInt(attributeId) })),
      });
    }

    if (commonIds.length) {
      await tx.programCommonAttribute.createMany({
        data: commonIds.map((attributeId) => ({ programId: created.id, attributeId: BigInt(attributeId) })),
      });
    }

    return created;
  });

  await writeAudit({
    actorUserId: session.uid,
    action: "program.create",
    entityType: "Program",
    entityId: program.id,
    after: { name: program.name, code: program.code, status: program.status },
  });

  return ok({ program }, { status: 201 });
});
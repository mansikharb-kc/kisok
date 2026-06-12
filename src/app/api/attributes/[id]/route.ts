import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { DATA_TYPE_VALUES, SECTION_GROUPS } from "@/lib/attributeMeta";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  code: z.string().trim().min(1).max(60).regex(/^[A-Za-z0-9_-]+$/).optional(),
  dataType: z.enum(DATA_TYPE_VALUES as [string, ...string[]]).optional(),
  unit: z.string().trim().max(20).nullable().optional(),
  sectionGroup: z.enum(SECTION_GROUPS as unknown as [string, ...string[]]).nullable().optional(),
  isVariant: z.boolean().optional(),
  isPriceable: z.boolean().optional(),
  isRequired: z.boolean().optional(),
  status: z.enum(["active", "retired"]).optional(),
  options: z.array(z.string().trim().min(1).max(190)).optional(),
});

function parseId(id: string): bigint | null {
  try {
    return BigInt(id);
  } catch {
    return null;
  }
}

export const PATCH = handler(async (req: Request, ctx: { params: { id: string } }) => {
  const session = await requireRole("HO_ADMIN");
  const id = parseId(ctx.params.id);
  if (id === null) return fail("Invalid id", 400);

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  const { options, ...data } = parsed.data;

  const attribute = await prisma.$transaction(async (tx) => {
    const updated = await tx.attribute.update({
      where: { id },
      data: { ...data, unit: data.unit === undefined ? undefined : data.unit || null },
    });
    // If enum options provided, replace them.
    if (options) {
      await tx.attributeOption.deleteMany({ where: { attributeId: id } });
      if ((data.dataType ?? updated.dataType) === "enum" && options.length) {
        await tx.attributeOption.createMany({
          data: options.map((v, i) => ({ attributeId: id, optionValue: v, displayOrder: i })),
        });
      }
    }
    return updated;
  });

  await writeAudit({
    actorUserId: session.uid,
    action: "attribute.update",
    entityType: "Attribute",
    entityId: id,
    after: { name: attribute.name, code: attribute.code },
  });

  return ok({ attribute });
});

export const DELETE = handler(async (_req: Request, ctx: { params: { id: string } }) => {
  const session = await requireRole("HO_ADMIN");
  const id = parseId(ctx.params.id);
  if (id === null) return fail("Invalid id", 400);

  const mapped = await prisma.categoryAttribute.count({ where: { attributeId: id } });
  if (mapped > 0) {
    // In use on categories — retire instead of hard delete.
    const attribute = await prisma.attribute.update({ where: { id }, data: { status: "retired" } });
    await writeAudit({ actorUserId: session.uid, action: "attribute.retire", entityType: "Attribute", entityId: id });
    return ok({ attribute, retired: true, reason: "mapped to categories — retired instead of deleted" });
  }

  await prisma.attribute.delete({ where: { id } });
  await writeAudit({ actorUserId: session.uid, action: "attribute.delete", entityType: "Attribute", entityId: id });
  return ok({ deleted: true });
});

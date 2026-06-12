import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const patchSchema = z.object({
  isRequired: z.boolean().nullable().optional(), // null = use attribute default
  isSearchable: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
});

function parseId(id: string): bigint | null {
  try {
    return BigInt(id);
  } catch {
    return null;
  }
}

// PATCH: override a mapping (required / searchable / order). Allowed on own mapping.
export const PATCH = handler(async (req: Request, ctx: { params: { id: string } }) => {
  const session = await requireRole("HO_ADMIN");
  const id = parseId(ctx.params.id);
  if (id === null) return fail("Invalid id", 400);

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  const d = parsed.data;

  const updated = await prisma.categoryAttribute.update({
    where: { id },
    data: {
      isRequiredOverride: d.isRequired === undefined ? undefined : d.isRequired,
      isSearchable: d.isSearchable,
      displayOrder: d.displayOrder,
    },
  });

  await writeAudit({ actorUserId: session.uid, action: "attribute.map_update", entityType: "CategoryAttribute", entityId: id });
  return ok({ mapId: updated.id.toString() });
});

// DELETE: unmap an attribute from a category (only its own mapping)
export const DELETE = handler(async (_req: Request, ctx: { params: { id: string } }) => {
  const session = await requireRole("HO_ADMIN");
  const id = parseId(ctx.params.id);
  if (id === null) return fail("Invalid id", 400);

  await prisma.categoryAttribute.delete({ where: { id } });
  await writeAudit({ actorUserId: session.uid, action: "attribute.unmap", entityType: "CategoryAttribute", entityId: id });
  return ok({ deleted: true });
});

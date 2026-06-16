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

// DELETE: retire a custom field definition (existing stored values are kept).
export const DELETE = handler(async (_req: Request, ctx: { params: { id: string } }) => {
  const session = await requireRole("HO_ADMIN");
  const id = parseId(ctx.params.id);
  if (id === null) return fail("Invalid id", 400);

  await prisma.customFieldDef.update({ where: { id }, data: { status: "retired" } });
  await writeAudit({ actorUserId: session.uid, action: "custom_field.retire", entityType: "CustomFieldDef", entityId: id });
  return ok({ retired: true });
});

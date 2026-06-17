import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

// Centralised soft-archive / restore for the masters that carry a `status`.
const ENTITIES = ["brand", "attribute", "category", "program", "seller", "sampleSize"] as const;

const schema = z.object({
  entity: z.enum(ENTITIES),
  id: z.coerce.bigint(),
  action: z.enum(["archive", "restore"]),
});

export const POST = handler(async (req: Request) => {
  const session = await requireRole("HO_ADMIN");
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  const { entity, id, action } = parsed.data;

  // An attribute that's actually used on products can't be archived — only deactivated.
  if (entity === "attribute" && action === "archive") {
    const usedInProducts = await prisma.productAttributeValue.count({ where: { attributeId: id } });
    if (usedInProducts > 0) {
      return fail("This attribute is used in products — you can't archive it. Deactivate it instead.", 409);
    }
  }

  const status = action === "archive" ? "archived" : "active";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any)[entity].update({ where: { id }, data: { status } });

  await writeAudit({ actorUserId: session.uid, action: `${entity}.${action}`, entityType: entity, entityId: id });
  return ok({ ok: true, status });
});

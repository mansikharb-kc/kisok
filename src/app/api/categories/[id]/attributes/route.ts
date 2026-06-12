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

// Walk from a category up to its root, returning [self, parent, …root].
async function ancestorChain(id: bigint) {
  const chain: { id: bigint; name: string }[] = [];
  let cur: bigint | null = id;
  let guard = 0;
  while (cur && guard++ < 20) {
    const c = await prisma.category.findUnique({
      where: { id: cur },
      select: { id: true, name: true, parentId: true },
    });
    if (!c) break;
    chain.push({ id: c.id, name: c.name });
    cur = c.parentId;
  }
  return chain; // index 0 = self (distance 0), deeper = further ancestor
}

// GET: effective attributes for a category = own + inherited (nearest ancestor wins on conflict)
export const GET = handler(async (_req: Request, ctx: { params: { id: string } }) => {
  await requireRole("HO_ADMIN");
  const id = parseId(ctx.params.id);
  if (id === null) return fail("Invalid id", 400);

  const chain = await ancestorChain(id);
  if (chain.length === 0) return fail("Category not found", 404);

  const chainIds = chain.map((c) => c.id);
  const distance = new Map(chain.map((c, i) => [c.id.toString(), i]));
  const nameById = new Map(chain.map((c) => [c.id.toString(), c.name]));

  const maps = await prisma.categoryAttribute.findMany({
    where: { categoryId: { in: chainIds } },
    include: { attribute: { include: { options: { orderBy: { displayOrder: "asc" } } } } },
  });

  // Nearest ancestor wins when the same attribute is mapped more than once.
  const best = new Map<string, (typeof maps)[number]>();
  for (const m of maps) {
    if (m.attribute.status !== "active") continue;
    const key = m.attributeId.toString();
    const d = distance.get(m.categoryId.toString()) ?? 99;
    const prev = best.get(key);
    const prevD = prev ? distance.get(prev.categoryId.toString()) ?? 99 : 99;
    if (!prev || d < prevD) best.set(key, m);
  }

  const items = [...best.values()].map((m) => {
    const isOwn = m.categoryId === id;
    return {
      mapId: m.id.toString(),
      isOwn,
      sourceCategoryId: m.categoryId.toString(),
      sourceCategoryName: isOwn ? null : nameById.get(m.categoryId.toString()) ?? null,
      isRequired: m.isRequiredOverride ?? m.attribute.isRequired,
      isSearchable: m.isSearchable,
      displayOrder: m.displayOrder,
      attribute: {
        id: m.attribute.id.toString(),
        name: m.attribute.name,
        code: m.attribute.code,
        dataType: m.attribute.dataType,
        unit: m.attribute.unit,
        sectionGroup: m.attribute.sectionGroup,
        options: m.attribute.options.map((o) => o.optionValue),
      },
    };
  });

  return ok({ items });
});

const mapSchema = z.object({
  attributeId: z.coerce.bigint(),
  isRequired: z.boolean().optional(),
  isSearchable: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
});

// POST: map an attribute to THIS category (becomes inherited by descendants)
export const POST = handler(async (req: Request, ctx: { params: { id: string } }) => {
  const session = await requireRole("HO_ADMIN");
  const id = parseId(ctx.params.id);
  if (id === null) return fail("Invalid id", 400);

  const parsed = mapSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  const { attributeId, isRequired, isSearchable, displayOrder } = parsed.data;

  const attribute = await prisma.attribute.findUnique({ where: { id: attributeId } });
  if (!attribute) return fail("Attribute not found", 422);

  const exists = await prisma.categoryAttribute.findUnique({
    where: { categoryId_attributeId: { categoryId: id, attributeId } },
  });
  if (exists) return fail("Attribute already mapped to this category", 409);

  const created = await prisma.categoryAttribute.create({
    data: {
      categoryId: id,
      attributeId,
      isRequiredOverride: isRequired ?? null,
      isSearchable: isSearchable ?? false,
      displayOrder: displayOrder ?? 0,
    },
  });

  await writeAudit({
    actorUserId: session.uid,
    action: "attribute.map",
    entityType: "Category",
    entityId: id,
    after: { attribute: attribute.name, categoryId: id.toString() },
  });

  return ok({ mapId: created.id.toString() }, { status: 201 });
});

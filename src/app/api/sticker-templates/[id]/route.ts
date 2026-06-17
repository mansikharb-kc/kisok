import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { DEFAULT_ELEMENTS } from "@/lib/stickerMeta";

const elementsSchema = z.object({
  brandLogo: z.boolean(),
  branchName: z.boolean(),
  productName: z.boolean(),
  category: z.boolean(),
  attributes: z.boolean(),
  locationId: z.boolean(),
  sku: z.boolean(),
  qr: z.boolean(),
});

const fieldSchema = z.object({
  id: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1).max(80),
  source: z.enum(["attribute", "productName", "sku", "brandName", "instanceCode", "static"]),
  attributeId: z.string().trim().nullable().optional(),
  attributeCode: z.string().trim().nullable().optional(),
  staticText: z.string().trim().max(200).nullable().optional(),
});

const layoutSchema = z.object({
  base: z.enum(["laminate", "pioneer"]),
  size: z.object({ w: z.number().positive(), h: z.number().positive() }),
  fields: z.array(fieldSchema).max(20),
  showBrandLogo: z.boolean().optional().default(true),
  showQr: z.boolean().optional().default(true),
  showBarcode: z.boolean().optional().default(true),
  qrLink: z.string().trim().max(500).optional().default(""),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  categoryId: z.coerce.bigint().optional(),
  elements: elementsSchema.partial().optional(),
  layout: layoutSchema.optional(),
  status: z.enum(["active", "inactive"]).optional(),
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
  const { name, categoryId, elements, layout, status } = parsed.data;

  const existing = await prisma.stickerTemplate.findUnique({ where: { id } });
  if (!existing) return fail("Sticker template not found", 404);

  if (categoryId !== undefined) {
    const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
    if (!category) return fail("Category not found", 404);
  }

  // Merge partial element toggles over the existing (or default) element map.
  const mergedElements =
    elements !== undefined
      ? { ...DEFAULT_ELEMENTS, ...((existing.elements as Record<string, boolean> | null) ?? {}), ...elements }
      : undefined;

  const template = await prisma.stickerTemplate.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(categoryId !== undefined ? { categoryId } : {}),
      ...(mergedElements !== undefined ? { elements: mergedElements } : {}),
      ...(layout !== undefined ? { layout } : {}),
      ...(status !== undefined ? { status } : {}),
    },
  });

  await writeAudit({
    actorUserId: session.uid,
    action: "stickertemplate.update",
    entityType: "StickerTemplate",
    entityId: template.id,
    before: { name: existing.name, status: existing.status },
    after: { name: template.name, categoryId: template.categoryId.toString(), status: template.status },
  });
  return ok({ template });
});

export const DELETE = handler(async (_req: Request, ctx: { params: { id: string } }) => {
  const session = await requireRole("HO_ADMIN");
  const id = parseId(ctx.params.id);
  if (id === null) return fail("Invalid id", 400);

  const target = await prisma.stickerTemplate.findUnique({ where: { id } });
  if (!target) return fail("Sticker template not found", 404);

  // Deactivate instead of deleting when stickers were already printed from it.
  const stickers = await prisma.sticker.count({ where: { templateId: id } });
  if (stickers > 0) {
    const template = await prisma.stickerTemplate.update({ where: { id }, data: { status: "inactive" } });
    await writeAudit({ actorUserId: session.uid, action: "stickertemplate.deactivate", entityType: "StickerTemplate", entityId: id });
    return ok({ template, deactivated: true, reason: "in use — deactivated instead of deleted" });
  }

  await prisma.stickerTemplate.delete({ where: { id } });
  await writeAudit({ actorUserId: session.uid, action: "stickertemplate.delete", entityType: "StickerTemplate", entityId: id });
  return ok({ deleted: true });
});

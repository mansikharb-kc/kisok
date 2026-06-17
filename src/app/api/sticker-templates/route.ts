import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { normalizeElements } from "@/lib/stickerMeta";

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

const createSchema = z.object({
  categoryId: z.coerce.bigint(),
  name: z.string().trim().min(1).max(120),
  elements: elementsSchema.partial().optional(),
  layout: layoutSchema.optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export const GET = handler(async () => {
  await requireRole("HO_ADMIN", "BRANCH_ADMIN");
  const templates = await prisma.stickerTemplate.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: { category: { select: { name: true, code: true } } },
  });
  const rows = templates.map((t) => ({
    id: t.id,
    name: t.name,
    categoryId: t.categoryId,
    categoryName: t.category?.name ?? null,
    categoryCode: t.category?.code ?? null,
    elements: normalizeElements((t.elements as Record<string, boolean> | null) ?? undefined),
    layout: t.layout ?? null,
    status: t.status,
  }));
  return ok({ templates: rows });
});

export const POST = handler(async (req: Request) => {
  const session = await requireRole("HO_ADMIN");
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  const { categoryId, name, elements, layout, status } = parsed.data;

  const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
  if (!category) return fail("Category not found", 404);

  const template = await prisma.stickerTemplate.create({
    data: {
      categoryId,
      name,
      elements: normalizeElements(elements),
      layout: layout ?? {},
      status: status ?? "active",
    },
  });

  await writeAudit({
    actorUserId: session.uid,
    action: "stickertemplate.create",
    entityType: "StickerTemplate",
    entityId: template.id,
    after: { name: template.name, categoryId: template.categoryId.toString() },
  });
  return ok({ template }, { status: 201 });
});

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

// Serialize a BrandProduct (with attr values + attribute meta) into the
// read-only shape the wizard shows when a (brand, sku) master already exists.
function serializeMaster(
  p: {
    id: bigint;
    brandId: bigint;
    sku: string;
    name: string;
    categoryId: bigint;
    status: string;
    category: { name: string; code: string } | null;
    brand: { name: string; code: string } | null;
    attrValues: {
      attributeId: bigint;
      valueText: string | null;
      valueNumber: unknown;
      valueBool: boolean | null;
      valueDate: Date | null;
      option: { optionValue: string } | null;
    }[];
  },
  attributeMap: Map<string, { name: string; code: string; dataType: string; unit: string | null }>
) {
  return {
    exists: true,
    id: p.id.toString(),
    brandId: p.brandId.toString(),
    sku: p.sku,
    name: p.name,
    categoryId: p.categoryId.toString(),
    status: p.status,
    category: p.category,
    brand: p.brand,
    attrValues: p.attrValues
      .map((v) => {
        const attr = attributeMap.get(v.attributeId.toString());
        if (!attr) return null;
        return {
          attributeId: v.attributeId.toString(),
          name: attr.name,
          code: attr.code,
          dataType: attr.dataType,
          unit: attr.unit,
          value: v.option
            ? v.option.optionValue
            : v.valueText ??
              (v.valueNumber != null ? String(v.valueNumber) : null) ??
              (v.valueBool != null ? (v.valueBool ? "Yes" : "No") : null) ??
              (v.valueDate ? new Date(v.valueDate).toISOString().slice(0, 10) : null),
        };
      })
      .filter(Boolean),
  };
}

// GET ?brandId=&sku= → existing master (read-only) or { exists: false }.
export const GET = handler(async (req: Request) => {
  await requireRole("OB_EXEC");
  const { searchParams } = new URL(req.url);
  const brandIdRaw = searchParams.get("brandId");
  const sku = searchParams.get("sku")?.trim();
  if (!brandIdRaw || !sku) return fail("brandId and sku are required", 400);

  let brandId: bigint;
  try {
    brandId = BigInt(brandIdRaw);
  } catch {
    return fail("Invalid brandId", 400);
  }

  const [product, attributes] = await Promise.all([
    prisma.brandProduct.findUnique({
      where: { brandId_sku: { brandId, sku } },
      include: {
        category: { select: { name: true, code: true } },
        brand: { select: { name: true, code: true } },
        attrValues: {
          include: {
            option: { select: { optionValue: true } },
          },
        },
      },
    }),
    prisma.attribute.findMany({
      select: { id: true, name: true, code: true, dataType: true, unit: true },
    }),
  ]);

  if (!product) return ok({ exists: false });

  const attributeMap = new Map(attributes.map((a) => [a.id.toString(), a]));
  return ok(serializeMaster(product, attributeMap));
});

const valueSchema = z.object({
  attributeId: z.coerce.bigint(),
  valueText: z.string().optional().nullable(),
  valueNumber: z.coerce.number().optional().nullable(),
  valueBool: z.boolean().optional().nullable(),
  valueDate: z.string().optional().nullable(),
  optionId: z.coerce.bigint().optional().nullable(),
});

const createSchema = z.object({
  brandId: z.coerce.bigint(),
  sku: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(200),
  categoryId: z.coerce.bigint(),
  attributeValues: z.array(valueSchema).optional().default([]),
});

// POST → create a shared BrandProduct master + its ProductAttributeValue rows.
export const POST = handler(async (req: Request) => {
  const session = await requireRole("OB_EXEC");
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const { brandId, sku, name, categoryId, attributeValues } = parsed.data;

  const [brand, category] = await Promise.all([
    prisma.brand.findUnique({ where: { id: brandId }, select: { id: true } }),
    prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } }),
  ]);
  if (!brand) return fail("Brand not found", 422);
  if (!category) return fail("Category not found", 422);

  // Guard the (brandId, sku) unique key explicitly so we can reuse instead of erroring.
  const existing = await prisma.brandProduct.findUnique({
    where: { brandId_sku: { brandId, sku } },
    select: { id: true },
  });
  if (existing) return fail("A product with this brand & SKU already exists.", 409);

  const created = await prisma.$transaction(async (tx) => {
    const product = await tx.brandProduct.create({
      data: { brandId, sku, name, categoryId, status: "active" },
    });

    // Only persist attribute values that actually carry a value.
    const rows = attributeValues
      .map((v) => {
        const hasValue =
          (v.valueText != null && v.valueText !== "") ||
          v.valueNumber != null ||
          v.valueBool != null ||
          (v.valueDate != null && v.valueDate !== "") ||
          v.optionId != null;
        if (!hasValue) return null;
        return {
          brandProductId: product.id,
          attributeId: v.attributeId,
          valueText: v.valueText != null && v.valueText !== "" ? v.valueText : null,
          valueNumber: v.valueNumber != null ? v.valueNumber : null,
          valueBool: v.valueBool != null ? v.valueBool : null,
          valueDate: v.valueDate ? new Date(v.valueDate) : null,
          optionId: v.optionId ?? null,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (rows.length) {
      await tx.productAttributeValue.createMany({ data: rows });
    }
    return product;
  });

  await writeAudit({
    actorUserId: session.uid,
    action: "product_master.create",
    entityType: "BrandProduct",
    entityId: created.id,
    after: { brandId: brandId.toString(), sku, name, categoryId: categoryId.toString() },
  });

  return ok({ id: created.id.toString() }, { status: 201 });
});

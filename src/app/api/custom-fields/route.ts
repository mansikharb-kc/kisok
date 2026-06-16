import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const FIELD_TYPES = ["text", "number", "date", "enum"] as const;

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

// GET: list active custom-field definitions for an entity (default "collaboration").
export const GET = handler(async (req: Request) => {
  await requireRole("HO_ADMIN");
  const entity = (new URL(req.url).searchParams.get("entity") || "collaboration").trim();
  const fields = await prisma.customFieldDef.findMany({
    where: { entity, status: "active" },
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
  });
  return ok({ fields });
});

const createSchema = z.object({
  entity: z.string().trim().min(1).max(40).optional().default("collaboration"),
  label: z.string().trim().min(1).max(120),
  code: z.string().trim().max(60).regex(/^[a-z0-9_-]+$/i).optional(),
  fieldType: z.enum(FIELD_TYPES),
  options: z.array(z.string().trim().min(1).max(120)).optional().default([]),
  isRequired: z.boolean().optional().default(false),
});

// POST: HO admin defines a new custom field.
export const POST = handler(async (req: Request) => {
  const session = await requireRole("HO_ADMIN");
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  const d = parsed.data;

  const code = d.code?.trim() || slugify(d.label);
  if (!code) return fail("Could not derive a field code from the label", 422);
  if (d.fieldType === "enum" && d.options.length === 0) {
    return fail("Dropdown fields need at least one option", 422);
  }

  const exists = await prisma.customFieldDef.findUnique({
    where: { entity_code: { entity: d.entity, code } },
  });
  if (exists) return fail("A field with this code already exists", 409);

  const count = await prisma.customFieldDef.count({ where: { entity: d.entity } });
  const field = await prisma.customFieldDef.create({
    data: {
      entity: d.entity,
      label: d.label,
      code,
      fieldType: d.fieldType,
      options: d.fieldType === "enum" ? d.options : undefined,
      isRequired: d.isRequired,
      displayOrder: count,
    },
  });

  await writeAudit({
    actorUserId: session.uid,
    action: "custom_field.create",
    entityType: "CustomFieldDef",
    entityId: field.id,
    after: { entity: d.entity, label: d.label, code, fieldType: d.fieldType },
  });

  return ok({ field }, { status: 201 });
});

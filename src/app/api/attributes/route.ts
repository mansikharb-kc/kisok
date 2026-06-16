import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { DATA_TYPE_VALUES, SECTION_GROUPS } from "@/lib/attributeMeta";

const base = {
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(60).regex(/^[A-Za-z0-9_-]+$/, "code: letters, numbers, - and _ only"),
  dataType: z.enum(DATA_TYPE_VALUES as [string, ...string[]]),
  unit: z.string().trim().max(20).optional().nullable(),
  sectionGroup: z.enum(SECTION_GROUPS as unknown as [string, ...string[]]).optional().nullable(),
  isVariant: z.boolean().optional(),
  isPriceable: z.boolean().optional(),
  isRequired: z.boolean().optional(),
  options: z.array(z.string().trim().min(1).max(190)).optional(), // for enum
};

const createSchema = z.object(base);

export const GET = handler(async () => {
  await requireRole("HO_ADMIN");
  const attributes = await prisma.attribute.findMany({
    orderBy: [{ status: "asc" }, { sectionGroup: "asc" }, { name: "asc" }],
    include: {
      options: { orderBy: { displayOrder: "asc" } },
      _count: { select: { categoryAttributes: true } },
    },
  });
  return ok({ attributes });
});

export const POST = handler(async (req: Request) => {
  // HO Admin creates directly; Branch Admin submits for HO approval.
  const session = await requireRole("HO_ADMIN", "BRANCH_ADMIN");
  const isHo = session.roles.some((r) => r.code === "HO_ADMIN");
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  const d = parsed.data;

  // Branch Admin → pending change request (attribute created only on HO approval).
  if (!isHo) {
    const branchId = session.roles.find((r) => r.code === "BRANCH_ADMIN" && r.branchId)?.branchId;
    await prisma.changeRequest.create({
      data: {
        type: "NEW_ATTRIBUTE",
        payload: {
          name: d.name, code: d.code, dataType: d.dataType, unit: d.unit ?? null,
          sectionGroup: d.sectionGroup ?? null, isVariant: d.isVariant ?? false,
          isPriceable: d.isPriceable ?? false, isRequired: d.isRequired ?? false,
          options: d.dataType === "enum" ? d.options ?? [] : [],
        },
        branchId: branchId ? BigInt(branchId) : null,
        requestedBy: BigInt(session.uid),
        status: "pending",
      },
    });
    await writeAudit({
      actorUserId: session.uid,
      action: "attribute.request",
      entityType: "ChangeRequest",
      after: { type: "NEW_ATTRIBUTE", name: d.name },
    });
    return ok({ requested: true, pending: true }, { status: 202 });
  }

  const attribute = await prisma.attribute.create({
    data: {
      name: d.name,
      code: d.code,
      dataType: d.dataType,
      unit: d.unit || null,
      sectionGroup: d.sectionGroup || null,
      isVariant: d.isVariant ?? false,
      isPriceable: d.isPriceable ?? false,
      isRequired: d.isRequired ?? false,
      options:
        d.dataType === "enum" && d.options?.length
          ? { create: d.options.map((v, i) => ({ optionValue: v, displayOrder: i })) }
          : undefined,
    },
    include: { options: true },
  });

  await writeAudit({
    actorUserId: session.uid,
    action: "attribute.create",
    entityType: "Attribute",
    entityId: attribute.id,
    after: { name: attribute.name, code: attribute.code, dataType: attribute.dataType },
  });

  return ok({ attribute }, { status: 201 });
});

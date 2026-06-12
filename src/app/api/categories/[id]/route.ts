import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  code: z.string().trim().min(1).max(60).regex(/^[A-Za-z0-9_-]+$/).optional(),
  parentId: z.coerce.bigint().nullable().optional(),
  status: z.enum(["active", "retired"]).optional(),
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
  const data = parsed.data;

  if (data.parentId) {
    if (data.parentId === id) return fail("A category cannot be its own parent", 422);
    const parent = await prisma.category.findUnique({ where: { id: data.parentId } });
    if (!parent) return fail("Parent category not found", 422);
  }

  const before = await prisma.category.findUnique({ where: { id } });
  const category = await prisma.category.update({ where: { id }, data });
  const action =
    data.status && data.status !== before?.status
      ? `category.${data.status === "retired" ? "retire" : "activate"}`
      : "category.update";
  await writeAudit({
    actorUserId: session.uid,
    action,
    entityType: "Category",
    entityId: category.id,
    before: before ? { name: before.name, code: before.code, status: before.status } : undefined,
    after: { name: category.name, code: category.code, status: category.status },
  });
  return ok({ category });
});

export const DELETE = handler(async (_req: Request, ctx: { params: { id: string } }) => {
  const session = await requireRole("HO_ADMIN");
  const id = parseId(ctx.params.id);
  if (id === null) return fail("Invalid id", 400);

  const target = await prisma.category.findUnique({ where: { id } });
  if (!target) return fail("Category not found", 404);

  const [children, products] = await Promise.all([
    prisma.category.count({ where: { parentId: id } }),
    prisma.brandProduct.count({ where: { categoryId: id } }),
  ]);

  // Guardrail: don't orphan sub-categories or products. Retire instead.
  if (children > 0 || products > 0) {
    const category = await prisma.category.update({ where: { id }, data: { status: "retired" } });
    await writeAudit({
      actorUserId: session.uid,
      action: "category.retire",
      entityType: "Category",
      entityId: id,
      before: { name: target.name, code: target.code },
    });
    return ok({ category, retired: true, reason: "in use — retired instead of deleted" });
  }

  await prisma.category.delete({ where: { id } });
  await writeAudit({
    actorUserId: session.uid,
    action: "category.delete",
    entityType: "Category",
    entityId: id,
    before: { name: target.name, code: target.code },
  });
  return ok({ deleted: true });
});

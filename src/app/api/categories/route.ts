import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(60).regex(/^[A-Za-z0-9_-]+$/, "code: letters, numbers, - and _ only"),
  parentId: z.coerce.bigint().optional().nullable(),
});

export const GET = handler(async () => {
  await requireRole("HO_ADMIN");
  const categories = await prisma.category.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: { parent: { select: { id: true, name: true } }, _count: { select: { children: true, brandProducts: true } } },
  });
  return ok({ categories });
});

export const POST = handler(async (req: Request) => {
  const session = await requireRole("HO_ADMIN");
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const { name, code, parentId } = parsed.data;
  if (parentId) {
    const parent = await prisma.category.findUnique({ where: { id: parentId } });
    if (!parent) return fail("Parent category not found", 422);
  }

  const category = await prisma.category.create({
    data: { name, code, parentId: parentId ?? null },
  });
  await writeAudit({
    actorUserId: session.uid,
    action: "category.create",
    entityType: "Category",
    entityId: category.id,
    after: { name: category.name, code: category.code },
  });
  return ok({ category }, { status: 201 });
});

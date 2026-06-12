import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { slugify } from "@/lib/categoryLevels";

const schema = z.object({
  parentId: z.coerce.bigint().nullable().optional(),
  names: z.array(z.string().trim().min(1).max(120)).min(1).max(500),
});

export const POST = handler(async (req: Request) => {
  const session = await requireRole("HO_ADMIN");
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const { parentId } = parsed.data;
  // de-dupe input names (case-insensitive), preserve order
  const seen = new Set<string>();
  const names: string[] = [];
  for (const n of parsed.data.names) {
    const key = n.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      names.push(n);
    }
  }

  if (parentId) {
    const parent = await prisma.category.findUnique({ where: { id: parentId } });
    if (!parent) return fail("Parent category not found", 422);
  }

  // Build unique codes (slug, with -2/-3 suffixes on collision).
  const candidates = names.map((n) => slugify(n) || "category");
  const existing = await prisma.category.findMany({
    where: { code: { in: candidates } },
    select: { code: true },
  });
  const used = new Set(existing.map((e) => e.code));
  const data = names.map((name, i) => {
    let base = candidates[i];
    let code = base;
    let k = 2;
    while (used.has(code)) code = `${base}-${k++}`;
    used.add(code);
    return { name, code, parentId: parentId ?? null, status: "active" };
  });

  const result = await prisma.category.createMany({ data, skipDuplicates: true });

  await writeAudit({
    actorUserId: session.uid,
    action: "category.create",
    entityType: "Category",
    entityId: parentId ?? null,
    after: { created: result.count, names: names.slice(0, 10), parentId: parentId?.toString() ?? null },
  });

  return ok({ created: result.count }, { status: 201 });
});

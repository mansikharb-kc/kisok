import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, handler } from "@/lib/api";

// Direct children of a category (or root domains when parentId is empty).
// Used by the cascading category picker.
export const GET = handler(async (req: Request) => {
  await requireRole("HO_ADMIN");
  const raw = (new URL(req.url).searchParams.get("parentId") || "").trim();

  let parentId: bigint | null = null;
  if (raw) {
    try {
      parentId = BigInt(raw);
    } catch {
      parentId = null;
    }
  }

  const rows = await prisma.category.findMany({
    where: { status: "active", parentId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, _count: { select: { children: true } } },
  });

  return ok({
    categories: rows.map((r) => ({
      id: r.id.toString(),
      name: r.name,
      hasChildren: r._count.children > 0,
    })),
  });
});

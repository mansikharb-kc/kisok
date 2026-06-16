import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, handler } from "@/lib/api";

// Lightweight typeahead for the 6k-deep category master.
// Returns up to 20 active categories matching the query (with parent for context).
export const GET = handler(async (req: Request) => {
  await requireRole("HO_ADMIN");
  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  if (q.length < 1) return ok({ categories: [] });

  const rows = await prisma.category.findMany({
    where: { status: "active", name: { contains: q } },
    orderBy: { name: "asc" },
    take: 20,
    select: { id: true, name: true, parent: { select: { name: true } } },
  });

  return ok({
    categories: rows.map((r) => ({
      id: r.id.toString(),
      name: r.name,
      parentName: r.parent?.name ?? null,
    })),
  });
});

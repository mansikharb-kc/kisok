import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";

// Resolve the OB Exec's operating branch from the session role entry.
function execBranchId(session: { roles: { code: string; branchId: string | null }[] }): bigint | null {
  const entry = session.roles.find((r) => r.code === "OB_EXEC" && r.branchId);
  if (!entry?.branchId) return null;
  try {
    return BigInt(entry.branchId);
  } catch {
    return null;
  }
}

// Walk a category up to its root, returning [self, parent, …root].
// (Same ancestor-walk used by /api/categories/[id]/attributes.)
async function ancestorChain(id: bigint) {
  const chain: { id: bigint; name: string }[] = [];
  let cur: bigint | null = id;
  let guard = 0;
  while (cur && guard++ < 20) {
    const c: { id: bigint; name: string; parentId: bigint | null } | null =
      await prisma.category.findUnique({
        where: { id: cur },
        select: { id: true, name: true, parentId: true },
      });
    if (!c) break;
    chain.push({ id: c.id, name: c.name });
    cur = c.parentId;
  }
  return chain;
}

// Effective attributes for a category = own + inherited (nearest ancestor wins).
async function effectiveCategoryAttributes(categoryId: bigint) {
  const chain = await ancestorChain(categoryId);
  if (chain.length === 0) return [];
  const chainIds = chain.map((c) => c.id);
  const distance = new Map(chain.map((c, i) => [c.id.toString(), i]));

  const maps = await prisma.categoryAttribute.findMany({
    where: { categoryId: { in: chainIds } },
    include: { attribute: { include: { options: { orderBy: { displayOrder: "asc" } } } } },
  });

  const best = new Map<string, (typeof maps)[number]>();
  for (const m of maps) {
    if (m.attribute.status !== "active") continue;
    const key = m.attributeId.toString();
    const d = distance.get(m.categoryId.toString()) ?? 99;
    const prev = best.get(key);
    const prevD = prev ? distance.get(prev.categoryId.toString()) ?? 99 : 99;
    if (!prev || d < prevD) best.set(key, m);
  }

  return [...best.values()]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((m) => ({
      id: m.attribute.id.toString(),
      name: m.attribute.name,
      code: m.attribute.code,
      dataType: m.attribute.dataType,
      unit: m.attribute.unit,
      isRequired: m.isRequiredOverride ?? m.attribute.isRequired,
      options: m.attribute.options.map((o) => ({ id: o.id.toString(), value: o.optionValue })),
    }));
}

// Program common attributes (rendered alongside the category attributes).
async function programCommonAttributes(programId: bigint) {
  const maps = await prisma.programCommonAttribute.findMany({
    where: { programId },
    include: { attribute: { include: { options: { orderBy: { displayOrder: "asc" } } } } },
  });
  return maps
    .filter((m) => m.attribute.status === "active")
    .map((m) => ({
      id: m.attribute.id.toString(),
      name: m.attribute.name,
      code: m.attribute.code,
      dataType: m.attribute.dataType,
      unit: m.attribute.unit,
      isRequired: m.attribute.isRequired,
      options: m.attribute.options.map((o) => ({ id: o.id.toString(), value: o.optionValue })),
    }));
}

export const GET = handler(async (req: Request) => {
  const session = await requireRole("OB_EXEC");
  const uid = BigInt(session.uid);
  const branchId = execBranchId(session);
  if (!branchId) return fail("No branch assigned to your OB_EXEC role", 403);

  const { searchParams } = new URL(req.url);
  const categoryIdRaw = searchParams.get("categoryId");
  const programIdRaw = searchParams.get("programId");
  const catQuery = searchParams.get("q")?.trim();

  // Mode A: effective attribute list for (category + program), de-duped.
  if (categoryIdRaw && programIdRaw) {
    let categoryId: bigint;
    let programId: bigint;
    try {
      categoryId = BigInt(categoryIdRaw);
      programId = BigInt(programIdRaw);
    } catch {
      return fail("Invalid categoryId or programId", 400);
    }

    const [catAttrs, progAttrs] = await Promise.all([
      effectiveCategoryAttributes(categoryId),
      programCommonAttributes(programId),
    ]);

    // De-dupe by attribute id; category attrs take precedence (keep their order).
    const seen = new Set(catAttrs.map((a) => a.id));
    const merged = [...catAttrs, ...progAttrs.filter((a) => !seen.has(a.id))];
    return ok({ attributes: merged });
  }

  // Mode B (with q): searchable category picker (~6380 categories — never dump all).
  if (catQuery !== null && catQuery !== undefined && searchParams.has("q")) {
    const categories = await prisma.category.findMany({
      where: {
        status: "active",
        ...(catQuery ? { OR: [{ name: { contains: catQuery } }, { code: { contains: catQuery } }] } : {}),
      },
      orderBy: { name: "asc" },
      take: 50,
      select: { id: true, name: true, code: true },
    });
    return ok({ categories });
  }

  // Mode C (default): cascade bootstrap — assigned sellers (+ their brands) and
  // the branch's APPROVED programs.
  const [assignments, branchPrograms] = await Promise.all([
    prisma.sellerAssignment.findMany({
      where: { obExecUserId: uid, seller: { branchId } } as any,
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            sellerCode: true,
            status: true,
            sellerBrands: {
              include: { brand: { select: { id: true, name: true, code: true } } },
            },
            sellerCategories: {
              select: { categoryId: true },
            },
          },
        },
      } as any,
    }) as Promise<any[]>,
    prisma.branchProgram.findMany({
      where: { branchId, approvalStatus: "approved" },
      include: { program: { select: { id: true, name: true, code: true } } },
    }),
  ]);

  const sellers = assignments
    .filter((a) => a.seller && a.seller.status === "active")
    .map((a) => ({
      id: a.seller.id.toString(),
      name: a.seller.name,
      sellerCode: a.seller.sellerCode,
      brands: a.seller.sellerBrands.map((sb: any) => ({
        id: sb.brand.id.toString(),
        name: sb.brand.name,
        code: sb.brand.code,
      })),
      categoryIds: a.seller.sellerCategories.map((sc: any) => sc.categoryId.toString()),
    }));

  const programs = branchPrograms.map((bp) => ({
    id: bp.program.id.toString(),
    name: bp.program.name,
    code: bp.program.code,
  }));

  return ok({ sellers, programs });
});

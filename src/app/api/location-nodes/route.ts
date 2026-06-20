import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const createSchema = z.object({
  branchId: z.coerce.bigint(),
  programId: z.coerce.bigint(),
  parentId: z.coerce.bigint().optional().nullable(),
  nodeType: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().max(60).regex(/^[A-Za-z0-9_-]*$/, "code: letters, numbers, - and _ only").optional().nullable(),
  categoryId: z.coerce.bigint().optional().nullable(),
  categoryIds: z.array(z.coerce.bigint()).optional(),
  isPlacementEligible: z.boolean().optional(),
  quantity: z.coerce.number().int().min(1).optional(),
  isScreenMountable: z.boolean().optional(),
});

function buildPath(parentPath: string | null, id: bigint): string {
  return parentPath ? `${parentPath}${id}/` : `/${id}/`;
}

function getDepth(parentPath: string | null): number {
  if (!parentPath) return 0;
  return parentPath.split("/").filter(Boolean).length;
}

function generateLocationId(branchId: bigint, nodeId: bigint): string {
  return `LOC-${branchId}-${nodeId}`;
}

export const GET = handler(async (req: Request) => {
  const session = await requireRole("HO_ADMIN", "BRANCH_ADMIN", "ONB_LEAD", "OB_EXEC", "CONSIGNMENT_USER");
  const { searchParams } = new URL(req.url);
  const branchIdParam = searchParams.get("branchId");
  const programIdParam = searchParams.get("programId");

  if (!branchIdParam) return fail("branchId is required", 400);
  const branchId = BigInt(branchIdParam);

  // The warehouse tree is scoped per-program — a program must be selected.
  if (!programIdParam) return fail("programId is required", 400);
  const programId = BigInt(programIdParam);

  // Branch admins can only see their own branch's nodes
  const isBranchAdmin = session.roles.some((r) => r.code === "BRANCH_ADMIN");
  if (isBranchAdmin) {
    const allowed = session.roles
      .filter((r) => r.code === "BRANCH_ADMIN" && r.branchId)
      .map((r) => String(r.branchId));
    if (!allowed.includes(String(branchId))) return fail("Forbidden", 403);
  }

  const nodes = await prisma.locationNode.findMany({
    where: { branchId, programId },
    orderBy: [{ path: "asc" }, { name: "asc" }],
    select: {
      id: true,
      parentId: true,
      nodeType: true,
      name: true,
      code: true,
      categoryId: true,
      path: true,
      depth: true,
      isPlacementEligible: true,
      isScreenMountable: true,
      locationId: true,
      status: true,
      category: {
        select: {
          id: true,
          name: true,
          code: true,
          categoryAttributes: {
            select: {
              attribute: {
                select: {
                  name: true,
                  code: true,
                }
              }
            }
          }
        }
      },
      _count: { select: { children: true, copies: true } },
    },
  });

  return ok({ nodes });
});

export const POST = handler(async (req: Request) => {
  const session = await requireRole("BRANCH_ADMIN");

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const { branchId, programId, parentId, nodeType, name, code, categoryId, categoryIds, isPlacementEligible, quantity, isScreenMountable } = parsed.data;
  const catIds = categoryIds && categoryIds.length ? [...new Set(categoryIds.map(String))].map((s) => BigInt(s)) : [];
  const primaryCategoryId = catIds[0] ?? categoryId ?? null;

  // Confirm branch admin owns this branch
  const ownsThisBranch = session.roles.some(
    (r) => r.code === "BRANCH_ADMIN" && String(r.branchId) === String(branchId),
  );
  if (!ownsThisBranch) return fail("Forbidden — not your branch", 403);

  // The selected program must be APPROVED for this branch — the tree is scoped to it.
  const branchProgram = await prisma.branchProgram.findUnique({
    where: { branchId_programId: { branchId, programId } },
  });
  if (!branchProgram || branchProgram.approvalStatus !== "approved") {
    return fail("Program is not an approved program for this branch", 422);
  }

  // Validate parent belongs to same branch + program; child nodes inherit the parent's program.
  let parentPath: string | null = null;
  if (parentId) {
    const parent = await prisma.locationNode.findUnique({ where: { id: parentId } });
    if (!parent) return fail("Parent node not found", 422);
    if (String(parent.branchId) !== String(branchId)) return fail("Parent belongs to a different branch", 422);
    if (String(parent.programId) !== String(programId)) return fail("Parent belongs to a different program", 422);
    parentPath = parent.path;
  }

  const depth = getDepth(parentPath);

  // Create the node first (need id for path + locationId)
  const node = await prisma.locationNode.create({
    data: {
      branchId,
      programId,
      parentId: parentId ?? null,
      nodeType,
      name,
      code: code || null,
      categoryId: primaryCategoryId,
      nodeCategories: { create: catIds.map((cid) => ({ categoryId: cid })) },
      depth,
      path: "",
      isPlacementEligible: isPlacementEligible ?? false,
      quantity: isPlacementEligible ? (quantity ?? 1) : 1,
      isScreenMountable: isScreenMountable ?? false,
      status: "active",
    },
  });

  // Now update path and locationId using the real id
  const path = buildPath(parentPath, node.id);
  const locationId =
    isPlacementEligible ? generateLocationId(branchId, node.id) : null;

  const updated = await prisma.locationNode.update({
    where: { id: node.id },
    data: { path, locationId },
  });

  await writeAudit({
    actorUserId: session.uid,
    action: "locationNode.create",
    entityType: "LocationNode",
    entityId: node.id,
    after: { name, nodeType, branchId: String(branchId), programId: String(programId) },
  });

  return ok({ node: updated }, { status: 201 });
});

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const NODE_TYPES = ["WAREHOUSE", "BLOCK", "RACK", "TRAY", "CUSTOM"] as const;

const createSchema = z.object({
  branchId: z.coerce.bigint(),
  parentId: z.coerce.bigint().optional().nullable(),
  nodeType: z.enum(NODE_TYPES),
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().max(60).regex(/^[A-Za-z0-9_-]*$/, "code: letters, numbers, - and _ only").optional().nullable(),
  isPlacementEligible: z.boolean().optional(),
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

  if (!branchIdParam) return fail("branchId is required", 400);
  const branchId = BigInt(branchIdParam);

  // Branch admins can only see their own branch's nodes
  const isBranchAdmin = session.roles.some((r) => r.code === "BRANCH_ADMIN");
  if (isBranchAdmin) {
    const allowed = session.roles
      .filter((r) => r.code === "BRANCH_ADMIN" && r.branchId)
      .map((r) => String(r.branchId));
    if (!allowed.includes(String(branchId))) return fail("Forbidden", 403);
  }

  const nodes = await prisma.locationNode.findMany({
    where: { branchId },
    orderBy: [{ path: "asc" }, { name: "asc" }],
    select: {
      id: true,
      parentId: true,
      nodeType: true,
      name: true,
      code: true,
      path: true,
      depth: true,
      isPlacementEligible: true,
      isScreenMountable: true,
      locationId: true,
      status: true,
      _count: { select: { children: true, copies: true } },
    },
  });

  return ok({ nodes });
});

export const POST = handler(async (req: Request) => {
  const session = await requireRole("BRANCH_ADMIN");

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const { branchId, parentId, nodeType, name, code, isPlacementEligible, isScreenMountable } = parsed.data;

  // Confirm branch admin owns this branch
  const ownsThisBranch = session.roles.some(
    (r) => r.code === "BRANCH_ADMIN" && String(r.branchId) === String(branchId),
  );
  if (!ownsThisBranch) return fail("Forbidden — not your branch", 403);

  // Validate parent belongs to same branch
  let parentPath: string | null = null;
  if (parentId) {
    const parent = await prisma.locationNode.findUnique({ where: { id: parentId } });
    if (!parent) return fail("Parent node not found", 422);
    if (String(parent.branchId) !== String(branchId)) return fail("Parent belongs to a different branch", 422);
    parentPath = parent.path;
  }

  const depth = getDepth(parentPath);

  // Create the node first (need id for path + locationId)
  const node = await prisma.locationNode.create({
    data: {
      branchId,
      parentId: parentId ?? null,
      nodeType,
      name,
      code: code || null,
      depth,
      path: "", // temp — updated below
      isPlacementEligible: isPlacementEligible ?? false,
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
    after: { name, nodeType, branchId: String(branchId) },
  });

  return ok({ node: updated }, { status: 201 });
});

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const NODE_TYPES = ["WAREHOUSE", "BLOCK", "RACK", "TRAY", "CUSTOM"] as const;

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  code: z.string().trim().max(60).regex(/^[A-Za-z0-9_-]*$/).optional().nullable(),
  nodeType: z.enum(NODE_TYPES).optional(),
  categoryId: z.coerce.bigint().optional().nullable(),
  categoryIds: z.array(z.coerce.bigint()).optional(),
  isPlacementEligible: z.boolean().optional(),
  quantity: z.coerce.number().int().min(1).optional(),
  isScreenMountable: z.boolean().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

function parseId(id: string): bigint | null {
  try { return BigInt(id); } catch { return null; }
}

export const PATCH = handler(async (req: Request, ctx: { params: { id: string } }) => {
  const session = await requireRole("BRANCH_ADMIN");
  const id = parseId(ctx.params.id);
  if (id === null) return fail("Invalid id", 400);

  const before = await prisma.locationNode.findUnique({ where: { id } });
  if (!before) return fail("Node not found", 404);

  // Confirm ownership
  const ownsThisBranch = session.roles.some(
    (r) => r.code === "BRANCH_ADMIN" && String(r.branchId) === String(before.branchId),
  );
  if (!ownsThisBranch) return fail("Forbidden — not your branch", 403);

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const { categoryIds, ...data } = parsed.data;

  // If toggling isPlacementEligible on, generate locationId; if off, clear it
  let locationId = before.locationId;
  if (data.isPlacementEligible === true && !before.locationId) {
    locationId = `LOC-${before.branchId}-${before.id}`;
  } else if (data.isPlacementEligible === false) {
    locationId = null;
  }

  const node = await prisma.$transaction(async (tx) => {
    const updated = await tx.locationNode.update({
      where: { id },
      data: {
        ...data,
        locationId,
        ...(data.isPlacementEligible === false ? { quantity: 1 } : {}),
        ...(categoryIds ? { categoryId: categoryIds[0] ?? null } : {}),
      },
    });
    if (categoryIds) {
      await tx.locationNodeCategory.deleteMany({ where: { locationNodeId: id } });
      const uniq = [...new Set(categoryIds.map(String))];
      if (uniq.length) {
        await tx.locationNodeCategory.createMany({ data: uniq.map((cid) => ({ locationNodeId: id, categoryId: BigInt(cid) })) });
      }
    }
    return updated;
  });

  await writeAudit({
    actorUserId: session.uid,
    action: "locationNode.update",
    entityType: "LocationNode",
    entityId: id,
    before: { name: before.name, nodeType: before.nodeType, status: before.status },
    after: { name: node.name, nodeType: node.nodeType, status: node.status },
  });

  return ok({ node });
});

export const DELETE = handler(async (_req: Request, ctx: { params: { id: string } }) => {
  const session = await requireRole("BRANCH_ADMIN");
  const id = parseId(ctx.params.id);
  if (id === null) return fail("Invalid id", 400);

  const target = await prisma.locationNode.findUnique({ where: { id } });
  if (!target) return fail("Node not found", 404);

  const ownsThisBranch = session.roles.some(
    (r) => r.code === "BRANCH_ADMIN" && String(r.branchId) === String(target.branchId),
  );
  if (!ownsThisBranch) return fail("Forbidden — not your branch", 403);

  // If it has children or product copies, deactivate instead of delete
  const [children, copies] = await Promise.all([
    prisma.locationNode.count({ where: { parentId: id } }),
    prisma.productCopy.count({ where: { locationNodeId: id } }),
  ]);

  if (children > 0 || copies > 0) {
    // PRD §B5: copies must be relocated before this node can be removed
    if (copies > 0) {
      return fail(
        `Cannot delete "${target.name}" — ${copies} product ${copies === 1 ? "copy" : "copies"} placed here. Relocate all copies first.`,
        409,
      );
    }
    // Has children but no copies — deactivate instead of hard delete
    const node = await prisma.locationNode.update({ where: { id }, data: { status: "inactive" } });
    await writeAudit({
      actorUserId: session.uid, action: "locationNode.deactivate",
      entityType: "LocationNode", entityId: id,
    });
    return ok({ node, deactivated: true, reason: "has sub-nodes — deactivated instead of deleted" });
  }

  await prisma.locationNode.delete({ where: { id } });
  await writeAudit({
    actorUserId: session.uid, action: "locationNode.delete",
    entityType: "LocationNode", entityId: id,
    before: { name: target.name, nodeType: target.nodeType },
  });
  return ok({ deleted: true });
});

// RMS screen map/unmap/delete — Branch Admin / Screen Manager, branch-scoped. Phase: P1.1
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";

function branchIdFor(roles: { code: string; branchId: string | null }[]): bigint | null {
  const r = roles.find(
    (x) => (x.code === "BRANCH_ADMIN" || x.code === "SCREEN_MANAGER") && x.branchId
  );
  return r?.branchId ? BigInt(r.branchId) : null;
}

function parseId(id: string): bigint | null {
  try { return BigInt(id); } catch { return null; }
}

// PATCH = partial update: edit name/view, and/or map to a block (locationNodeId) or unmap (null).
const patchSchema = z.object({
  locationNodeId: z.coerce.bigint().nullable().optional(),
  name: z.string().trim().max(120).nullable().optional(),
  viewDefault: z.enum(["LOCAL", "GLOBAL"]).optional(),
});

export const PATCH = handler(async (req: Request, ctx: { params: { id: string } }) => {
  const session = await requireRole("BRANCH_ADMIN", "SCREEN_MANAGER");
  const branchId = branchIdFor(session.roles);
  if (!branchId) return fail("No branch scope for this user", 403);

  const id = parseId(ctx.params.id);
  if (id === null) return fail("Invalid id", 400);

  const screen = await prisma.screen.findFirst({ where: { id, branchId }, select: { id: true } });
  if (!screen) return fail("Screen not found in your branch", 404);

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const { locationNodeId, name, viewDefault } = parsed.data;

  // If mapping to a rack (not null), validate it.
  if (locationNodeId !== undefined && locationNodeId !== null) {
    const rack = await prisma.locationNode.findFirst({
      where: { id: locationNodeId, branchId, nodeType: "RACK" },
      select: { id: true },
    });
    if (!rack) return fail("Selected rack not found in your branch", 404);

    // One screen per rack: rack must not already be mapped to a different screen.
    const taken = await prisma.screen.findFirst({
      where: { branchId, locationNodeId, id: { not: id } },
      select: { id: true },
    });
    if (taken) return fail("This rack already has a screen mapped to it", 409);
  }

  const data: { locationNodeId?: bigint | null; name?: string | null; viewDefault?: string } = {};
  if (locationNodeId !== undefined) data.locationNodeId = locationNodeId;
  if (name !== undefined) data.name = name;
  if (viewDefault !== undefined) data.viewDefault = viewDefault;

  const updated = await prisma.screen.update({ where: { id }, data });
  return ok({ screen: updated });
});

export const DELETE = handler(async (_req: Request, ctx: { params: { id: string } }) => {
  const session = await requireRole("BRANCH_ADMIN", "SCREEN_MANAGER");
  const branchId = branchIdFor(session.roles);
  if (!branchId) return fail("No branch scope for this user", 403);

  const id = parseId(ctx.params.id);
  if (id === null) return fail("Invalid id", 400);

  const screen = await prisma.screen.findFirst({ where: { id, branchId }, select: { id: true } });
  if (!screen) return fail("Screen not found in your branch", 404);

  await prisma.screen.delete({ where: { id } });
  return ok({ deleted: true });
});

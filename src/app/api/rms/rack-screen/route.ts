// Assign racks to a screen (or unmap). Phase: P1.1
// Done from the Blocks page: select multiple racks of a block, pick a screen, map.
// A screen covers many racks; a rack belongs to one screen.
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";

function branchIdFor(roles: { code: string; branchId: string | null }[]): bigint | null {
  const r = roles.find((x) => (x.code === "BRANCH_ADMIN" || x.code === "SCREEN_MANAGER") && x.branchId);
  return r?.branchId ? BigInt(r.branchId) : null;
}

const bodySchema = z.object({
  rackIds: z.array(z.coerce.bigint()).min(1),
  screenId: z.coerce.bigint().nullable(), // null = unmap the racks
});

export const POST = handler(async (req: Request) => {
  const session = await requireRole("BRANCH_ADMIN", "SCREEN_MANAGER");
  const branchId = branchIdFor(session.roles);
  if (!branchId) return fail("No branch scope for this user", 403);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const rackIds = [...new Set(parsed.data.rackIds.map(String))].map((s) => BigInt(s));
  const { screenId } = parsed.data;

  // All racks must be RACK nodes in this branch.
  const validCount = await prisma.locationNode.count({
    where: { id: { in: rackIds }, branchId, nodeType: "RACK" },
  });
  if (validCount !== rackIds.length) return fail("One or more racks are not valid for your branch", 400);

  if (screenId === null) {
    // Unmap these racks.
    await prisma.screenRack.deleteMany({ where: { locationNodeId: { in: rackIds } } });
    return ok({ unmapped: rackIds.length });
  }

  // Screen must belong to this branch.
  const screen = await prisma.screen.findFirst({ where: { id: screenId, branchId }, select: { id: true } });
  if (!screen) return fail("Screen not found in your branch", 404);

  // Assign each rack to this screen (moves it off any other screen — a rack has one screen).
  await prisma.$transaction(
    rackIds.map((rackId) =>
      prisma.screenRack.upsert({
        where: { locationNodeId: rackId },
        create: { screenId, locationNodeId: rackId },
        update: { screenId },
      })
    )
  );

  return ok({ mapped: rackIds.length });
});

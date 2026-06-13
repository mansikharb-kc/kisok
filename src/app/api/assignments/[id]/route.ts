import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

function parseId(id: string): bigint | null {
  try {
    return BigInt(id);
  } catch {
    return null;
  }
}

export const DELETE = handler(async (_req: Request, ctx: { params: { id: string } }) => {
  const session = await requireRole("ONB_LEAD");
  const id = parseId(ctx.params.id);
  if (id === null) return fail("Invalid id", 400);

  const roleEntry = session.roles.find((r) => r.code === "ONB_LEAD" && r.branchId);
  const branchId = roleEntry?.branchId ? BigInt(roleEntry.branchId) : null;
  if (!branchId) return fail("No active branch role found", 403);

  const target = await prisma.sellerAssignment.findUnique({
    where: { id },
    include: {
      seller: { select: { branchId: true, name: true } },
      exec: { select: { fullName: true } },
    },
  });

  if (!target) return fail("Assignment not found", 404);
  if (target.seller.branchId !== branchId) return fail("Not authorized to remove this assignment", 403);

  await prisma.sellerAssignment.delete({ where: { id } });

  await writeAudit({
    actorUserId: session.uid,
    action: "seller.unassign",
    entityType: "SellerAssignment",
    entityId: id,
    before: {
      sellerName: target.seller.name,
      execName: target.exec.fullName,
    },
  });

  return ok({ deleted: true });
});

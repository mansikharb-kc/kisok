import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  branchCode: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/).optional(),
  city: z.string().trim().max(120).optional().nullable(),
  address: z.string().trim().max(255).optional().nullable(),
  status: z.enum(["active", "inactive"]).optional(),
});

function parseId(id: string): bigint | null {
  try {
    return BigInt(id);
  } catch {
    return null;
  }
}

export const GET = handler(async (_req: Request, ctx: { params: { id: string } }) => {
  await requireRole("HO_ADMIN");
  const id = parseId(ctx.params.id);
  if (id === null) return fail("Invalid id", 400);

  const branch = await prisma.branch.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          branchPrograms: true,
          branchBrands: true,
          locationNodes: true,
          sampleSizes: true,
          sellers: true,
          localRecords: true,
          productCopies: true,
          screens: true,
          userRoles: true,
        },
      },
    },
  });
  if (!branch) return fail("Branch not found", 404);
  return ok({ branch });
});

export const PATCH = handler(async (req: Request, ctx: { params: { id: string } }) => {
  const session = await requireRole("HO_ADMIN");
  const id = parseId(ctx.params.id);
  if (id === null) return fail("Invalid id", 400);

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const before = await prisma.branch.findUnique({ where: { id } });
  if (!before) return fail("Branch not found", 404);

  const branch = await prisma.branch.update({
    where: { id },
    data: {
      ...parsed.data,
      city: parsed.data.city === undefined ? undefined : parsed.data.city ?? null,
      address: parsed.data.address === undefined ? undefined : parsed.data.address ?? null,
    },
  });

  await writeAudit({
    actorUserId: session.uid,
    action: parsed.data.status && parsed.data.status !== before.status ? `branch.${parsed.data.status === "inactive" ? "deactivate" : "activate"}` : "branch.update",
    entityType: "Branch",
    entityId: branch.id,
    before: { name: before.name, branchCode: before.branchCode, status: before.status },
    after: { name: branch.name, branchCode: branch.branchCode, status: branch.status },
  });

  return ok({ branch });
});

export const DELETE = handler(async (_req: Request, ctx: { params: { id: string } }) => {
  const session = await requireRole("HO_ADMIN");
  const id = parseId(ctx.params.id);
  if (id === null) return fail("Invalid id", 400);

  const target = await prisma.branch.findUnique({ where: { id } });
  if (!target) return fail("Branch not found", 404);

  const counts = await Promise.all([
    prisma.branchProgram.count({ where: { branchId: id } }),
    prisma.branchBrand.count({ where: { branchId: id } }),
    prisma.locationNode.count({ where: { branchId: id } }),
    prisma.sampleSize.count({ where: { branchId: id } }),
    prisma.seller.count({ where: { branchId: id } }),
    prisma.localOnboardingRecord.count({ where: { branchId: id } }),
    prisma.productCopy.count({ where: { branchId: id } }),
    prisma.screen.count({ where: { branchId: id } }),
    prisma.userRole.count({ where: { branchId: id } }),
  ]);

  if (counts.some((count) => count > 0)) {
    const branch = await prisma.branch.update({ where: { id }, data: { status: "inactive" } });
    await writeAudit({ actorUserId: session.uid, action: "branch.deactivate", entityType: "Branch", entityId: id });
    return ok({ branch, deactivated: true, reason: "in use — deactivated instead of deleted" });
  }

  await prisma.branch.delete({ where: { id } });
  await writeAudit({ actorUserId: session.uid, action: "branch.delete", entityType: "Branch", entityId: id });
  return ok({ deleted: true });
});
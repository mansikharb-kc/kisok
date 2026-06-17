import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const dateish = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable();

const updateSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  sellerCode: z.string().trim().min(1).max(60).regex(/^[A-Za-z0-9_-]+$/).optional(),
  membershipId: z.string().trim().max(60).optional().nullable(),
  status: z.enum(["active", "retired"]).optional(),
  brandIds: z.array(z.coerce.bigint()).optional(),
  categoryIds: z.array(z.coerce.bigint()).optional(),
  contracts: z.array(z.object({
    programId: z.coerce.bigint(),
    collaborationTenure: z.string().trim().max(60).optional().nullable(),
    fitoutPeriod: z.string().trim().max(60).optional().nullable(),
    contractStart: dateish,
    contractEnd: dateish,
    verified: z.boolean().optional().default(false),
    remarks: z.string().trim().max(500).optional().nullable(),
    obExecUserId: z.coerce.bigint().optional().nullable(),
    contractMediaId: z.coerce.bigint().optional().nullable(),
  })).optional(),
});

function parseId(id: string): bigint | null {
  try {
    return BigInt(id);
  } catch {
    return null;
  }
}

export const GET = handler(async (_req: Request, ctx: { params: { id: string } }) => {
  const session = await requireRole("ONB_LEAD", "BRANCH_ADMIN");
  const id = parseId(ctx.params.id);
  if (id === null) return fail("Invalid id", 400);

  const seller = await prisma.seller.findUnique({
    where: { id },
    include: {
      sellerBrands: { select: { brandId: true } },
      sellerCategories: { select: { categoryId: true } },
      contracts: { include: { contractMedia: { select: { url: true } } } },
      assignments: { include: { exec: { select: { fullName: true } } } },
    },
  });

  if (!seller) return fail("Seller not found", 404);
  return ok({ seller });
});

export const PATCH = handler(async (req: Request, ctx: { params: { id: string } }) => {
  const session = await requireRole("ONB_LEAD");
  const id = parseId(ctx.params.id);
  if (id === null) return fail("Invalid id", 400);

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const { brandIds, categoryIds, contracts, ...data } = parsed.data;

  // Check unique code
  if (data.sellerCode) {
    const existing = await prisma.seller.findFirst({
      where: { sellerCode: data.sellerCode, NOT: { id } },
    });
    if (existing) return fail("Seller code must be unique.", 409);
  }

  // Check unique membership ID
  if (data.membershipId) {
    const existing = await prisma.seller.findFirst({
      where: { membershipId: data.membershipId, NOT: { id } },
    });
    if (existing) return fail("Membership ID must be unique.", 409);
  }

  const updatedSeller = await prisma.$transaction(async (tx) => {
    const updated = await tx.seller.update({
      where: { id },
      data: {
        ...data,
      },
    });

    if (brandIds) {
      await tx.sellerBrand.deleteMany({ where: { sellerId: id } });
      const uniq = [...new Set(brandIds.map(String))];
      if (uniq.length) {
        await tx.sellerBrand.createMany({
          data: uniq.map((bid) => ({ sellerId: id, brandId: BigInt(bid) })),
        });
      }
    }

    if (categoryIds) {
      await tx.sellerCategory.deleteMany({ where: { sellerId: id } });
      const uniq = [...new Set(categoryIds.map(String))];
      if (uniq.length) {
        await tx.sellerCategory.createMany({
          data: uniq.map((cid) => ({ sellerId: id, categoryId: BigInt(cid) })),
        });
      }
    }

    if (contracts) {
      await tx.sellerContract.deleteMany({ where: { sellerId: id } });
      if (contracts.length) {
        await tx.sellerContract.createMany({
          data: contracts.map((c) => ({
            sellerId: id,
            programId: c.programId,
            collaborationTenure: c.collaborationTenure,
            fitoutPeriod: c.fitoutPeriod,
            contractStart: c.contractStart ? new Date(c.contractStart) : null,
            contractEnd: c.contractEnd ? new Date(c.contractEnd) : null,
            verified: c.verified,
            remarks: c.remarks,
            contractMediaId: c.contractMediaId,
          })),
        });
      }

      await tx.sellerAssignment.deleteMany({ where: { sellerId: id } });
      const assignmentsToCreate = contracts
        .filter((c) => c.obExecUserId)
        .map((c) => ({
          sellerId: id,
          programId: c.programId,
          obExecUserId: c.obExecUserId!,
          assignedBy: BigInt(session.uid),
        }));
      if (assignmentsToCreate.length > 0) {
        await tx.sellerAssignment.createMany({
          data: assignmentsToCreate,
        });
      }
    }

    const finalBrandIds = brandIds 
      ? brandIds 
      : (await tx.sellerBrand.findMany({ where: { sellerId: id }, select: { brandId: true } })).map((b) => b.brandId);

    const finalCategoryIds = categoryIds
      ? categoryIds
      : (await tx.sellerCategory.findMany({ where: { sellerId: id }, select: { categoryId: true } })).map((c) => c.categoryId);

    if (finalBrandIds.length > 0 && finalCategoryIds.length > 0) {
      const brandCategoriesToCreate = [];
      for (const bid of finalBrandIds) {
        for (const cid of finalCategoryIds) {
          brandCategoriesToCreate.push({
            brandId: bid,
            categoryId: cid,
          });
        }
      }
      await tx.brandCategory.createMany({
        data: brandCategoriesToCreate,
        skipDuplicates: true,
      });
    }

    return updated;
  });

  await writeAudit({
    actorUserId: session.uid,
    action: "seller.update",
    entityType: "Seller",
    entityId: id,
    after: { name: updatedSeller.name, status: updatedSeller.status },
  });

  return ok({ seller: updatedSeller });
});

export const DELETE = handler(async (_req: Request, ctx: { params: { id: string } }) => {
  const session = await requireRole("ONB_LEAD");
  const id = parseId(ctx.params.id);
  if (id === null) return fail("Invalid id", 400);

  const target = await prisma.seller.findUnique({ where: { id } });
  if (!target) return fail("Seller not found", 404);

  const [consignments, records, assignments] = await Promise.all([
    prisma.consignment.count({ where: { sellerId: id } }),
    prisma.localOnboardingRecord.count({ where: { sellerId: id } }),
    prisma.sellerAssignment.count({ where: { sellerId: id } }),
  ]);

  if (consignments > 0 || records > 0 || assignments > 0) {
    const retired = await prisma.seller.update({
      where: { id },
      data: { status: "retired" },
    });
    await writeAudit({
      actorUserId: session.uid,
      action: "seller.retire",
      entityType: "Seller",
      entityId: id,
    });
    return ok({ seller: retired, retired: true, reason: "in use — retired instead of deleted" });
  }

  await prisma.seller.delete({ where: { id } });
  await writeAudit({
    actorUserId: session.uid,
    action: "seller.delete",
    entityType: "Seller",
    entityId: id,
  });
  return ok({ deleted: true });
});

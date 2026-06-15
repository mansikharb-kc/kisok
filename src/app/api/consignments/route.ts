import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const dateish = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable();

const createSchema = z.object({
  sellerId: z.coerce.bigint(),
  brandId: z.coerce.bigint(),
  spocName: z.string().trim().max(120).optional().nullable(),
  spocContact: z.string().trim().max(120).optional().nullable(),
  expectedDate: dateish,
  remarks: z.string().trim().max(500).optional().nullable(),
  items: z
    .array(
      z.object({
        description: z.string().trim().min(1).max(255),
        expectedQty: z.coerce.number().int().min(0).optional().nullable(),
        sampleType: z.string().trim().max(120).optional().nullable(),
      })
    )
    .default([]),
});

/** Branch ids this caller can operate consignments in, across all relevant roles. */
function branchIdsFor(session: { roles: { code: string; branchId: string | null }[] }) {
  return session.roles
    .filter(
      (r) =>
        ["ONB_LEAD", "CONSIGNMENT_USER", "OB_EXEC"].includes(r.code) && r.branchId
    )
    .map((r) => BigInt(r.branchId as string));
}

export const GET = handler(async () => {
  const session = await requireRole("ONB_LEAD", "CONSIGNMENT_USER", "OB_EXEC");
  const branchIds = branchIdsFor(session);
  if (branchIds.length === 0) return fail("No active branch role found", 403);

  const consignments = await prisma.consignment.findMany({
    where: { seller: { branchId: { in: branchIds } } },
    orderBy: { createdAt: "desc" },
    include: {
      seller: { select: { name: true, sellerCode: true } },
      brand: { select: { name: true, code: true } },
      items: {
        orderBy: { id: "asc" },
        include: { qcRecords: { orderBy: { qcAt: "desc" }, take: 1 } },
      },
    },
  });

  return ok({ consignments });
});

export const POST = handler(async (req: Request) => {
  const session = await requireRole("ONB_LEAD", "OB_EXEC");
  const branchIds = branchIdsFor(session).map(String);
  if (branchIds.length === 0) return fail("No active branch role found", 403);

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const { sellerId, brandId, items, expectedDate, ...rest } = parsed.data;

  // Verify seller exists and belongs to one of the caller's branches.
  const seller = await prisma.seller.findUnique({
    where: { id: sellerId },
    include: { sellerBrands: { select: { brandId: true } } },
  });
  if (!seller) return fail("Seller not found", 404);
  if (!branchIds.includes(String(seller.branchId))) {
    return fail("Forbidden — seller is not in your branch", 403);
  }

  // Verify the brand is associated with this seller.
  const brandOk = seller.sellerBrands.some((sb) => String(sb.brandId) === String(brandId));
  if (!brandOk) return fail("Selected brand is not associated with this seller", 400);

  const consignment = await prisma.$transaction(async (tx) => {
    return tx.consignment.create({
      data: {
        sellerId,
        brandId,
        initiatedBy: BigInt(session.uid),
        spocName: rest.spocName ?? null,
        spocContact: rest.spocContact ?? null,
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        remarks: rest.remarks ?? null,
        status: "initiated",
        items: {
          create: items.map((it) => ({
            description: it.description,
            expectedQty: it.expectedQty ?? null,
            sampleType: it.sampleType ?? null,
            status: "pending",
          })),
        },
      },
    });
  });

  await writeAudit({
    actorUserId: session.uid,
    action: "consignment.create",
    entityType: "Consignment",
    entityId: consignment.id,
    after: { sellerId: String(sellerId), brandId: String(brandId), items: items.length },
  });

  return ok({ consignment }, { status: 201 });
});

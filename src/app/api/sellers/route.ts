import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const dateish = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable();

// Auto-generate the next Membership ID (MEM-0001, MEM-0002…) — global sequential.
async function nextMembershipId(): Promise<string> {
  const existing = await prisma.seller.findMany({
    where: { membershipId: { startsWith: "MEM-" } },
    select: { membershipId: true },
  });
  let max = 0;
  for (const e of existing) {
    const n = parseInt((e.membershipId ?? "").split("-")[1] ?? "0", 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `MEM-${String(max + 1).padStart(4, "0")}`;
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(150),
  sellerCode: z.string().trim().min(1).max(60).regex(/^[A-Za-z0-9_-]+$/, "code: letters, numbers, - and _ only"),
  membershipId: z.string().trim().max(60).optional().nullable(),
  memberType: z.string().trim().max(40).optional().nullable(),
  salesperson: z.string().trim().max(120).optional().nullable(),
  spocName: z.string().trim().max(120).optional().nullable(),
  spocPhone: z.string().trim().max(30).optional().nullable(),
  spocEmail: z.string().trim().max(150).optional().nullable(),
  customFields: z.record(z.string(), z.any()).optional().nullable(),
  status: z.enum(["active", "retired", "archived"]).optional().default("active"),
  brandIds: z.array(z.coerce.bigint()).optional().default([]),
  categoryIds: z.array(z.coerce.bigint()).optional().default([]),
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
    customFields: z.record(z.string(), z.any()).optional().nullable(),
  })).optional().default([]),
});

export const GET = handler(async () => {
  const session = await requireRole("ONB_LEAD");
  const roleEntry = session.roles.find((r) => r.code === "ONB_LEAD" && r.branchId);
  const branchId = roleEntry?.branchId ? BigInt(roleEntry.branchId) : null;
  if (!branchId) return fail("No active branch role found", 403);

  const sellers = await prisma.seller.findMany({
    where: { branchId, status: { not: "archived" } },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: {
      sellerBrands: { include: { brand: { select: { name: true, code: true } } } },
      contracts: { include: { program: { select: { name: true } } } },
      assignments: { include: { exec: { select: { fullName: true } } } },
    },
  });

  return ok({ sellers });
});

export const POST = handler(async (req: Request) => {
  const session = await requireRole("ONB_LEAD");
  const roleEntry = session.roles.find((r) => r.code === "ONB_LEAD" && r.branchId);
  const branchId = roleEntry?.branchId ? BigInt(roleEntry.branchId) : null;
  if (!branchId) return fail("No active branch role found", 403);

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const { brandIds, categoryIds, contracts, customFields, ...rest } = parsed.data;

  // Verify unique sellerCode globally
  const existingCode = await prisma.seller.findUnique({
    where: { sellerCode: rest.sellerCode },
  });
  if (existingCode) return fail("Seller code must be unique.", 409);

  // Membership ID: use provided (verify unique) or auto-generate MEM-####.
  if (rest.membershipId) {
    const existingMember = await prisma.seller.findUnique({
      where: { membershipId: rest.membershipId },
    });
    if (existingMember) return fail("Membership ID must be unique.", 409);
  } else {
    rest.membershipId = await nextMembershipId();
  }

  // Create seller, brand mappings, and contracts in a transaction
  const seller = await prisma.$transaction(async (tx) => {
    const created = await tx.seller.create({
      data: {
        ...rest,
        branchId,
        customFields: customFields ?? undefined,
        sellerBrands: {
          create: brandIds.map((bid) => ({ brandId: bid })),
        },
        sellerCategories: {
          create: categoryIds.map((cid) => ({ categoryId: cid })),
        },
        contracts: {
          create: contracts.map((c) => ({
            programId: c.programId,
            collaborationTenure: c.collaborationTenure,
            fitoutPeriod: c.fitoutPeriod,
            contractStart: c.contractStart ? new Date(c.contractStart) : null,
            contractEnd: c.contractEnd ? new Date(c.contractEnd) : null,
            verified: c.verified,
            remarks: c.remarks,
            contractMediaId: c.contractMediaId,
            customFields: c.customFields ?? undefined,
          })),
        },
      },
    });

    const assignmentsToCreate = contracts
      .filter((c) => c.obExecUserId)
      .map((c) => ({
        sellerId: created.id,
        programId: c.programId,
        obExecUserId: c.obExecUserId!,
        assignedBy: BigInt(session.uid),
      }));

    if (assignmentsToCreate.length > 0) {
      await tx.sellerAssignment.createMany({
        data: assignmentsToCreate,
      });
    }

    if (brandIds.length > 0 && categoryIds.length > 0) {
      const brandCategoriesToCreate = [];
      for (const bid of brandIds) {
        for (const cid of categoryIds) {
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

    return created;
  });

  await writeAudit({
    actorUserId: session.uid,
    action: "seller.create",
    entityType: "Seller",
    entityId: seller.id,
    after: { name: seller.name, sellerCode: seller.sellerCode },
  });

  return ok({ seller }, { status: 201 });
});

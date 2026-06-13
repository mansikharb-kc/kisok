import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const dateish = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable();

const createSchema = z.object({
  name: z.string().trim().min(1).max(150),
  sellerCode: z.string().trim().min(1).max(60).regex(/^[A-Za-z0-9_-]+$/, "code: letters, numbers, - and _ only"),
  membershipId: z.string().trim().max(60).optional().nullable(),
  status: z.enum(["active", "retired"]).optional().default("active"),
  brandIds: z.array(z.coerce.bigint()).optional().default([]),
  contracts: z.array(z.object({
    programId: z.coerce.bigint(),
    collaborationTenure: z.string().trim().max(60).optional().nullable(),
    fitoutPeriod: z.string().trim().max(60).optional().nullable(),
    contractStart: dateish,
    contractEnd: dateish,
    verified: z.boolean().optional().default(false),
    remarks: z.string().trim().max(500).optional().nullable(),
  })).optional().default([]),
});

export const GET = handler(async () => {
  const session = await requireRole("ONB_LEAD");
  const roleEntry = session.roles.find((r) => r.code === "ONB_LEAD" && r.branchId);
  const branchId = roleEntry?.branchId ? BigInt(roleEntry.branchId) : null;
  if (!branchId) return fail("No active branch role found", 403);

  const sellers = await prisma.seller.findMany({
    where: { branchId },
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

  const { brandIds, contracts, ...rest } = parsed.data;

  // Verify unique sellerCode globally
  const existingCode = await prisma.seller.findUnique({
    where: { sellerCode: rest.sellerCode },
  });
  if (existingCode) return fail("Seller code must be unique.", 409);

  // Verify unique membershipId globally if provided
  if (rest.membershipId) {
    const existingMember = await prisma.seller.findUnique({
      where: { membershipId: rest.membershipId },
    });
    if (existingMember) return fail("Membership ID must be unique.", 409);
  }

  // Create seller, brand mappings, and contracts in a transaction
  const seller = await prisma.$transaction(async (tx) => {
    const created = await tx.seller.create({
      data: {
        ...rest,
        branchId,
        sellerBrands: {
          create: brandIds.map((bid) => ({ brandId: bid })),
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
          })),
        },
      },
    });
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

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const resolveSchema = z.object({
  directConsignmentId: z.coerce.bigint(),
  sellerName: z.string().trim().min(1).max(150),
  sellerCode: z.string().trim().min(1).max(60).regex(/^[A-Za-z0-9_-]+$/, "code: letters, numbers, - and _ only"),
  brandId: z.coerce.bigint(),
  categoryId: z.coerce.bigint(),
  programId: z.coerce.bigint(),
  obExecUserId: z.coerce.bigint(),
  membershipId: z.string().trim().max(60).optional().nullable(),
  memberType: z.string().trim().max(40).optional().nullable(),
  salesperson: z.string().trim().max(120).optional().nullable(),
  spocName: z.string().trim().max(120).optional().nullable(),
  spocPhone: z.string().trim().max(30).optional().nullable(),
  spocEmail: z.string().trim().max(150).optional().nullable(),
});

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

export const POST = handler(async (req: Request) => {
  const session = await requireRole("ONB_LEAD");
  const roleEntry = session.roles.find((r) => r.code === "ONB_LEAD" && r.branchId);
  const branchId = roleEntry?.branchId ? BigInt(roleEntry.branchId) : null;
  if (!branchId) return fail("No active branch role found", 403);

  const body = await req.json().catch(() => null);
  const parsed = resolveSchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const {
    directConsignmentId,
    sellerName,
    sellerCode,
    brandId,
    categoryId,
    programId,
    obExecUserId,
    membershipId,
    memberType,
    salesperson,
    spocName,
    spocPhone,
    spocEmail,
  } = parsed.data;

  // 1. Verify unique sellerCode globally
  const existingCode = await prisma.seller.findUnique({
    where: { sellerCode },
  });
  if (existingCode) return fail("Seller code must be unique.", 409);

  // 2. Generate or Validate Membership ID
  let finalMembershipId = membershipId;
  if (finalMembershipId) {
    const existingMember = await prisma.seller.findUnique({
      where: { membershipId: finalMembershipId },
    });
    if (existingMember) return fail("Membership ID must be unique.", 409);
  } else {
    finalMembershipId = await nextMembershipId();
  }

  // 3. Verify direct consignment exists and is open
  const dc = await prisma.directConsignment.findUnique({
    where: { id: directConsignmentId },
  });
  if (!dc || dc.branchId !== branchId) {
    return fail("Invalid or unauthorized Direct Consignment", 422);
  }

  // 4. Verify OB Exec belongs to the user's branch and has OB_EXEC role
  const execRole = await prisma.userRole.findFirst({
    where: {
      userId: obExecUserId,
      branchId,
      role: { code: "OB_EXEC" },
    },
  });
  if (!execRole) return fail("Onboarding executive not found or not in your branch", 400);

  // Create seller, brand, category, program contract, assignment, and resolve direct consignment in transaction
  const result = await prisma.$transaction(async (tx) => {
    const createdSeller = await tx.seller.create({
      data: {
        name: sellerName,
        sellerCode,
        membershipId: finalMembershipId,
        memberType,
        salesperson,
        spocName,
        spocPhone,
        spocEmail,
        branchId,
        status: "active",
        sellerBrands: {
          create: [{ brandId }],
        },
        sellerCategories: {
          create: [{ categoryId }],
        },
        contracts: {
          create: [{
            programId,
            verified: true,
            remarks: "Created from direct consignment resolution",
          }],
        },
      },
    });

    const assignment = await tx.sellerAssignment.create({
      data: {
        sellerId: createdSeller.id,
        programId,
        obExecUserId,
        assignedBy: BigInt(session.uid),
      },
    });

    // Resolve the direct consignment
    const updatedDc = await tx.directConsignment.update({
      where: { id: directConsignmentId },
      data: {
        status: "RESOLVED",
        sellerId: createdSeller.id,
        brandId,
        resolvedAt: new Date(),
      },
    });

    return { createdSeller, assignment, updatedDc };
  });

  await writeAudit({
    actorUserId: session.uid,
    action: "seller.create_from_direct",
    entityType: "Seller",
    entityId: result.createdSeller.id,
    after: { name: sellerName, sellerCode },
  });

  return ok({
    sellerId: result.createdSeller.id.toString(),
    assignmentId: result.assignment.id.toString(),
    directConsignmentId: result.updatedDc.id.toString(),
  });
});

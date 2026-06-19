import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

// Resolve the OB Exec's operating branch from the session role entry.
function execBranchId(session: { roles: { code: string; branchId: string | null }[] }): bigint | null {
  const entry = session.roles.find((r) => r.code === "OB_EXEC" && r.branchId);
  if (!entry?.branchId) return null;
  try {
    return BigInt(entry.branchId);
  } catch {
    return null;
  }
}

// GET → local onboarding records for the exec's branch, restricted to sellers
// ASSIGNED to this exec.
export const GET = handler(async () => {
  const session = await requireRole("OB_EXEC");
  const uid = BigInt(session.uid);
  const branchId = execBranchId(session);
  if (!branchId) return fail("No branch assigned to your OB_EXEC role", 403);

  // Sellers assigned to this exec (and physically at this branch).
  const assignments = await prisma.sellerAssignment.findMany({
    where: { obExecUserId: uid, seller: { branchId } },
    select: { sellerId: true },
  });
  const sellerIds = assignments.map((a) => a.sellerId);
  if (sellerIds.length === 0) return ok({ records: [] });

  const records = await prisma.localOnboardingRecord.findMany({
    where: { branchId, sellerId: { in: sellerIds } },
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        select: {
          name: true,
          sku: true,
          brand: { select: { name: true, code: true } },
          category: { select: { name: true, code: true } },
        },
      },
      seller: { select: { name: true, sellerCode: true } },
      program: { select: { name: true, code: true } },
    },
  });

  return ok({ records });
});

const createSchema = z.object({
  brandProductId: z.coerce.bigint(),
  sellerId: z.coerce.bigint(),
  programId: z.coerce.bigint(),
});

// POST → create a LocalOnboardingRecord linking (brandProduct, seller, branch, program).
export const POST = handler(async (req: Request) => {
  const session = await requireRole("OB_EXEC");
  const uid = BigInt(session.uid);
  const branchId = execBranchId(session);
  if (!branchId) return fail("No branch assigned to your OB_EXEC role", 403);

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  const { brandProductId, sellerId, programId } = parsed.data;

  // Seller must be assigned to this executive for this program (verified type safety).
  const assignment = await prisma.sellerAssignment.findUnique({
    where: { sellerId_programId: { sellerId, programId } },
    include: { seller: { select: { branchId: true } } },
  });
  if (!assignment || assignment.obExecUserId !== uid) return fail("Seller is not assigned to you for this program", 403);

  const sellerBranchId = assignment.seller.branchId;
  if (sellerBranchId !== branchId) return fail("Seller belongs to a different branch", 403);

  const [product, branchProgram] = await Promise.all([
    prisma.brandProduct.findUnique({ where: { id: brandProductId }, select: { id: true } }),
    // Program must be APPROVED for this branch.
    prisma.branchProgram.findUnique({
      where: { branchId_programId: { branchId: sellerBranchId, programId } },
      select: { approvalStatus: true },
    }),
  ]);
  if (!product) return fail("Brand product not found", 422);
  if (!branchProgram) return fail("Program is not configured for this branch", 422);
  if (branchProgram.approvalStatus !== "approved") {
    return fail("Program is not approved for this branch", 422);
  }

  const existing = await prisma.localOnboardingRecord.findUnique({
    where: {
      brandProductId_sellerId_branchId_programId: {
        brandProductId,
        sellerId,
        branchId: sellerBranchId,
        programId,
      },
    },
    select: { id: true },
  });
  if (existing) return fail("This product is already onboarded for this seller & program.", 409);

  const record = await prisma.localOnboardingRecord.create({
    data: {
      brandProductId,
      sellerId,
      branchId: sellerBranchId,
      programId,
      status: "onboarded",
      onboardedBy: uid,
    },
  });

  await writeAudit({
    actorUserId: session.uid,
    action: "onboarding.create",
    entityType: "LocalOnboardingRecord",
    entityId: record.id,
    after: {
      brandProductId: brandProductId.toString(),
      sellerId: sellerId.toString(),
      branchId: sellerBranchId.toString(),
      programId: programId.toString(),
    },
  });

  return ok({ id: record.id.toString() }, { status: 201 });
});

const deleteSchema = z.object({
  brandProductId: z.coerce.bigint(),
  sellerId: z.coerce.bigint(),
  programId: z.coerce.bigint(),
});

export const DELETE = handler(async (req: Request) => {
  const session = await requireRole("OB_EXEC");
  const uid = BigInt(session.uid);
  const branchId = execBranchId(session);
  if (!branchId) return fail("No branch assigned to your OB_EXEC role", 403);

  const parsed = deleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  const { brandProductId, sellerId, programId } = parsed.data;

  // Seller must be assigned to this executive for this program.
  const assignment = await prisma.sellerAssignment.findUnique({
    where: { sellerId_programId: { sellerId, programId } },
    include: { seller: { select: { branchId: true } } },
  });
  if (!assignment || assignment.obExecUserId !== uid) return fail("Seller is not assigned to you for this program", 403);

  const sellerBranchId = assignment.seller.branchId;
  if (sellerBranchId !== branchId) return fail("Seller belongs to a different branch", 403);

  const record = await prisma.localOnboardingRecord.findUnique({
    where: {
      brandProductId_sellerId_branchId_programId: {
        brandProductId,
        sellerId,
        branchId: sellerBranchId,
        programId,
      },
    },
    select: { id: true },
  });

  if (!record) return fail("Onboarding record not found", 404);

  await prisma.localOnboardingRecord.delete({
    where: { id: record.id },
  });

  await writeAudit({
    actorUserId: session.uid,
    action: "onboarding.delete",
    entityType: "LocalOnboardingRecord",
    entityId: record.id,
    before: {
      brandProductId: brandProductId.toString(),
      sellerId: sellerId.toString(),
      branchId: sellerBranchId.toString(),
      programId: programId.toString(),
    },
  });

  return ok({ success: true });
});


import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const createSchema = z.object({
  sellerId: z.coerce.bigint(),
  programId: z.coerce.bigint(),
  obExecUserId: z.coerce.bigint(),
});

export const POST = handler(async (req: Request) => {
  const session = await requireRole("ONB_LEAD");
  const roleEntry = session.roles.find((r) => r.code === "ONB_LEAD" && r.branchId);
  const branchId = roleEntry?.branchId ? BigInt(roleEntry.branchId) : null;
  if (!branchId) return fail("No active branch role found", 403);

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const { sellerId, programId, obExecUserId } = parsed.data;

  // Verify seller belongs to the user's branch
  const seller = await prisma.seller.findUnique({
    where: { id: sellerId },
    select: { branchId: true, name: true },
  });
  if (!seller) return fail("Seller not found", 404);
  if (seller.branchId !== branchId) return fail("Seller does not belong to your branch", 403);

  // Verify OB Exec belongs to the user's branch and has OB_EXEC role
  const execRole = await prisma.userRole.findFirst({
    where: {
      userId: obExecUserId,
      branchId,
      role: { code: "OB_EXEC" },
    },
    include: { user: { select: { fullName: true } } },
  });
  if (!execRole) return fail("Onboarding executive not found or not in your branch", 400);

  // Verify the program is one the seller is contracted under
  const contract = await prisma.sellerContract.findFirst({
    where: { sellerId, programId },
    select: { program: { select: { name: true } } },
  });
  if (!contract) return fail("Program is not one the seller is contracted under.", 422);

  // Check if assignment already exists
  const existing = await prisma.sellerAssignment.findUnique({
    where: {
      sellerId_obExecUserId: { sellerId, obExecUserId },
    },
  });
  if (existing) return fail("Seller is already assigned to this executive.", 409);

  // Create assignment
  const assignment = await prisma.sellerAssignment.create({
    data: {
      sellerId,
      programId,
      obExecUserId,
      assignedBy: BigInt(session.uid),
    },
  });

  await writeAudit({
    actorUserId: session.uid,
    action: "seller.assign",
    entityType: "SellerAssignment",
    entityId: assignment.id,
    after: {
      sellerName: seller.name,
      programName: contract.program.name,
      execName: execRole.user.fullName,
    },
  });

  return ok({ assignment }, { status: 201 });
});

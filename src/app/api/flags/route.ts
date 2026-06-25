import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { updateAssignmentOnboardingStatus } from "@/lib/onboardingStatusHelper";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { serialize } from "@/lib/prisma";

const createFlagSchema = z.object({
  assignmentId: z.string(),
  brandId: z.string(),
  reason: z.string().trim().min(1, "Reason is required"),
  stage: z.string().trim().min(1, "Stage is required"),
});

export const GET = handler(async (req: Request) => {
  const session = await requireRole("HO_ADMIN", "BRANCH_ADMIN", "ONB_LEAD", "OB_EXEC");

  const isHo = session.roles.some((r) => r.code === "HO_ADMIN");
  const branchRole = session.roles.find((r) => r.branchId);
  const branchId = branchRole?.branchId ? BigInt(branchRole.branchId) : null;

  const where: any = {};
  if (!isHo) {
    if (!branchId) return fail("Branch context not found", 400);
    where.pipeline = {
      assignment: {
        seller: {
          branchId,
        },
      },
    };
  }

  const flags = await prisma.flag.findMany({
    where,
    include: {
      pipeline: {
        include: {
          brand: {
            select: { name: true, code: true },
          },
          assignment: {
            include: {
              seller: {
                select: { name: true, sellerCode: true },
              },
              program: {
                select: { name: true },
              },
              exec: {
                select: { fullName: true, email: true },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return ok({ flags: serialize(flags) });
});

export const POST = handler(async (req: Request) => {
  const session = await requireRole("OB_EXEC", "ONB_LEAD", "BRANCH_ADMIN", "HO_ADMIN");

  const body = await req.json().catch(() => null);
  const parsed = createFlagSchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const { assignmentId, brandId, reason, stage } = parsed.data;

  // Retrieve assignment
  const assignment = await prisma.sellerAssignment.findUnique({
    where: { id: BigInt(assignmentId) },
  });
  if (!assignment) return fail("Assignment not found", 404);

  // Find or create pipeline
  let pipeline = await prisma.onboardingPipeline.findUnique({
    where: {
      assignmentId_brandId: {
        assignmentId: BigInt(assignmentId),
        brandId: BigInt(brandId),
      },
    },
  });

  if (!pipeline) {
    pipeline = await prisma.onboardingPipeline.create({
      data: {
        assignmentId: BigInt(assignmentId),
        brandId: BigInt(brandId),
        status: "INITIATION",
      },
    });
  }

  const flag = await prisma.flag.create({
    data: {
      pipelineId: pipeline.id,
      reason,
      stage,
      isResolved: false,
    },
  });

  await updateAssignmentOnboardingStatus(BigInt(assignmentId));

  return ok({ flag: serialize(flag) });
});

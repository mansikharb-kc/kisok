import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { serialize } from "@/lib/prisma";

const reminderSchema = z.object({
  pipelineId: z.string().trim(),
  dateToRevisit: z.string().trim(),
});

export const GET = handler(async (req: Request) => {
  const session = await requireRole("OB_EXEC", "ONB_LEAD");
  
  // Get user's branch
  const roleEntry =
    session.roles.find((r) => r.code === "OB_EXEC" && r.branchId) ??
    session.roles.find((r) => r.code === "ONB_LEAD" && r.branchId);
  const branchId = roleEntry?.branchId ? BigInt(roleEntry.branchId) : null;
  if (!branchId) return fail("Branch context not found", 400);

  const isExec = session.roles.some((r) => r.code === "OB_EXEC");

  const reminders = await prisma.reminder.findMany({
    where: {
      pipeline: {
        assignment: {
          seller: {
            branchId,
          },
        },
      },
      // If OB_EXEC, only show their own reminders
      userId: isExec ? BigInt(session.uid) : undefined,
    },
    include: {
      pipeline: {
        include: {
          assignment: {
            include: {
              seller: true,
              program: true,
              exec: {
                select: {
                  fullName: true,
                  email: true,
                },
              },
            },
          },
          brand: true,
        },
      },
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return ok({ reminders: serialize(reminders) });
});

export const POST = handler(async (req: Request) => {
  const session = await requireRole("OB_EXEC", "ONB_LEAD");
  const body = await req.json().catch(() => null);
  const parsed = reminderSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  }

  const { pipelineId, dateToRevisit } = parsed.data;
  const pId = BigInt(pipelineId);
  const userId = BigInt(session.uid);

  // Check if pipeline exists
  const pipeline = await prisma.onboardingPipeline.findUnique({
    where: { id: pId },
  });
  if (!pipeline) {
    return fail("Pipeline not found", 404);
  }

  // Find if there's an existing pending reminder for this user and pipeline
  const existing = await prisma.reminder.findFirst({
    where: {
      pipelineId: pId,
      userId,
      status: "pending",
    },
  });

  let reminder;
  if (existing) {
    reminder = await prisma.reminder.update({
      where: { id: existing.id },
      data: {
        dateToRevisit,
        status: "pending", // Reset to pending if it was somehow different
      },
    });
  } else {
    reminder = await prisma.reminder.create({
      data: {
        pipelineId: pId,
        userId,
        dateToRevisit,
        status: "pending",
      },
    });
  }

  return ok({ reminder: serialize(reminder) });
});

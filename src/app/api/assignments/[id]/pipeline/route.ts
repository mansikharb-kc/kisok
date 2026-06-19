import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { serialize } from "@/lib/prisma";

function parseId(id: string): bigint | null {
  try {
    return BigInt(id);
  } catch {
    return null;
  }
}

const pipelineSchema = z.object({
  action: z.enum(["save-initiation", "raise-ticket", "verify-consignment", "save-data-sticker", "save-verification"]),
  discussionDone: z.boolean().optional(),
  reqSpaceAndRack: z.boolean().optional(),
  reqData: z.boolean().optional(),
  reqSample: z.boolean().optional(),
  reqKt: z.boolean().optional(),
  docAttached: z.string().trim().nullable().optional(),
  itemTarget: z.string().trim().nullable().optional(),
  nextActionTime: z.string().trim().nullable().optional(),
  remarks: z.string().trim().nullable().optional(),
  dateToRevisit: z.string().trim().nullable().optional(),
  brandId: z.string().trim().optional(),
  dataPendingResolved: z.boolean().optional(),
  stickerPasted: z.boolean().optional(),
  placedInRack: z.boolean().optional(),
  verificationPhoto: z.string().trim().nullable().optional(),
});

export const POST = handler(async (req: Request, ctx: { params: { id: string } }) => {
  const session = await requireRole("OB_EXEC", "ONB_LEAD");
  const assignmentId = parseId(ctx.params.id);
  if (assignmentId === null) return fail("Invalid assignment ID", 400);

  const body = await req.json().catch(() => null);
  const parsed = pipelineSchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const {
    action,
    discussionDone = false,
    reqSpaceAndRack = false,
    reqData = false,
    reqSample = false,
    reqKt = false,
    docAttached = null,
    itemTarget = null,
    nextActionTime = null,
    remarks = null,
    dateToRevisit = null,
    brandId,
    dataPendingResolved = false,
    stickerPasted = false,
    placedInRack = false,
    verificationPhoto = null,
  } = parsed.data;

  // Retrieve assignment
  const assignment = await prisma.sellerAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      seller: {
        include: {
          sellerBrands: {
            include: {
              brand: true,
            },
          },
        },
      },
      program: true,
    },
  });
  if (!assignment) return fail("Assignment not found", 404);

  // If role is OB_EXEC, must be assigned to this user
  const isExec = session.roles.some((r) => r.code === "OB_EXEC");
  if (isExec && assignment.obExecUserId !== BigInt(session.uid)) {
    return fail("Not authorized to modify this assignment", 403);
  }

  // Get branch ID
  const roleEntry =
    session.roles.find((r) => r.code === "OB_EXEC" && r.branchId) ??
    session.roles.find((r) => r.code === "ONB_LEAD" && r.branchId);
  const branchId = roleEntry?.branchId ? BigInt(roleEntry.branchId) : null;
  if (!branchId) return fail("Branch context not found", 400);

  // Determine brand ID
  let targetBrandId: bigint | null = null;
  if (brandId) {
    try {
      targetBrandId = BigInt(brandId);
    } catch {
      return fail("Invalid brand ID", 400);
    }
  } else if (assignment.seller.sellerBrands.length > 0) {
    targetBrandId = assignment.seller.sellerBrands[0].brandId;
  }

  if (!targetBrandId) {
    return fail("No brand associated with this assignment", 400);
  }

  if (action === "save-initiation") {
    const pipeline = await prisma.onboardingPipeline.upsert({
      where: {
        assignmentId_brandId: {
          assignmentId,
          brandId: targetBrandId,
        },
      },
      update: {
        discussionDone,
        reqSpaceAndRack,
        reqData,
        reqSample,
        reqKt,
        docAttached,
        itemTarget,
        nextActionTime,
        remarks,
        dateToRevisit,
      },
      create: {
        assignmentId,
        brandId: targetBrandId,
        status: "INITIATION",
        discussionDone,
        reqSpaceAndRack,
        reqData,
        reqSample,
        reqKt,
        docAttached,
        itemTarget,
        nextActionTime,
        remarks,
        dateToRevisit,
      },
    });
    return ok({ pipeline: serialize(pipeline) });
  }

  if (action === "raise-ticket") {
    const brandInfo = assignment.seller.sellerBrands.find((sb) => sb.brandId === targetBrandId)?.brand;
    const spocName = brandInfo?.contactPerson ?? "N/A";
    const spocPhone = brandInfo?.phone ?? "N/A";
    const spocEmail = brandInfo?.email ?? "N/A";

    // Retrieve contract timelines
    const contract = await prisma.sellerContract.findFirst({
      where: { sellerId: assignment.sellerId, programId: assignment.programId },
    });

    const fitoutPeriod = contract?.fitoutPeriod ?? "N/A";
    const cStart = contract?.contractStart ? contract.contractStart.toISOString().slice(0, 10) : "N/A";
    const cEnd = contract?.contractEnd ? contract.contractEnd.toISOString().slice(0, 10) : "N/A";

    const ticketTitle = `Consignment Request: ${assignment.seller.name} - ${assignment.program.name}`;
    const ticketDesc = `Sample Target List: ${itemTarget || "Not Specified"}
Timeline: Fitout Period (${fitoutPeriod} Days), Collaboration Start: ${cStart}, End: ${cEnd}
SPOC Person: Name: ${spocName}, Phone: ${spocPhone}, Email: ${spocEmail}
Remarks: ${remarks || "None"}`;

    // Execute in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the Ticket
      const ticket = await tx.ticket.create({
        data: {
          title: ticketTitle,
          description: ticketDesc,
          type: "SAMPLE_REQUEST",
          status: "WITH_CONSIGNMENT",
          currentRole: "CONSIGNMENT_USER",
          branchId,
          sellerId: assignment.sellerId,
          brandId: targetBrandId!,
          raisedBy: BigInt(session.uid),
        },
      });

      // Generate a ticket number like TKT-XXXXX
      const ticketNo = `TKT-${String(ticket.id).padStart(5, "0")}`;
      const updatedTicket = await tx.ticket.update({
        where: { id: ticket.id },
        data: { ticketNo },
      });

      // 2. Create TicketEvent
      await tx.ticketEvent.create({
        data: {
          ticketId: ticket.id,
          action: "raise",
          fromRole: "OB_EXEC",
          toRole: "CONSIGNMENT_USER",
          note: `Raised onboarding consignment sample request ticket ${ticketNo}`,
          byUserId: BigInt(session.uid),
        },
      });

      // 3. Upsert OnboardingPipeline
      const pipeline = await tx.onboardingPipeline.upsert({
        where: {
          assignmentId_brandId: {
            assignmentId,
            brandId: targetBrandId!,
          },
        },
        update: {
          discussionDone,
          reqSpaceAndRack,
          reqData,
          reqSample,
          reqKt,
          docAttached,
          itemTarget,
          nextActionTime,
          remarks,
          dateToRevisit,
          status: "TICKET_RAISED",
          ticketId: ticket.id,
        },
        create: {
          assignmentId,
          brandId: targetBrandId!,
          status: "TICKET_RAISED",
          discussionDone,
          reqSpaceAndRack,
          reqData,
          reqSample,
          reqKt,
          docAttached,
          itemTarget,
          nextActionTime,
          remarks,
          dateToRevisit,
          ticketId: ticket.id,
        },
      });

      return { pipeline, ticket: updatedTicket };
    });

    return ok({
      pipeline: serialize(result.pipeline),
      ticket: serialize(result.ticket),
    });
  }

  if (action === "verify-consignment") {
    // Fetch current pipeline
    const existingPipeline = await prisma.onboardingPipeline.findUnique({
      where: {
        assignmentId_brandId: {
          assignmentId,
          brandId: targetBrandId,
        },
      },
    });
    if (!existingPipeline) return fail("Pipeline not found", 404);
    if (existingPipeline.status !== "CONSIGNMENT_RECEIVED") {
      return fail("Consignment must be received by consignment user before verification", 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update pipeline to DATA_AND_STICKER (new Step 3)
      const pipeline = await tx.onboardingPipeline.update({
        where: {
          id: existingPipeline.id,
        },
        data: {
          status: "DATA_AND_STICKER",
          execVerified: true,
        },
      });

      // 2. Update linked ticket to CLOSED
      if (existingPipeline.ticketId) {
        await tx.ticket.update({
          where: { id: existingPipeline.ticketId },
          data: {
            status: "CLOSED",
            currentRole: "OB_EXEC",
            resolution: "Consignment received and verified by Onboarding Executive",
            resolvedAt: new Date(),
          },
        });

        await tx.ticketEvent.create({
          data: {
            ticketId: existingPipeline.ticketId,
            action: "resolve",
            fromRole: "OB_EXEC",
            note: "Consignment verified and ticket closed by executive",
            byUserId: BigInt(session.uid),
          },
        });
      }

      return { pipeline };
    });

    return ok({ pipeline: serialize(result.pipeline) });
  }

  if (action === "save-data-sticker") {
    const existingPipeline = await prisma.onboardingPipeline.findUnique({
      where: {
        assignmentId_brandId: {
          assignmentId,
          brandId: targetBrandId,
        },
      },
    });
    if (!existingPipeline) return fail("Pipeline not found", 404);
    if (existingPipeline.status !== "DATA_AND_STICKER") {
      return fail("Pipeline must be in DATA_AND_STICKER stage to save details", 400);
    }

    const targetStatus = (dataPendingResolved && stickerPasted) ? "VERIFICATION" : "DATA_AND_STICKER";

    const pipeline = await prisma.onboardingPipeline.update({
      where: {
        id: existingPipeline.id,
      },
      data: {
        dataPendingResolved,
        stickerPasted,
        status: targetStatus,
      },
    });

    return ok({ pipeline: serialize(pipeline) });
  }

  if (action === "save-verification") {
    const existingPipeline = await prisma.onboardingPipeline.findUnique({
      where: {
        assignmentId_brandId: {
          assignmentId,
          brandId: targetBrandId,
        },
      },
    });
    if (!existingPipeline) return fail("Pipeline not found", 404);
    if (existingPipeline.status !== "VERIFICATION") {
      return fail("Pipeline must be in VERIFICATION stage to save details", 400);
    }

    if (!verificationPhoto || !verificationPhoto.trim()) {
      return fail("Verification Photograph is mandatory", 400);
    }

    const targetStatus = placedInRack ? "CLOSED" : "VERIFICATION";

    const pipeline = await prisma.onboardingPipeline.update({
      where: {
        id: existingPipeline.id,
      },
      data: {
        placedInRack,
        verificationPhoto,
        status: targetStatus,
      },
    });

    return ok({ pipeline: serialize(pipeline) });
  }

  return fail("Invalid action", 400);
});

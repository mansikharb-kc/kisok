import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { updateAssignmentOnboardingStatus } from "@/lib/onboardingStatusHelper";
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
  isDirectConsignment: z.boolean().optional(),
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
    isDirectConsignment = false,
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
          sellerCategories: {
            include: {
              category: true,
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
    await updateAssignmentOnboardingStatus(assignmentId);
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

    const brandText = brandInfo ? `${brandInfo.name} (${brandInfo.code})` : "N/A";
    const categoriesText = assignment.seller.sellerCategories?.map((sc) => sc.category.name).join(", ") || "None";

    const ticketTitle = `Consignment Request: ${assignment.seller.name} - ${assignment.program.name}`;
    const ticketDesc = `Sample Target List: ${itemTarget || "Not Specified"}
Timeline: Fitout Period (${fitoutPeriod} Days), Collaboration Start: ${cStart}, End: ${cEnd}
SPOC Person: Name: ${spocName}, Phone: ${spocPhone}, Email: ${spocEmail}
Remarks: ${remarks || "None"}`;

    const spaceRackDesc = `Seller: ${assignment.seller.name} (${assignment.seller.sellerCode})
Brand: ${brandText}
Program: ${assignment.program.name} (${assignment.program.code})
Categories: ${categoriesText}
SPOC Person: Name: ${spocName}, Phone: ${spocPhone}, Email: ${spocEmail}
Remarks: ${remarks || "None"}`;

    const ktDesc = `Knowledge Transfer coordination request for seller ${assignment.seller.name} (${assignment.seller.sellerCode})
Brand: ${brandText}
Program: ${assignment.program.name} (${assignment.program.code})
SPOC Person: Name: ${spocName}, Phone: ${spocPhone}, Email: ${spocEmail}
Remarks: ${remarks || "None"}`;

    // Execute in transaction
    const result = await prisma.$transaction(async (tx) => {
      let primaryTicketId: bigint | null = null;
      let primaryTicketNo: string | null = null;
      let primaryDirectConsignmentId: bigint | null = null;
      let details: any = {};
      if (isDirectConsignment) {
        const dcRecord = await tx.directConsignment.findFirst({
          where: {
            sellerId: assignment.sellerId,
            status: "RESOLVED",
          },
        });
        if (dcRecord) {
          primaryDirectConsignmentId = dcRecord.id;
          details = {
            receivedDate: dcRecord.receivedDate,
            vehicleDetails: dcRecord.vehicleDetails,
            quantityReceived: dcRecord.quantityReceived,
            boxQc: dcRecord.boxQc,
            photographUrl: dcRecord.photographUrl,
            packingListDoc: dcRecord.packingListDoc,
            remarks: dcRecord.remarks,
          };
        }
      }

      // 1. If reqSample is checked, generate the primary Sample Request ticket
      if (reqSample) {
        const ticket = await tx.ticket.create({
          data: {
            title: ticketTitle,
            description: ticketDesc,
            type: "SAMPLE_REQUEST",
            status: isDirectConsignment ? "WITH_EXEC" : "WITH_CONSIGNMENT",
            currentRole: isDirectConsignment ? "OB_EXEC" : "CONSIGNMENT_USER",
            branchId,
            sellerId: assignment.sellerId,
            brandId: targetBrandId!,
            raisedBy: BigInt(session.uid),
          },
        });
        const ticketNo = `TKT-${String(ticket.id).padStart(5, "0")}`;
        await tx.ticket.update({
          where: { id: ticket.id },
          data: { ticketNo },
        });
        await tx.ticketEvent.create({
          data: {
            ticketId: ticket.id,
            action: "raise",
            fromRole: "OB_EXEC",
            toRole: isDirectConsignment ? "OB_EXEC" : "CONSIGNMENT_USER",
            note: isDirectConsignment
              ? `Raised onboarding direct consignment sample request ticket ${ticketNo} (bypass)`
              : `Raised onboarding consignment sample request ticket ${ticketNo}`,
            byUserId: BigInt(session.uid),
          },
        });
        primaryTicketId = ticket.id;
        primaryTicketNo = ticketNo;
      }

      // 2. If reqSpaceAndRack is checked, generate the Space & Rack ticket for PROJECT_USER
      if (reqSpaceAndRack) {
        const spaceRackTitle = `Space & Rack Request: ${assignment.seller.name} - ${assignment.program.name}`;
        const ticket = await tx.ticket.create({
          data: {
            title: spaceRackTitle,
            description: spaceRackDesc,
            type: "SPACE_RACK",
            status: "WITH_PROJECT_USER",
            currentRole: "PROJECT_USER",
            branchId,
            sellerId: assignment.sellerId,
            brandId: targetBrandId!,
            raisedBy: BigInt(session.uid),
          },
        });
        const ticketNo = `TKT-${String(ticket.id).padStart(5, "0")}`;
        await tx.ticket.update({
          where: { id: ticket.id },
          data: { ticketNo },
        });
        await tx.ticketEvent.create({
          data: {
            ticketId: ticket.id,
            action: "raise",
            fromRole: "OB_EXEC",
            toRole: "PROJECT_USER",
            note: `Raised onboarding space & rack allocation request ticket ${ticketNo}`,
            byUserId: BigInt(session.uid),
          },
        });
      }

      // 3. If reqKt is checked, generate the KT Request ticket for CONCIERGE_MANAGER
      if (reqKt) {
        const ktTitle = `Knowledge Transfer Request: ${assignment.seller.name} - ${assignment.program.name}`;
        const ticket = await tx.ticket.create({
          data: {
            title: ktTitle,
            description: ktDesc,
            type: "KT_REQUEST",
            status: "WITH_CONCIERGE",
            currentRole: "CONCIERGE_MANAGER",
            branchId,
            sellerId: assignment.sellerId,
            brandId: targetBrandId!,
            raisedBy: BigInt(session.uid),
          },
        });
        const ticketNo = `TKT-${String(ticket.id).padStart(5, "0")}`;
        await tx.ticket.update({
          where: { id: ticket.id },
          data: { ticketNo },
        });
        await tx.ticketEvent.create({
          data: {
            ticketId: ticket.id,
            action: "raise",
            fromRole: "OB_EXEC",
            toRole: "CONCIERGE_MANAGER",
            note: `Raised onboarding knowledge transfer request ticket ${ticketNo}`,
            byUserId: BigInt(session.uid),
          },
        });
      }

      // 4. Determine pipeline status:
      // If reqSample is checked, go to TICKET_RAISED (warehouse receipt flow).
      // If reqSample is false (but space/rack or KT is checked), go directly to DATA_AND_STICKER.
      // If isDirectConsignment is true and reqSample is checked, go directly to CONSIGNMENT_RECEIVED.
      const targetStatus = reqSample
        ? (isDirectConsignment ? "CONSIGNMENT_RECEIVED" : "TICKET_RAISED")
        : "DATA_AND_STICKER";

      const receiptFields = isDirectConsignment ? {
        receivedDate: details.receivedDate ? new Date(details.receivedDate) : null,
        vehicleDetails: details.vehicleDetails || null,
        quantityReceived: details.quantityReceived || 0,
        boxQc: details.boxQc || null,
        photographUrl: details.photographUrl || null,
        packingListDoc: details.packingListDoc || null,
        consignmentRemarks: details.remarks || null,
      } : {};

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
          status: targetStatus,
          ticketId: primaryTicketId,
          directConsignmentId: primaryDirectConsignmentId,
          ...receiptFields,
        },
        create: {
          assignmentId,
          brandId: targetBrandId!,
          status: targetStatus,
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
          ticketId: primaryTicketId,
          directConsignmentId: primaryDirectConsignmentId,
          ...receiptFields,
        },
      });

      await updateAssignmentOnboardingStatus(assignmentId, tx);
      return { pipeline, ticketNo: primaryTicketNo };
    });

    return ok({
      pipeline: serialize(result.pipeline),
      ticket: result.ticketNo ? { ticketNo: result.ticketNo } : null,
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

      await updateAssignmentOnboardingStatus(assignmentId, tx);
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

    const isStageResolved = dataPendingResolved && (stickerPasted || !existingPipeline.reqSample);
    const targetStatus = isStageResolved
      ? (existingPipeline.reqSample ? "VERIFICATION" : "CLOSED")
      : "DATA_AND_STICKER";

    const pipeline = await prisma.onboardingPipeline.update({
      where: {
        id: existingPipeline.id,
      },
      data: {
        dataPendingResolved,
        stickerPasted: existingPipeline.reqSample ? stickerPasted : true,
        status: targetStatus,
      },
    });

    await updateAssignmentOnboardingStatus(assignmentId);
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

    await updateAssignmentOnboardingStatus(assignmentId);
    return ok({ pipeline: serialize(pipeline) });
  }

  return fail("Invalid action", 400);
});

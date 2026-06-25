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

const receiveSchema = z.object({
  receivedDate: z.string().trim().min(1, "Received Date is required"),
  vehicleDetails: z.string().trim().min(1, "Vehicle Details is required").max(255),
  quantityReceived: z.coerce.number().int().positive("Quantity received must be greater than 0"),
  boxQc: z.string().trim().min(2, "Please select/specify box QC status"),
  photographUrl: z.string().trim().min(1, "Photograph Reference upload is required").max(255),
  packingListDoc: z.string().trim().min(1, "Packing List Document upload is required").max(255),
  consignmentRemarks: z.string().trim().nullable().optional(),
});

export const POST = handler(async (req: Request, ctx: { params: { id: string } }) => {
  const session = await requireRole("CONSIGNMENT_USER");
  const ticketId = parseId(ctx.params.id);
  if (ticketId === null) return fail("Invalid ticket ID", 400);

  const body = await req.json().catch(() => null);
  const parsed = receiveSchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const {
    receivedDate,
    vehicleDetails,
    quantityReceived,
    boxQc,
    photographUrl,
    packingListDoc,
    consignmentRemarks = null,
  } = parsed.data;

  // Retrieve ticket
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
  });
  if (!ticket) return fail("Ticket not found", 404);

  // Retrieve pipeline associated with ticket
  const pipeline = await prisma.onboardingPipeline.findUnique({
    where: { ticketId },
  });
  if (!pipeline) return fail("No active onboarding pipeline associated with this ticket", 404);

  const rDate = receivedDate ? new Date(receivedDate) : new Date();

  const result = await prisma.$transaction(async (tx) => {
    // 1. Update OnboardingPipeline
    const updatedPipeline = await tx.onboardingPipeline.update({
      where: { id: pipeline.id },
      data: {
        status: "CONSIGNMENT_RECEIVED",
        receivedDate: rDate,
        vehicleDetails,
        quantityReceived,
        boxQc,
        photographUrl,
        packingListDoc,
        consignmentRemarks,
      },
    });

    // 2. Update Ticket status/role to OB_EXEC
    const updatedTicket = await tx.ticket.update({
      where: { id: ticketId },
      data: {
        status: "WITH_EXEC",
        currentRole: "OB_EXEC",
      },
    });

    // 3. Create TicketEvent
    await tx.ticketEvent.create({
      data: {
        ticketId,
        action: "send_to_exec",
        fromRole: "CONSIGNMENT_USER",
        toRole: "OB_EXEC",
        note: `Consignment Received. Qty: ${quantityReceived}, QC: ${boxQc}, Vehicle: ${vehicleDetails || "N/A"}. Packing list: ${packingListDoc || "None"}. Remarks: ${consignmentRemarks || "None"}`,
        byUserId: BigInt(session.uid),
      },
    });

    await updateAssignmentOnboardingStatus(updatedPipeline.assignmentId, tx);

    return { pipeline: updatedPipeline, ticket: updatedTicket };
  });

  return ok({
    pipeline: serialize(result.pipeline),
    ticket: serialize(result.ticket),
  });
});

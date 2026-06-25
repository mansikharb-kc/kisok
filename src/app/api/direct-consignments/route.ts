import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const createDirectSchema = z.object({
  sellerName: z.string().trim().min(1, "Seller/Brand Name is required").max(150),
  brandName: z.string().trim().min(1).max(150),
  receivedDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  vehicleDetails: z.string().trim().min(1, "Vehicle Details is required").max(255),
  quantityReceived: z.number().int().nonnegative("Quantity must be non-negative"),
  boxQc: z.string().trim().max(100),
  photographUrl: z.string().trim().min(1, "Photograph Reference upload is required").max(255),
  packingListDoc: z.string().trim().min(1, "Packing List Document upload is required").max(255),
  remarks: z.string().trim().max(2000).optional().nullable(),
});

function branchOf(session: any, codes: string[]): bigint | null {
  const r = session.roles.find((x: any) => codes.includes(x.code) && x.branchId);
  return r?.branchId ? BigInt(r.branchId) : null;
}

async function nextDcNo(): Promise<string> {
  const existing = await prisma.directConsignment.findMany({
    where: { dcNo: { startsWith: "DC-" } },
    select: { dcNo: true },
  });
  let max = 0;
  for (const e of existing) {
    const n = parseInt((e.dcNo ?? "").split("-")[1] ?? "0", 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `DC-${String(max + 1).padStart(4, "0")}`;
}

export const POST = handler(async (req: Request) => {
  const session = await requireRole("CONSIGNMENT_USER");
  const branchId = branchOf(session, ["CONSIGNMENT_USER"]);
  if (!branchId) return fail("No active branch role found", 403);

  const parsed = createDirectSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const dcNo = await nextDcNo();
  const directConsignment = await prisma.$transaction(async (tx) => {
    const dc = await tx.directConsignment.create({
      data: {
        dcNo,
        branchId,
        sellerName: parsed.data.sellerName,
        brandName: parsed.data.brandName,
        receivedDate: new Date(parsed.data.receivedDate),
        vehicleDetails: parsed.data.vehicleDetails || null,
        quantityReceived: parsed.data.quantityReceived,
        boxQc: parsed.data.boxQc,
        photographUrl: parsed.data.photographUrl || null,
        packingListDoc: parsed.data.packingListDoc || null,
        remarks: parsed.data.remarks || null,
        status: "WITH_LEAD",
        raisedBy: BigInt(session.uid),
      },
    });

    return dc;
  });

  await writeAudit({
    actorUserId: session.uid,
    action: "direct_consignment.create",
    entityType: "DirectConsignment",
    entityId: directConsignment.id,
    after: { dcNo, sellerName: directConsignment.sellerName },
  });

  return ok({ directConsignment }, { status: 201 });
});

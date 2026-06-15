import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import QRCode from "qrcode";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const createSchema = z.object({
  localRecordId: z.coerce.bigint(),
  locationNodeId: z.coerce.bigint(),
  copies: z
    .array(
      z.object({
        sampleSizeId: z.coerce.bigint().optional().nullable(),
        role: z.enum(["MASTER", "SLAVE"]),
      }),
    )
    .min(1, "At least one copy is required")
    .max(200, "Too many copies in a single request"),
});

/** The OB exec's branch from their session role (OB_EXEC, branch-scoped). */
function execBranchId(roles: { code: string; branchId?: string | number | null }[]): bigint | null {
  const r = roles.find((x) => x.code === "OB_EXEC" && x.branchId);
  return r?.branchId ? BigInt(r.branchId) : null;
}

// ---------------------------------------------------------------------
// GET — list placed copies for the exec's branch + assigned sellers.
// ---------------------------------------------------------------------
export const GET = handler(async () => {
  const session = await requireRole("OB_EXEC", "ONB_LEAD");
  const uid = BigInt(session.uid);

  // Branch from whichever ops role carries a branch.
  const opsRole = session.roles.find(
    (r) => (r.code === "OB_EXEC" || r.code === "ONB_LEAD") && r.branchId,
  );
  const branchId = opsRole?.branchId ? BigInt(opsRole.branchId) : null;
  if (!branchId) return fail("No branch is associated with your account", 403);

  const isExec = session.roles.some((r) => r.code === "OB_EXEC");

  // OB_EXEC: only assigned sellers. ONB_LEAD: read-only over the whole branch.
  const recordFilter = isExec
    ? { branchId, seller: { assignments: { some: { obExecUserId: uid } } } }
    : { branchId };

  const copies = await prisma.productCopy.findMany({
    where: { branchId, record: recordFilter },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      instanceCode: true,
      sequenceNo: true,
      copyRole: true,
      availability: true,
      status: true,
      locationNodeId: true,
      product: { select: { name: true, sku: true, brand: { select: { name: true } } } },
      location: { select: { name: true, locationId: true, path: true } },
      size: { select: { label: true } },
      qr: { select: { url: true } },
      record: { select: { seller: { select: { name: true } } } },
    },
  });

  return ok({ copies });
});

// ---------------------------------------------------------------------
// POST — place N physical copies of an onboarded product.
// ---------------------------------------------------------------------
export const POST = handler(async (req: Request) => {
  const session = await requireRole("OB_EXEC");
  const uid = BigInt(session.uid);

  const branchId = execBranchId(session.roles);
  if (!branchId) return fail("No branch is associated with your account", 403);

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const { localRecordId, locationNodeId, copies } = parsed.data;

  // At most one MASTER in the request.
  const requestedMasters = copies.filter((c) => c.role === "MASTER").length;
  if (requestedMasters > 1) return fail("At most one copy may be marked MASTER", 422);

  // --- Validate the onboarding record: assigned seller + exec's branch. ---
  const record = await prisma.localOnboardingRecord.findUnique({
    where: { id: localRecordId },
    select: {
      id: true,
      brandProductId: true,
      branchId: true,
      seller: { select: { id: true, assignments: { where: { obExecUserId: uid }, select: { id: true } } } },
      product: { select: { sku: true, categoryId: true } },
    },
  });
  if (!record) return fail("Onboarding record not found", 404);
  if (String(record.branchId) !== String(branchId)) {
    return fail("Onboarding record is not in your branch", 403);
  }
  if (record.seller.assignments.length === 0) {
    return fail("This seller is not assigned to you", 403);
  }

  // --- Validate location: placement-eligible + in the exec's branch. ---
  const location = await prisma.locationNode.findUnique({
    where: { id: locationNodeId },
    select: { id: true, branchId: true, isPlacementEligible: true, status: true },
  });
  if (!location) return fail("Location not found", 404);
  if (String(location.branchId) !== String(branchId)) {
    return fail("Location is not in your branch", 403);
  }
  if (!location.isPlacementEligible) return fail("Location is not placement-eligible", 422);

  // --- Validate any provided sample sizes belong to the branch. ---
  const sampleSizeIds = Array.from(
    new Set(copies.map((c) => c.sampleSizeId).filter((v): v is bigint => v != null).map(String)),
  ).map((s) => BigInt(s));
  if (sampleSizeIds.length > 0) {
    const found = await prisma.sampleSize.findMany({
      where: { id: { in: sampleSizeIds }, branchId },
      select: { id: true },
    });
    if (found.length !== sampleSizeIds.length) {
      return fail("One or more sample sizes are invalid for your branch", 422);
    }
  }

  const brandProductId = record.brandProductId;

  // --- Single-master invariant. ---
  const existingMaster = await prisma.productCopy.findFirst({
    where: { brandProductId, branchId, copyRole: "MASTER" },
    select: { id: true },
  });
  const wantsMaster = requestedMasters === 1;
  // If a master already exists and the request does not designate a new one,
  // every new copy must be a SLAVE. If the request designates a new master,
  // we will demote the old one inside the transaction.
  const effectiveRoles = copies.map((c) =>
    c.role === "MASTER" && (wantsMaster ? true : false) ? "MASTER" : "SLAVE",
  );

  // --- Branch code + next sequence per (brandProduct, branch). ---
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { branchCode: true },
  });
  const branchCode = branch?.branchCode ?? `B${branchId}`;

  const lastCopy = await prisma.productCopy.findFirst({
    where: { brandProductId, branchId },
    orderBy: { sequenceNo: "desc" },
    select: { sequenceNo: true },
  });
  let nextSeq = (lastCopy?.sequenceNo ?? 0) + 1;

  // --- Find a sticker template for the product's category (optional). ---
  const stickerTemplate = await prisma.stickerTemplate.findFirst({
    where: { categoryId: record.product.categoryId, status: "active" },
    select: { id: true },
  });

  // --- Build per-copy plan + generate QR PNGs (file writes BEFORE the txn). ---
  const dir = join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });

  const plan: {
    sequenceNo: number;
    instanceCode: string;
    copyRole: string;
    sampleSizeId: bigint | null;
    qrUrl: string;
    qrSizeBytes: number;
  }[] = [];

  for (let i = 0; i < copies.length; i++) {
    const sequenceNo = nextSeq++;
    const padded = String(sequenceNo).padStart(4, "0");
    const instanceCode = `${record.product.sku}-${branchCode}-${padded}`;

    const buf = await QRCode.toBuffer(instanceCode, { width: 256 });
    const fileName = `${randomUUID()}.png`;
    await writeFile(join(dir, fileName), buf);

    plan.push({
      sequenceNo,
      instanceCode,
      copyRole: effectiveRoles[i],
      sampleSizeId: copies[i].sampleSizeId ?? null,
      qrUrl: `/uploads/${fileName}`,
      qrSizeBytes: buf.length,
    });
  }

  // --- Persist everything atomically. ---
  const created = await prisma.$transaction(async (tx) => {
    // Demote the previous master if this request designates a new one.
    if (wantsMaster && existingMaster) {
      await tx.productCopy.update({
        where: { id: existingMaster.id },
        data: { copyRole: "SLAVE" },
      });
    }

    const createdCopies = [];
    for (const p of plan) {
      const media = await tx.media.create({
        data: {
          type: "qr",
          url: p.qrUrl,
          mime: "image/png",
          sizeBytes: BigInt(p.qrSizeBytes),
          uploadedBy: uid,
        },
      });

      const copy = await tx.productCopy.create({
        data: {
          localRecordId,
          brandProductId,
          branchId,
          sequenceNo: p.sequenceNo,
          instanceCode: p.instanceCode,
          copyRole: p.copyRole,
          sampleSizeId: p.sampleSizeId,
          locationNodeId,
          qrMediaId: media.id,
          availability: "IN",
          status: "active",
        },
        select: { id: true, instanceCode: true, copyRole: true },
      });

      if (stickerTemplate) {
        await tx.sticker.create({
          data: {
            productCopyId: copy.id,
            templateId: stickerTemplate.id,
            status: "pending",
          },
        });
      }

      createdCopies.push(copy);
    }

    return createdCopies;
  });

  await writeAudit({
    actorUserId: session.uid,
    action: "placement.create",
    entityType: "ProductCopy",
    entityId: created[0]?.id,
    after: {
      localRecordId: String(localRecordId),
      locationNodeId: String(locationNodeId),
      count: created.length,
      instanceCodes: created.map((c) => c.instanceCode),
      masterDemoted: Boolean(wantsMaster && existingMaster),
    },
  });

  return ok({ copies: created, count: created.length }, { status: 201 });
});

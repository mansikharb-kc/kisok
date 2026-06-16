import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const dateish = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable();

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

// Global sequential codes (SLR-0001 / MEM-0001).
async function nextSeq(field: "sellerCode" | "membershipId", prefix: string): Promise<string> {
  const rows = await prisma.seller.findMany({
    where: { [field]: { startsWith: prefix } } as never,
    select: { [field]: true } as never,
  });
  let max = 0;
  for (const r of rows as Array<Record<string, string | null>>) {
    const n = parseInt((r[field] ?? "").split("-")[1] ?? "0", 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

const schema = z
  .object({
    branchId: z.coerce.bigint(),
    // Program: link existing OR create new
    programId: z.coerce.bigint().optional().nullable(),
    programName: z.string().trim().max(150).optional().nullable(),
    programCode: z.string().trim().max(60).regex(/^[A-Za-z0-9_-]+$/).optional().nullable(),
    // Seller / collaboration
    collaboration: z.string().trim().min(1).max(150),
    membershipId: z.string().trim().max(60).optional().nullable(),
    memberType: z.string().trim().max(40).optional().nullable(),
    salesperson: z.string().trim().max(120).optional().nullable(),
    spocName: z.string().trim().max(120).optional().nullable(),
    spocPhone: z.string().trim().max(30).optional().nullable(),
    spocEmail: z.string().trim().max(150).optional().nullable(),
    categoryIds: z.array(z.coerce.bigint()).optional().default([]),
    // Contract
    contractStart: dateish,
    contractEnd: dateish,
    fitoutPeriod: z.string().trim().max(60).optional().nullable(),
    collaborationTenure: z.string().trim().max(60).optional().nullable(),
    // HO-defined custom fields { code: value }
    customFields: z.record(z.string(), z.any()).optional().nullable(),
  })
  .refine((d) => d.programId || (d.programName && d.programCode), {
    message: "Pick an existing program or provide a new program name + code",
  });

export const POST = handler(async (req: Request) => {
  const session = await requireRole("HO_ADMIN");
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  const d = parsed.data;

  // Resolve branch
  const branch = await prisma.branch.findUnique({ where: { id: d.branchId } });
  if (!branch) return fail("Branch not found", 422);

  // Resolve / create program master
  let programId = d.programId ?? null;
  if (!programId) {
    const existingCode = await prisma.program.findUnique({ where: { code: d.programCode! } });
    if (existingCode) return fail("A program with this code already exists — pick it instead.", 409);
  }

  // Membership ID: provided (unique) or auto.
  let membershipId = d.membershipId?.trim() || null;
  if (membershipId) {
    const dup = await prisma.seller.findUnique({ where: { membershipId } });
    if (dup) return fail("Membership ID must be unique.", 409);
  } else {
    membershipId = await nextSeq("membershipId", "MEM-");
  }

  const sellerCode = await nextSeq("sellerCode", "SLR-");

  const result = await prisma.$transaction(async (tx) => {
    if (!programId) {
      const program = await tx.program.create({
        data: { name: d.programName!, code: d.programCode! },
      });
      programId = program.id;
    }

    const seller = await tx.seller.create({
      data: {
        branchId: d.branchId,
        name: d.collaboration,
        sellerCode,
        membershipId,
        memberType: d.memberType ?? null,
        salesperson: d.salesperson ?? null,
        spocName: d.spocName ?? null,
        spocPhone: d.spocPhone ?? null,
        spocEmail: d.spocEmail ?? null,
        sellerCategories: {
          create: d.categoryIds.map((categoryId) => ({ categoryId })),
        },
        contracts: {
          create: [
            {
              programId: programId!,
              contractStart: d.contractStart ? new Date(d.contractStart) : null,
              contractEnd: d.contractEnd ? new Date(d.contractEnd) : null,
              fitoutPeriod: d.fitoutPeriod ?? null,
              collaborationTenure: d.collaborationTenure ?? null,
              customFields: d.customFields ?? undefined,
            },
          ],
        },
      },
    });

    // Ensure the program is enabled for this branch.
    await tx.branchProgram.upsert({
      where: { branchId_programId: { branchId: d.branchId, programId: programId! } },
      create: { branchId: d.branchId, programId: programId!, approvalStatus: "approved" },
      update: {},
    });

    return seller;
  });

  await writeAudit({
    actorUserId: session.uid,
    action: "collaboration.create",
    entityType: "Seller",
    entityId: result.id,
    after: { name: result.name, sellerCode: result.sellerCode, branchId: d.branchId.toString() },
  });

  return ok({ seller: result, sellerId: result.id.toString() }, { status: 201 });
});

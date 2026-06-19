import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// Accept both the task-spec shape ({ decision }) and the legacy shape
// ({ status }) so existing callers keep working.
const decideSchema = z
  .object({
    decision: z.enum(["approved", "rejected"]).optional(),
    status: z.enum(["approved", "rejected"]).optional(),
    reason: z.string().trim().max(500).optional().nullable(),
  })
  .refine((v) => Boolean(v.decision || v.status), {
    message: "decision is required",
  });

async function decide(req: Request, ctx: { params: { id: string } }): Promise<NextResponse> {
  const session = await requireRole("HO_ADMIN");

  let requestId: bigint;
  try {
    requestId = BigInt(ctx.params.id);
  } catch {
    return fail("Invalid id", 400);
  }

  const body = await req.json().catch(() => null);
  const parsed = decideSchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const decision = (parsed.data.decision ?? parsed.data.status) as "approved" | "rejected";
  const reason = parsed.data.reason ?? null;

  const request = await prisma.changeRequest.findUnique({ where: { id: requestId } });
  if (!request) return fail("Change request not found", 404);
  if (request.status !== "pending") return fail("This request is already decided.", 400);

  const updated = await prisma.$transaction(async (tx) => {
    // Apply the type-specific side effect.
    if (request.type === "BRANCH_PROGRAM") {
      const payload = request.payload as { branchId?: string; programId?: string } | null;
      if (payload?.branchId && payload?.programId) {
        await tx.branchProgram.update({
          where: {
            branchId_programId: {
              branchId: BigInt(payload.branchId),
              programId: BigInt(payload.programId),
            },
          },
          data: { approvalStatus: decision },
        });
      }
    }

    // On approval, materialize the requested master record.
    if (decision === "approved" && request.type === "NEW_CATEGORY") {
      const p = request.payload as { name?: string; code?: string; parentId?: string | null } | null;
      if (p?.name && p?.code) {
        // ensure unique code
        let code = p.code;
        let k = 2;
        while (await tx.category.findUnique({ where: { code } })) code = `${p.code}-${k++}`;
        await tx.category.create({
          data: { name: p.name, code, parentId: p.parentId ? BigInt(p.parentId) : null, status: "active" },
        });
      }
    }

    if (decision === "approved" && request.type === "NEW_ATTRIBUTE") {
      const p = request.payload as {
        name?: string; code?: string; dataType?: string; unit?: string | null;
        sectionGroup?: string | null; isVariant?: boolean; isPriceable?: boolean;
        isRequired?: boolean; options?: string[];
      } | null;
      if (p?.name && p?.code && p?.dataType) {
        let code = p.code;
        let k = 2;
        while (await tx.attribute.findUnique({ where: { code } })) code = `${p.code}-${k++}`;
        await tx.attribute.create({
          data: {
            name: p.name,
            code,
            dataType: p.dataType,
            unit: p.unit || null,
            sectionGroup: p.sectionGroup || null,
            isVariant: p.isVariant ?? false,
            isPriceable: p.isPriceable ?? false,
            isRequired: p.isRequired ?? false,
            status: "active",
            options:
              p.dataType === "enum" && p.options?.length
                ? { create: p.options.map((v, i) => ({ optionValue: v, displayOrder: i })) }
                : undefined,
          },
        });
      }
    }

    if (request.type === "NEW_BRAND") {
      const p = request.payload as { brandId?: string } | null;
      if (p?.brandId) {
        await tx.brand.update({
          where: { id: BigInt(p.brandId) },
          data: {
            approvalStatus: decision,
            status: decision === "approved" ? "active" : "inactive",
          },
        });
      }
    }

    if (decision === "approved" && request.type === "NEW_PROGRAM") {
      const p = request.payload as { name?: string; remarks?: string } | null;
      if (p?.name) {
        let code = slugify(p.name);
        let k = 2;
        while (await tx.program.findUnique({ where: { code } })) {
          code = `${slugify(p.name)}-${k++}`;
        }
        
        const newProg = await tx.program.create({
          data: { name: p.name, code, status: "active" },
        });

        if (request.branchId) {
          await tx.branchProgram.create({
            data: {
              branchId: request.branchId,
              programId: newProg.id,
              approvalStatus: "approved",
            },
          });
        }
      }
    }

    return tx.changeRequest.update({
      where: { id: requestId },
      data: {
        status: decision,
        decidedBy: BigInt(session.uid),
        decidedAt: new Date(),
        reason,
      },
    });
  });

  await writeAudit({
    actorUserId: session.uid,
    action: `changerequest.${decision}`,
    entityType: "ChangeRequest",
    entityId: updated.id,
    before: { status: request.status },
    after: { status: updated.status, reason: updated.reason },
  });

  return ok({ request: updated });
}

export const PATCH = handler(decide);
// Backwards-compatible alias for existing callers using PUT.
export const PUT = handler(decide);

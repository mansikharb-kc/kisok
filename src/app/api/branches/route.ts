import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  branchCode: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/, "branchCode: letters, numbers, - and _ only"),
  city: z.string().trim().max(120).optional().nullable(),
  address: z.string().trim().max(255).optional().nullable(),
  status: z.enum(["active", "inactive"]).optional(),
});

export const GET = handler(async () => {
  await requireRole("HO_ADMIN");
  const branches = await prisma.branch.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          branchPrograms: true,
          branchBrands: true,
          locationNodes: true,
          sampleSizes: true,
          sellers: true,
          localRecords: true,
          productCopies: true,
          screens: true,
          userRoles: true,
        },
      },
    },
  });
  return ok({ branches });
});

export const POST = handler(async (req: Request) => {
  const session = await requireRole("HO_ADMIN");
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const data = parsed.data;
  const branch = await prisma.branch.create({
    data: {
      name: data.name,
      branchCode: data.branchCode,
      city: data.city ?? null,
      address: data.address ?? null,
      status: data.status ?? "active",
    },
  });

  await writeAudit({
    actorUserId: session.uid,
    action: "branch.create",
    entityType: "Branch",
    entityId: branch.id,
    after: { name: branch.name, branchCode: branch.branchCode, status: branch.status },
  });

  return ok({ branch }, { status: 201 });
});
// RMS screens API — Branch Admin / Screen Manager create + list screens for THEIR branch. Phase: P1.1
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";

// Resolve the branch this user manages screens for (Branch Admin or Screen Manager).
function branchIdFor(roles: { code: string; branchId: string | null }[]): bigint | null {
  const r = roles.find(
    (x) => (x.code === "BRANCH_ADMIN" || x.code === "SCREEN_MANAGER") && x.branchId
  );
  return r?.branchId ? BigInt(r.branchId) : null;
}

const createSchema = z.object({
  name: z.string().trim().max(120).optional().nullable(),
  viewDefault: z.enum(["LOCAL", "GLOBAL"]).optional(),
});

export const GET = handler(async () => {
  const session = await requireRole("BRANCH_ADMIN", "SCREEN_MANAGER");
  const branchId = branchIdFor(session.roles);
  if (!branchId) return fail("No branch scope for this user", 403);

  const [screens, blocks] = await Promise.all([
    prisma.screen.findMany({
      where: { branchId },
      orderBy: { createdAt: "desc" },
      include: { location: { select: { name: true, code: true, path: true } } },
    }),
    prisma.locationNode.findMany({
      where: { branchId, nodeType: "BLOCK", status: "active" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
  ]);
  return ok({ screens, blocks });
});

export const POST = handler(async (req: Request) => {
  const session = await requireRole("BRANCH_ADMIN", "SCREEN_MANAGER");
  const branchId = branchIdFor(session.roles);
  if (!branchId) return fail("No branch scope for this user", 403);

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  // Create an UNBOUND screen (name only). It is mapped to a block later on the Blocks page.
  const token = randomBytes(24).toString("base64url");
  const screen = await prisma.screen.create({
    data: {
      branchId,
      name: parsed.data.name ?? null,
      viewDefault: parsed.data.viewDefault ?? "LOCAL",
      token,
    },
  });
  return ok({ screen }, { status: 201 });
});

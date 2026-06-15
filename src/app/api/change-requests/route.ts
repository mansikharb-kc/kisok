import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const createRequestSchema = z.object({
  type: z.enum([
    "NEW_CATEGORY",
    "NEW_ATTRIBUTE",
    "NEW_PRODUCT_TYPE",
    "EDIT_MASTER_FIELD",
    "BRANCH_PROGRAM",
    "OTHER",
  ]),
  payload: z.any(),
  branchId: z.string().nullable().optional(),
});

export const GET = handler(async () => {
  const session = await requireRole("HO_ADMIN", "BRANCH_ADMIN");
  const isHo = session.roles.some((r) => r.code === "HO_ADMIN");

  const adminBranchIds = session.roles
    .filter((r) => r.code === "BRANCH_ADMIN")
    .map((r) => (r.branchId ? BigInt(r.branchId) : null))
    .filter(Boolean) as bigint[];

  let requests;

  // Pending first, then most recent. MySQL sorts "pending" after "approved"/
  // "rejected" alphabetically, so we approximate pending-first by ordering on a
  // computed flag in JS after fetching (status set is tiny and bounded).
  if (isHo) {
    // HO Admin sees all requests
    requests = await prisma.changeRequest.findMany({
      orderBy: { createdAt: "desc" },
    });
  } else {
    // Branch Admin sees their branch's requests
    requests = await prisma.changeRequest.findMany({
      where: {
        branchId: { in: adminBranchIds },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // Stable pending-first ordering (createdAt desc preserved within each group).
  requests = [...requests].sort((a, b) => {
    const ap = a.status === "pending" ? 0 : 1;
    const bp = b.status === "pending" ? 0 : 1;
    return ap - bp;
  });

  // Manually fetch requestor names to join since relation is not defined in schema
  const userIds = [...new Set(requests.map((r) => r.requestedBy).filter(Boolean) as bigint[])];
  const branchIds = [...new Set(requests.map((r) => r.branchId).filter(Boolean) as bigint[])];

  const [users, branches] = await Promise.all([
    userIds.length
      ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true } })
      : [],
    branchIds.length
      ? prisma.branch.findMany({ where: { id: { in: branchIds } }, select: { id: true, name: true } })
      : [],
  ]);

  const userMap = new Map(users.map((u) => [u.id.toString(), u.fullName]));
  const branchMap = new Map(branches.map((b) => [b.id.toString(), b.name]));

  const enriched = requests.map((r) => ({
    id: r.id.toString(),
    type: r.type,
    payload: r.payload,
    branchId: r.branchId?.toString() ?? null,
    branchName: r.branchId ? branchMap.get(r.branchId.toString()) ?? "Unknown Branch" : null,
    requestedBy: r.requestedBy?.toString() ?? null,
    requestedByName: r.requestedBy ? userMap.get(r.requestedBy.toString()) ?? "Someone" : "System",
    status: r.status,
    decidedBy: r.decidedBy?.toString() ?? null,
    decidedAt: r.decidedAt,
    reason: r.reason,
    createdAt: r.createdAt,
  }));

  return ok({ requests: enriched });
});

export const POST = handler(async (req: Request) => {
  const session = await requireRole("HO_ADMIN", "BRANCH_ADMIN");
  const body = await req.json().catch(() => null);
  const parsed = createRequestSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  }

  const data = parsed.data;

  const request = await prisma.changeRequest.create({
    data: {
      type: data.type,
      payload: data.payload as object,
      branchId: data.branchId ? BigInt(data.branchId) : null,
      requestedBy: BigInt(session.uid),
      status: "pending",
    },
  });

  await writeAudit({
    actorUserId: session.uid,
    action: "change_request.create",
    entityType: "ChangeRequest",
    entityId: request.id,
    after: { type: request.type, status: request.status },
  });

  return ok({ request }, { status: 201 });
});

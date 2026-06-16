import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const createUserSchema = z.object({
  fullName: z.string().trim().min(1).max(150),
  email: z.string().trim().email().max(190),
  username: z.string().trim().min(1).max(60).optional().nullable(),
  phone: z.string().trim().max(20).optional().nullable(),
  password: z.string().min(4),
  status: z.enum(["active", "disabled"]).optional().default("active"),
  roles: z.array(
    z.object({
      roleId: z.string(),
      branchId: z.string().nullable().optional(),
    }),
  ),
});

export const GET = handler(async () => {
  const session = await requireRole("HO_ADMIN", "BRANCH_ADMIN", "ONB_LEAD");
  const isHo = session.roles.some((r) => r.code === "HO_ADMIN");

  const adminBranchIds = session.roles
    .filter((r) => r.code === "BRANCH_ADMIN" || r.code === "ONB_LEAD")
    .map((r) => (r.branchId ? BigInt(r.branchId) : null))
    .filter(Boolean) as bigint[];

  let users;

  if (isHo) {
    // HO Admin can see all users
    users = await prisma.user.findMany({
      orderBy: { fullName: "asc" },
      include: {
        roles: {
          include: {
            role: true,
            branch: true,
          },
        },
      },
    });
  } else {
    // Branch Admin can only see users who have roles in their branches
    users = await prisma.user.findMany({
      where: {
        roles: {
          some: {
            branchId: { in: adminBranchIds },
          },
        },
      },
      orderBy: { fullName: "asc" },
      include: {
        roles: {
          include: {
            role: true,
            branch: true,
          },
        },
      },
    });

    // Filter roles of users to only show the ones belonging to this branch
    users = users.map((u) => {
      return {
        ...u,
        roles: u.roles.filter((r) => r.branchId && adminBranchIds.includes(r.branchId)),
      };
    });
  }

  return ok({ users });
});

export const POST = handler(async (req: Request) => {
  const session = await requireRole("HO_ADMIN", "BRANCH_ADMIN");
  const isHo = session.roles.some((r) => r.code === "HO_ADMIN");

  const adminBranchIds = session.roles
    .filter((r) => r.code === "BRANCH_ADMIN")
    .map((r) => (r.branchId ? BigInt(r.branchId) : null))
    .filter(Boolean) as bigint[];

  const body = await req.json().catch(() => null);
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  }

  const data = parsed.data;

  // Check role assignment permissions
  if (data.roles.length === 0) {
    return fail("At least one role assignment is required.", 422);
  }

  const requestedRoleIds = data.roles.map((r) => BigInt(r.roleId));
  const rolesInDb = await prisma.role.findMany({
    where: { id: { in: requestedRoleIds } },
  });

  const rolesMap = new Map(rolesInDb.map((r) => [r.id.toString(), r]));

  for (const item of data.roles) {
    const role = rolesMap.get(item.roleId);
    if (!role) {
      return fail(`Role with ID ${item.roleId} does not exist.`, 422);
    }

    if (!isHo) {
      // Branch Admin checks:
      // 1. Cannot assign HO_ADMIN role
      if (role.code === "HO_ADMIN") {
        return fail("Branch Admins cannot assign the HO Admin role.", 403);
      }
      // 2. Must scope assignment to their branch
      if (!item.branchId) {
        return fail(`Branch-scoped assignment is required for role ${role.name}.`, 403);
      }
      const bId = BigInt(item.branchId);
      if (!adminBranchIds.includes(bId)) {
        return fail(`You are not authorized to assign roles for branch ID ${item.branchId}.`, 403);
      }
    }
  }

  // Check unique email
  const existing = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase() },
  });
  if (existing) {
    return fail("A user with this email address already exists.", 409);
  }

  // Check unique username
  if (data.username) {
    const existingUsername = await prisma.user.findUnique({
      where: { username: data.username.toLowerCase() },
    });
    if (existingUsername) {
      return fail("A user with this username already exists.", 409);
    }
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  // Create user and assignments in a transaction
  const user = await prisma.user.create({
    data: {
      fullName: data.fullName,
      email: data.email.toLowerCase(),
      username: data.username ? data.username.toLowerCase() : null,
      phone: data.phone ?? null,
      passwordHash,
      status: data.status,
      roles: {
        create: data.roles.map((r) => ({
          roleId: BigInt(r.roleId),
          branchId: r.branchId ? BigInt(r.branchId) : null,
        })),
      },
    },
    include: {
      roles: {
        include: {
          role: true,
          branch: true,
        },
      },
    },
  });

  await writeAudit({
    actorUserId: session.uid,
    action: "user.create",
    entityType: "User",
    entityId: user.id,
    after: {
      fullName: user.fullName,
      email: user.email,
      status: user.status,
      rolesCount: user.roles.length,
    },
  });

  return ok({ user }, { status: 201 });
});

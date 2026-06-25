import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const updateUserSchema = z.object({
  fullName: z.string().trim().min(1).max(150),
  email: z.string().trim().email().max(190),
  username: z.string().trim().min(1).max(60).optional().nullable(),
  phone: z.string().trim().max(20).optional().nullable(),
  password: z.string().min(4).optional(),
  status: z.enum(["active", "disabled"]),
  avatarUrl: z.string().trim().max(512).optional().nullable(),
  roles: z.array(
    z.object({
      roleId: z.string(),
      branchId: z.string().nullable().optional(),
    }),
  ),
});

export const GET = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireRole("HO_ADMIN", "BRANCH_ADMIN");
  const isHo = session.roles.some((r) => r.code === "HO_ADMIN");

  const { id } = await params;
  const userId = BigInt(id);

  const adminBranchIds = session.roles
    .filter((r) => r.code === "BRANCH_ADMIN")
    .map((r) => (r.branchId ? BigInt(r.branchId) : null))
    .filter(Boolean) as bigint[];

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: {
        include: {
          role: true,
          branch: true,
        },
      },
    },
  });

  if (!user) return fail("User not found", 404);

  if (!isHo) {
    // Branch Admin can only view if user has roles in their branch
    const hasBranchRole = user.roles.some(
      (r) => r.branchId && adminBranchIds.includes(r.branchId),
    );
    if (!hasBranchRole) return fail("Forbidden", 403);

    // Filter roles for privacy
    user.roles = user.roles.filter(
      (r) => r.branchId && adminBranchIds.includes(r.branchId),
    );
  }

  return ok({ user });
});

export const PUT = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireRole("HO_ADMIN", "BRANCH_ADMIN");
  const isHo = session.roles.some((r) => r.code === "HO_ADMIN");

  const { id } = await params;
  const userId = BigInt(id);

  const adminBranchIds = session.roles
    .filter((r) => r.code === "BRANCH_ADMIN")
    .map((r) => (r.branchId ? BigInt(r.branchId) : null))
    .filter(Boolean) as bigint[];

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: { include: { role: true } } },
  });

  if (!targetUser) return fail("User not found", 404);

  if (!isHo) {
    // Must manage the user in their branch
    const hasBranchRole = targetUser.roles.some(
      (r) => r.branchId && adminBranchIds.includes(r.branchId),
    );
    if (!hasBranchRole) return fail("Forbidden", 403);
  }

  const body = await req.json().catch(() => null);
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  }

  const data = parsed.data;

  // Check unique email (if email is changing)
  if (data.email.toLowerCase() !== targetUser.email.toLowerCase()) {
    const existing = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });
    if (existing) return fail("A user with this email address already exists.", 409);
  }

  // Check unique username (if username is changing)
  if (data.username && data.username.toLowerCase() !== (targetUser.username || "").toLowerCase()) {
    const existingUsername = await prisma.user.findUnique({
      where: { username: data.username.toLowerCase() },
    });
    if (existingUsername) return fail("A user with this username already exists.", 409);
  }

  // Verify and process roles
  const requestedRoleIds = data.roles.map((r) => BigInt(r.roleId));
  const rolesInDb = await prisma.role.findMany({
    where: { id: { in: requestedRoleIds } },
  });

  const rolesMap = new Map(rolesInDb.map((r) => [r.id.toString(), r]));

  // Validate the incoming role changes
  for (const item of data.roles) {
    const role = rolesMap.get(item.roleId);
    if (!role) return fail(`Role with ID ${item.roleId} does not exist.`, 422);

    if (!isHo) {
      if (role.code === "HO_ADMIN") {
        return fail("Branch Admins cannot assign the HO Admin role.", 403);
      }
      if (!item.branchId) {
        return fail(`Branch-scoped assignment is required for role ${role.name}.`, 403);
      }
      const bId = BigInt(item.branchId);
      if (!adminBranchIds.includes(bId)) {
        return fail(`You are not authorized to assign roles for branch ID ${item.branchId}.`, 403);
      }
    }
  }

  // Calculate final role assignments
  let finalRolesCreate: { roleId: bigint; branchId: bigint | null }[] = [];
  let deleteWhereClause: { id?: bigint; roleId?: bigint; branchId?: bigint | null } = {};

  if (isHo) {
    // HO Admin can replace all roles
    finalRolesCreate = data.roles.map((r) => ({
      roleId: BigInt(r.roleId),
      branchId: r.branchId ? BigInt(r.branchId) : null,
    }));
  } else {
    // Branch Admin preserves roles belonging to other branches
    const otherBranchRoles = targetUser.roles.filter(
      (r) => !r.branchId || !adminBranchIds.includes(r.branchId),
    );

    // Roles to keep
    const preservedRoles = otherBranchRoles.map((r) => ({
      roleId: r.roleId,
      branchId: r.branchId,
    }));

    // New roles to add (from local branch inputs)
    const newBranchRoles = data.roles.map((r) => ({
      roleId: BigInt(r.roleId),
      branchId: r.branchId ? BigInt(r.branchId) : null,
    }));

    finalRolesCreate = [...preservedRoles, ...newBranchRoles];
  }

  const updateData: {
    fullName: string;
    email: string;
    username: string | null;
    phone: string | null;
    status: string;
    avatarUrl?: string | null;
    passwordHash?: string;
  } = {
    fullName: data.fullName,
    email: data.email.toLowerCase(),
    username: data.username ? data.username.toLowerCase() : null,
    phone: data.phone ?? null,
    status: data.status,
    avatarUrl: data.avatarUrl ?? null,
  };

  if (data.password) {
    updateData.passwordHash = await bcrypt.hash(data.password, 10);
  }

  // Perform updates in a transaction
  const updatedUser = await prisma.$transaction(async (tx) => {
    // 1. Delete all existing user role mappings
    await tx.userRole.deleteMany({
      where: { userId },
    });

    // 2. Re-create merged mappings
    await tx.userRole.createMany({
      data: finalRolesCreate.map((r) => ({
        userId,
        roleId: r.roleId,
        branchId: r.branchId,
      })),
    });

    // 3. Update core user details
    return tx.user.update({
      where: { id: userId },
      data: updateData,
      include: {
        roles: {
          include: {
            role: true,
            branch: true,
          },
        },
      },
    });
  });

  await writeAudit({
    actorUserId: session.uid,
    action: "user.update",
    entityType: "User",
    entityId: updatedUser.id,
    before: {
      fullName: targetUser.fullName,
      email: targetUser.email,
      status: targetUser.status,
      rolesCount: targetUser.roles.length,
      avatarUrl: targetUser.avatarUrl,
    },
    after: {
      fullName: updatedUser.fullName,
      email: updatedUser.email,
      status: updatedUser.status,
      rolesCount: updatedUser.roles.length,
      avatarUrl: updatedUser.avatarUrl,
    },
  });

  return ok({ user: updatedUser });
});

export const DELETE = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireRole("HO_ADMIN", "BRANCH_ADMIN");
  const isHo = session.roles.some((r) => r.code === "HO_ADMIN");

  const { id } = await params;
  const userId = BigInt(id);

  const adminBranchIds = session.roles
    .filter((r) => r.code === "BRANCH_ADMIN")
    .map((r) => (r.branchId ? BigInt(r.branchId) : null))
    .filter(Boolean) as bigint[];

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: true },
  });

  if (!user) return fail("User not found", 404);

  if (isHo) {
    // Delete user completely
    await prisma.user.delete({ where: { id: userId } });

    await writeAudit({
      actorUserId: session.uid,
      action: "user.delete",
      entityType: "User",
      entityId: userId,
      before: { fullName: user.fullName, email: user.email },
    });
  } else {
    // Branch Admin only deletes roles related to their branches
    const hasBranchRole = user.roles.some(
      (r) => r.branchId && adminBranchIds.includes(r.branchId),
    );
    if (!hasBranchRole) return fail("Forbidden", 403);

    // Delete mappings for these branches
    await prisma.userRole.deleteMany({
      where: {
        userId,
        branchId: { in: adminBranchIds },
      },
    });

    // Check if the user is left with other roles
    const remainingRolesCount = await prisma.userRole.count({
      where: { userId },
    });

    if (remainingRolesCount === 0) {
      // Disassociate or delete user completely since they have no roles left
      await prisma.user.delete({ where: { id: userId } });
    }

    await writeAudit({
      actorUserId: session.uid,
      action: "user.delete_branch_roles",
      entityType: "User",
      entityId: userId,
      before: {
        fullName: user.fullName,
        email: user.email,
        deletedBranchIds: adminBranchIds.map((b) => b.toString()),
      },
    });
  }

  return ok({ ok: true });
});

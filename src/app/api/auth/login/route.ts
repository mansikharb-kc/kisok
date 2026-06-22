import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signSession, setSessionCookie } from "@/lib/auth";
import type { RoleCode } from "@/lib/rbac";
import { ok, fail, handler } from "@/lib/api";

const schema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
});

export const POST = handler(async (req: Request) => {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("Username/Email and password required", 422);

  const { email, password } = parsed.data;

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email },
        { username: email }
      ]
    },
    include: { roles: { include: { role: true } } },
  });

  if (!user || user.status !== "active") return fail("Invalid credentials", 401);

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return fail("Invalid credentials", 401);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const roles = user.roles.map((ur) => ({
    code: ur.role.code as RoleCode,
    branchId: ur.branchId ? ur.branchId.toString() : null,
  }));

  const sessionLog = await prisma.userSessionLog.create({
    data: {
      userId: user.id,
      username: user.username || user.email,
      fullName: user.fullName,
      role: roles[0]?.code || "unknown",
    },
  });

  const token = await signSession({
    uid: user.id.toString(),
    email: user.email,
    name: user.fullName,
    roles,
    sessionLogId: sessionLog.id.toString(),
  });
  await setSessionCookie(token);

  return ok({ ok: true, name: user.fullName, roles });
});

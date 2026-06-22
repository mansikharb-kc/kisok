import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, handler } from "@/lib/api";

const schema = z.object({
  emailOrUsername: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  newPassword: z.string().min(4).optional().nullable(),
});

export const POST = handler(async (req: Request) => {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const { emailOrUsername, phone, newPassword } = parsed.data;

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: emailOrUsername },
        { username: emailOrUsername }
      ]
    }
  });

  if (!user) return fail("User not found", 404);

  // Normalise phone numbers for robust verification
  const dbPhone = user.phone ? user.phone.replace(/[^0-9]/g, "") : "";
  const inputPhone = phone.replace(/[^0-9]/g, "");

  if (dbPhone !== inputPhone) {
    return fail("Incorrect registered phone number verification", 400);
  }

  // Verification step (no new password provided)
  if (!newPassword) {
    return ok({ verified: true, message: "Identity verified successfully" });
  }

  // Hash new password using bcrypt
  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  return ok({ ok: true, message: "Password reset successful" });
});

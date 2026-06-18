import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { serialize } from "@/lib/prisma";

const patchSchema = z.object({
  status: z.enum(["pending", "dismissed"]),
});

export const PATCH = handler(async (req: Request, ctx: { params: { id: string } }) => {
  const session = await requireRole("OB_EXEC", "ONB_LEAD");
  
  let reminderId: bigint;
  try {
    reminderId = BigInt(ctx.params.id);
  } catch {
    return fail("Invalid reminder ID", 400);
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  }

  const { status } = parsed.data;

  // Find the reminder
  const reminder = await prisma.reminder.findUnique({
    where: { id: reminderId },
  });
  if (!reminder) {
    return fail("Reminder not found", 404);
  }

  // If OB_EXEC, check ownership
  const isExec = session.roles.some((r) => r.code === "OB_EXEC");
  if (isExec && reminder.userId !== BigInt(session.uid)) {
    return fail("Not authorized to modify this reminder", 403);
  }

  const updated = await prisma.reminder.update({
    where: { id: reminderId },
    data: { status },
  });

  return ok({ reminder: serialize(updated) });
});

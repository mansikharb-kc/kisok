import { clearSessionCookie, getSession } from "@/lib/auth";
import { ok, handler } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const POST = handler(async (req: Request) => {
  const session = await getSession();
  let logoutType = "manual";

  try {
    const body = await req.json().catch(() => null);
    if (body && (body.type === "timeout" || body.type === "manual")) {
      logoutType = body.type;
    }
  } catch (e) {
    // Ignore body parsing issues
  }

  if (session?.sessionLogId) {
    try {
      await prisma.userSessionLog.update({
        where: { id: BigInt(session.sessionLogId) },
        data: {
          logoutTime: new Date(),
          logoutType: logoutType,
        },
      });
    } catch (e) {
      console.error("Failed to update UserSessionLog on logout:", e);
    }
  }

  clearSessionCookie();
  return ok({ ok: true });
});

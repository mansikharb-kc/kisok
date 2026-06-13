import { getSession } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";

export const GET = handler(async () => {
  const session = await getSession();
  if (!session) return fail("Unauthorized", 401);
  return ok({ session });
});

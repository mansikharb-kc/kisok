import { redirect } from "next/navigation";
import { getSession } from "./auth";
import type { RoleCode } from "./rbac";

/**
 * Page-level role guard for server components.
 * Redirects to /login if not authenticated, or /dashboard if the user
 * doesn't hold one of the allowed roles. Returns the session otherwise.
 */
export async function requirePageRole(...codes: RoleCode[]) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (codes.length && !session.roles.some((r) => codes.includes(r.code))) {
    redirect("/dashboard");
  }
  return session;
}

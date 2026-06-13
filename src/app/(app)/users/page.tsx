import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function UsersPageRedirect() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const roleCodes = session.roles.map((r: { code: string }) => r.code);

  if (roleCodes.includes("HO_ADMIN")) {
    redirect("/users/role/ho-admin");
  }

  if (roleCodes.includes("BRANCH_ADMIN")) {
    redirect("/users/role/onb-lead");
  }

  redirect("/dashboard");
}

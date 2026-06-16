import { redirect } from "next/navigation";
import { prisma, serialize } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import CollaborationForm from "@/components/programs/CollaborationForm";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasRole(session.roles, "HO_ADMIN")) redirect("/masters/programs");

  const [branches, programs] = await Promise.all([
    prisma.branch.findMany({
      where: { status: "active" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, branchCode: true },
    }),
    prisma.program.findMany({
      where: { status: "active" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
  ]);

  return <CollaborationForm branches={serialize(branches)} programs={serialize(programs)} />;
}

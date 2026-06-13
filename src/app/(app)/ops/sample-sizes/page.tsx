import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";
import SampleSizesClient from "@/components/ops/SampleSizesClient";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasRole(session.roles, "ONB_LEAD")) redirect("/dashboard");

  const roleEntry = session.roles.find((r) => r.code === "ONB_LEAD" && r.branchId);
  const branchId = roleEntry?.branchId ? BigInt(roleEntry.branchId) : null;
  if (!branchId) redirect("/dashboard");

  const [sizes, branch] = await Promise.all([
    prisma.sampleSize.findMany({
      where: { branchId },
      orderBy: [{ status: "asc" }, { label: "asc" }],
      include: {
        _count: { select: { copies: true } },
      },
    }),
    prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } }),
  ]);

  const rows = serialize(sizes) as any[];

  return (
    <SampleSizesClient
      initialSizes={rows}
      branchId={String(branchId)}
      branchName={branch?.name ?? "Managed Branch"}
    />
  );
}

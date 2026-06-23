// Blocks — per-block details (categories in the block) + add a screen for that block. Phase: P1.1
// Access: Branch Admin + SCREEN_MANAGER (their branch only).
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";
import RmsBlocksClient from "@/components/rms/RmsBlocksClient";

export const dynamic = "force-dynamic";

export default async function RmsBlocksPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasRole(session.roles, "BRANCH_ADMIN", "SCREEN_MANAGER")) redirect("/dashboard");

  const role = session.roles.find(
    (r) => (r.code === "BRANCH_ADMIN" || r.code === "SCREEN_MANAGER") && r.branchId
  );
  const branchId = role?.branchId ? BigInt(role.branchId) : null;
  if (!branchId) redirect("/dashboard");

  const [branch, blocks, screens] = await Promise.all([
    prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } }),
    prisma.locationNode.findMany({
      where: { branchId, nodeType: "BLOCK" },
      orderBy: { name: "asc" },
      include: {
        nodeCategories: { include: { category: { select: { id: true, name: true } } } },
        _count: { select: { children: true, copies: true } },
      },
    }),
    prisma.screen.findMany({
      where: { branchId },
      select: { id: true, name: true, token: true, status: true, locationNodeId: true },
    }),
  ]);

  const blockRows = (serialize(blocks) as any[]).map((b) => ({
    id: b.id,
    name: b.name,
    code: b.code,
    childCount: b._count?.children ?? 0,
    copyCount: b._count?.copies ?? 0,
    categories: (b.nodeCategories ?? []).map((nc: any) => ({ id: nc.category.id, name: nc.category.name })),
  }));

  return (
    <RmsBlocksClient
      branchName={branch?.name ?? "your branch"}
      blocks={blockRows}
      screens={serialize(screens) as any[]}
    />
  );
}

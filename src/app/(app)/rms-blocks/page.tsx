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

  const [branch, blocks, screensRaw] = await Promise.all([
    prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } }),
    prisma.locationNode.findMany({
      where: { branchId, nodeType: "BLOCK" },
      orderBy: { name: "asc" },
      include: {
        program: { select: { id: true, name: true } },
        nodeCategories: { include: { category: { select: { id: true, name: true } } } },
        children: {
          where: { nodeType: "RACK" },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            code: true,
            _count: { select: { copies: true } },
            screenRacks: { include: { screen: { select: { id: true, name: true, token: true } } } },
          },
        },
        _count: { select: { copies: true } },
      },
    }),
    prisma.screen.findMany({
      where: { branchId },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, token: true, status: true },
    }),
  ]);

  const blockRows = (serialize(blocks) as any[]).map((b) => ({
    id: b.id,
    name: b.name,
    code: b.code,
    programId: b.program?.id ?? null,
    programName: b.program?.name ?? "No program",
    copyCount: b._count?.copies ?? 0,
    categories: (b.nodeCategories ?? []).map((nc: any) => ({ id: nc.category.id, name: nc.category.name })),
    racks: (b.children ?? []).map((r: any) => {
      const sr = r.screenRacks?.[0];
      return {
        id: r.id,
        name: r.name,
        code: r.code,
        copyCount: r._count?.copies ?? 0,
        screen: sr ? { id: sr.screen.id, name: sr.screen.name, token: sr.screen.token } : null,
      };
    }),
  }));

  return (
    <RmsBlocksClient
      branchName={branch?.name ?? "your branch"}
      blocks={blockRows}
      screens={serialize(screensRaw) as any[]}
    />
  );
}

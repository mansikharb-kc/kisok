// Admin — RMS Manager: create screens and assign racks (pick a block, then its racks). Phase: P1.1
// Access: Branch Admin + SCREEN_MANAGER (their branch only).
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";
import RmsScreensClient from "@/components/rms/RmsScreensClient";

export const dynamic = "force-dynamic";

export default async function RmsScreensAdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasRole(session.roles, "BRANCH_ADMIN", "SCREEN_MANAGER")) redirect("/dashboard");

  const role = session.roles.find(
    (r) => (r.code === "BRANCH_ADMIN" || r.code === "SCREEN_MANAGER") && r.branchId
  );
  const branchId = role?.branchId ? BigInt(role.branchId) : null;
  if (!branchId) redirect("/dashboard");

  const [branch, screensRaw] = await Promise.all([
    prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } }),
    prisma.screen.findMany({
      where: { branchId },
      orderBy: { createdAt: "desc" },
      include: {
        racks: {
          include: { rack: { select: { id: true, name: true, parent: { select: { name: true } } } } },
        },
      },
    }),
  ]);

  const screens = (serialize(screensRaw) as any[]).map((s) => ({
    id: s.id,
    name: s.name,
    token: s.token,
    status: s.status,
    racks: (s.racks ?? []).map((sr: any) => ({
      id: sr.rack.id,
      name: sr.rack.name,
      blockName: sr.rack.parent?.name ?? null,
    })),
  }));

  return <RmsScreensClient branchName={branch?.name ?? "your branch"} screens={screens} />;
}

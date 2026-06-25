// Screen Preview — RMS Manager sees every screen and the products in its racks
// (block › rack → which brand's which product + info). Phase: P1.2 (functional preview)
// Access: Branch Admin + SCREEN_MANAGER (their branch only).
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";
import RmsPreviewClient from "@/components/rms/RmsPreviewClient";

export const dynamic = "force-dynamic";

export default async function RmsPreviewPage() {
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
          include: {
            rack: {
              select: {
                id: true,
                name: true,
                code: true,
                parent: { select: { name: true } },
                copies: {
                  where: { status: "active" },
                  select: {
                    id: true,
                    instanceCode: true,
                    availability: true,
                    product: {
                      select: {
                        id: true,
                        name: true,
                        sku: true,
                        brand: { select: { name: true } },
                        category: { select: { name: true } },
                      },
                    },
                  },
                },
              },
            },
          },
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
      code: sr.rack.code,
      blockName: sr.rack.parent?.name ?? null,
      products: (sr.rack.copies ?? []).map((c: any) => ({
        copyId: c.id,
        instanceCode: c.instanceCode,
        availability: c.availability,
        productId: c.product?.id ?? null,
        name: c.product?.name ?? "—",
        sku: c.product?.sku ?? "",
        brand: c.product?.brand?.name ?? "—",
        category: c.product?.category?.name ?? "—",
      })),
    })),
  }));

  return <RmsPreviewClient branchName={branch?.name ?? "your branch"} screens={screens} />;
}

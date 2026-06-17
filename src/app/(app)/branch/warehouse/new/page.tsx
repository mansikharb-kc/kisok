import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";
import WarehouseNodeForm from "@/components/warehouse/WarehouseNodeForm";
import { LocationNode } from "@/lib/warehouseMeta";

export const dynamic = "force-dynamic";

const NODE_SELECT = {
  id: true,
  parentId: true,
  nodeType: true,
  name: true,
  code: true,
  categoryId: true,
  path: true,
  depth: true,
  isPlacementEligible: true,
  quantity: true,
  isScreenMountable: true,
  locationId: true,
  status: true,
  category: { select: { id: true, name: true, code: true, categoryAttributes: { select: { attribute: { select: { name: true, code: true } } } } } },
  nodeCategories: { select: { categoryId: true, category: { select: { name: true } } } },
  _count: { select: { children: true, copies: true } },
} as const;

export default async function Page({
  searchParams,
}: {
  searchParams: { program?: string; parentId?: string; editId?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasRole(session.roles, "HO_ADMIN", "BRANCH_ADMIN")) redirect("/dashboard");

  let branchId: bigint | null = null;
  const branchRole = session.roles.find((r) => r.code === "BRANCH_ADMIN" && r.branchId);
  if (branchRole?.branchId) branchId = BigInt(branchRole.branchId);
  if (!branchId) {
    const first = await prisma.branch.findFirst({ where: { status: "active" }, orderBy: { name: "asc" } });
    branchId = first?.id ?? null;
  }
  if (!branchId || !searchParams.program) redirect("/branch/warehouse");

  const program = await prisma.program.findUnique({
    where: { id: BigInt(searchParams.program) },
    select: { id: true, name: true },
  });
  if (!program) redirect("/branch/warehouse");

  const [categoryRows, parentRow, editRow] = await Promise.all([
    prisma.category.findMany({
      where: { status: "active" },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, code: true, parentId: true, categoryAttributes: { select: { attribute: { select: { id: true, name: true, code: true } } } } },
    }),
    searchParams.parentId
      ? prisma.locationNode.findUnique({ where: { id: BigInt(searchParams.parentId) }, select: NODE_SELECT })
      : Promise.resolve(null),
    searchParams.editId
      ? prisma.locationNode.findUnique({ where: { id: BigInt(searchParams.editId) }, select: NODE_SELECT })
      : Promise.resolve(null),
  ]);

  return (
    <WarehouseNodeForm
      branchId={String(branchId)}
      programId={String(program.id)}
      programName={program.name}
      categories={serialize(categoryRows) as never}
      parentNode={parentRow ? (serialize(parentRow) as LocationNode) : null}
      editNode={editRow ? (serialize(editRow) as LocationNode) : null}
    />
  );
}

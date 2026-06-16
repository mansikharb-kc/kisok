import { prisma, serialize } from "@/lib/prisma";
import CategoriesTree, { FlatCategory } from "@/components/categories/CategoriesTree";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const session = await getSession();
  const isHo = session ? hasRole(session.roles, "HO_ADMIN") : false;
  const isBranchAdmin = session ? hasRole(session.roles, "BRANCH_ADMIN") : false;
  // Branch Admin: cannot edit/delete (readOnly) but CAN request new (canCreate).
  const readOnly = !isHo;
  const canCreate = isHo || isBranchAdmin;

  const rows = await prisma.category.findMany({
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true, code: true, parentId: true, status: true },
  });

  const categories: FlatCategory[] = serialize(rows);

  return <CategoriesTree initial={categories} readOnly={readOnly} canCreate={canCreate} />;
}

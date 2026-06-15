import { prisma, serialize } from "@/lib/prisma";
import CategoriesTree, { FlatCategory } from "@/components/categories/CategoriesTree";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const session = await getSession();
  const readOnly = session ? !hasRole(session.roles, "HO_ADMIN") : true;

  const rows = await prisma.category.findMany({
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true, code: true, parentId: true, status: true },
  });

  const categories: FlatCategory[] = serialize(rows);

  return <CategoriesTree initial={categories} readOnly={readOnly} />;
}

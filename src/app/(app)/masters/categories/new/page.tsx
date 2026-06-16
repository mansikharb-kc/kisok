import { prisma, serialize } from "@/lib/prisma";
import { MAX_LEVEL } from "@/lib/categoryLevels";
import { FlatCat } from "@/lib/categoryTree";
import { requirePageRole } from "@/lib/guard";
import { hasRole } from "@/lib/rbac";
import CategoryCreateForm from "@/components/categories/CategoryCreateForm";

export const dynamic = "force-dynamic";

export default async function NewCategoryPage({
  searchParams,
}: {
  searchParams: { level?: string; parent?: string };
}) {
  const session = await requirePageRole("HO_ADMIN", "BRANCH_ADMIN");
  const isRequest = !hasRole(session.roles, "HO_ADMIN"); // Branch Admin → submit for approval

  const rows = await prisma.category.findMany({
    select: { id: true, name: true, parentId: true },
  });
  const flat: FlatCat[] = serialize(rows);

  const parentId = searchParams.parent ?? null;
  const lockContext = !!parentId; // launched from "+ Sub"
  let level = Number(searchParams.level) || 1;
  if (level < 1) level = 1;
  if (level > MAX_LEVEL) level = MAX_LEVEL;

  return (
    <CategoryCreateForm
      flat={flat}
      initialLevel={level}
      initialParentId={parentId}
      lockContext={lockContext}
      isRequest={isRequest}
    />
  );
}

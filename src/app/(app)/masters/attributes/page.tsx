import { prisma, serialize } from "@/lib/prisma";
import AttributesClient, { AttrRow } from "@/components/attributes/AttributesClient";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function AttributesPage() {
  const session = await getSession();
  const isHo = session ? hasRole(session.roles, "HO_ADMIN") : false;
  const isBranchAdmin = session ? hasRole(session.roles, "BRANCH_ADMIN") : false;
  const readOnly = !isHo; // Branch Admin can't edit/delete…
  const canRequest = isBranchAdmin; // …but can request new (HO approval)
  const rows = await prisma.attribute.findMany({
    orderBy: [{ status: "asc" }, { sectionGroup: "asc" }, { name: "asc" }],
    include: {
      options: { orderBy: { displayOrder: "asc" } },
      categoryAttributes: {
        select: { id: true, category: { select: { id: true, name: true } } },
        orderBy: { category: { name: "asc" } },
      },
    },
  });

  const attributes: AttrRow[] = serialize(rows).map((a: any) => {
    const mappedCategories = a.categoryAttributes
      .filter((ca: any) => ca.category?.name)
      .map((ca: any) => ({
        mapId: ca.id,
        categoryId: ca.category.id,
        name: ca.category.name,
      }));
    return {
      id: a.id,
      name: a.name,
      code: a.code,
      dataType: a.dataType,
      unit: a.unit,
      sectionGroup: a.sectionGroup,
      isVariant: a.isVariant,
      isPriceable: a.isPriceable,
      isRequired: a.isRequired,
      status: a.status,
      options: a.options.map((o: any) => o.optionValue),
      mappedCount: mappedCategories.length,
      mappedCategories,
    };
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Attributes</h1>
        <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-brand-100 text-brand-700">
          General
        </span>
      </div>

      <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900 flex gap-3">
        <span className="text-lg leading-none"></span>
        <div>
          <strong>These are general attributes</strong> — defined once here and reusable everywhere.
          An attribute is <em>not</em> tied to one category; you <strong>map</strong> it to categories from the{" "}
          <a href="/masters/categories" className="underline">Category Master</a>, and it then{" "}
          <strong>inherits down to all sub-categories</strong>. The category names show where each is currently mapped.
        </div>
      </div>

      <AttributesClient initial={attributes} readOnly={readOnly} canRequest={canRequest} />
    </div>
  );
}

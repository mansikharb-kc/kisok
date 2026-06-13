import { prisma, serialize } from "@/lib/prisma";
import AttributesClient, { AttrRow } from "@/components/attributes/AttributesClient";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function AttributesPage() {
  const session = await getSession();
  const readOnly = session ? !hasRole(session.roles, "HO_ADMIN") : true;
  const rows = await prisma.attribute.findMany({
    orderBy: [{ status: "asc" }, { sectionGroup: "asc" }, { name: "asc" }],
    include: {
      options: { orderBy: { displayOrder: "asc" } },
      _count: { select: { categoryAttributes: true } },
    },
  });

  const attributes: AttrRow[] = serialize(rows).map((a: any) => ({
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
    mappedCount: a._count.categoryAttributes,
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Attributes</h1>
        <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-brand-100 text-brand-700">
          Global Library
        </span>
      </div>

      <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900 flex gap-3">
        <span className="text-lg leading-none">🌐</span>
        <div>
          <strong>These are global attributes</strong> — defined once here and reusable everywhere.
          An attribute is <em>not</em> tied to one category; you <strong>map</strong> it to categories from the{" "}
          <a href="/masters/categories" className="underline">Category Master</a>, and it then{" "}
          <strong>inherits down to all sub-categories</strong>. The “N categories” count shows where each is currently mapped.
        </div>
      </div>

      <AttributesClient initial={attributes} readOnly={readOnly} />
    </div>
  );
}

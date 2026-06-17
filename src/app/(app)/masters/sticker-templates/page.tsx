import { prisma, serialize } from "@/lib/prisma";
import StickerTemplatesClient, { CategoryOption, TemplateRow } from "@/components/stickers/StickerTemplatesClient";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const DEFAULT_ELEMENTS: Record<string, boolean> = {
  brandLogo: true,
  branchName: true,
  productName: true,
  category: true,
  attributes: false,
  locationId: true,
  sku: true,
  qr: true,
};

export default async function StickerTemplatesPage() {
  const session = await getSession();
  const readOnly = session ? !hasRole(session.roles, "HO_ADMIN") : true;

  const [templates, categories] = await Promise.all([
    prisma.stickerTemplate.findMany({
      orderBy: [{ status: "asc" }, { name: "asc" }],
      include: { category: { select: { name: true, code: true } } },
    }),
    // ~6380 categories — only id/name/code are sent; the client uses a searchable
    // picker (filtered client-side, capped to 50 shown) instead of a giant <select>.
    prisma.category.findMany({
      where: { status: "active" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
  ]);

  const rows: TemplateRow[] = serialize(templates).map((t: any) => ({
    id: t.id,
    name: t.name,
    categoryId: t.categoryId,
    categoryName: t.category?.name ?? "—",
    categoryCode: t.category?.code ?? null,
    elements: { ...DEFAULT_ELEMENTS, ...(t.elements ?? {}) },
    layout: t.layout ?? null,
    status: t.status,
  }));

  const categoryOptions: CategoryOption[] = serialize(categories).map((c: any) => ({
    id: c.id,
    name: c.name,
    code: c.code,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sticker Templates</h1>
        <p className="text-sm text-slate-500 mt-1">
          HO master: pick a base design (Laminate or Pioneer), map the field rows to the category's attributes, and save.
          Duplicate a template to create new ones. Field values fill in from the product at print time.
        </p>
      </div>
      <StickerTemplatesClient initial={rows} categories={categoryOptions} readOnly={readOnly} />
    </div>
  );
}

import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import StickerRender, { type RenderRow } from "@/components/stickers/StickerRender";
import PrintButton from "@/components/stickers/PrintButton";
import { normalizeLayout, resolveQrLink, type StickerField } from "@/lib/stickerLayout";

export const dynamic = "force-dynamic";

function parseId(id: string): bigint | null {
  try {
    return BigInt(id);
  } catch {
    return null;
  }
}

// Runtime-written uploads aren't served by `next start` from /uploads — route
// them through the API file handler so QR images load in production too.
function uploadSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/uploads/")) return `/api/uploads/${url.slice("/uploads/".length)}`;
  return url;
}

function formatAttrValue(
  v: {
    valueText: string | null;
    valueNumber: any;
    valueBool: boolean | null;
    valueDate: Date | null;
    option: { optionValue: string } | null;
  },
  unit: string | null
): string {
  if (v.option?.optionValue) return v.option.optionValue;
  if (v.valueText) return v.valueText;
  if (v.valueNumber != null) return `${v.valueNumber}${unit ? ` ${unit}` : ""}`;
  if (v.valueBool != null) return v.valueBool ? "Yes" : "No";
  if (v.valueDate) return new Date(v.valueDate).toLocaleDateString();
  return "";
}

export default async function PrintStickerPage({
  params,
  searchParams,
}: {
  params: { copyId: string };
  searchParams: { template?: string };
}) {
  await requireRole("HO_ADMIN", "BRANCH_ADMIN", "ONB_LEAD", "OB_EXEC", "CONSIGNMENT_USER");
  const id = parseId(params.copyId);
  if (id === null) notFound();

  const [copy, attributes] = await Promise.all([
    prisma.productCopy.findUnique({
      where: { id },
      select: {
        instanceCode: true,
        qr: { select: { url: true } },
        location: { select: { locationId: true } },
        product: {
          select: {
            name: true,
            sku: true,
            categoryId: true,
            brand: { select: { name: true, logo: { select: { url: true } } } },
            attrValues: {
              select: {
                attributeId: true,
                valueText: true,
                valueNumber: true,
                valueBool: true,
                valueDate: true,
                option: { select: { optionValue: true } },
              },
            },
          },
        },
      },
    }),
    prisma.attribute.findMany({
      select: { id: true, code: true, unit: true },
    }),
  ]);
  if (!copy) notFound();

  // Resolve the sticker template: an explicit ?template= wins, else the first
  // active template for the product's category (or its parent categories).
  const templateIdParam = searchParams.template ? parseId(searchParams.template) : null;
  let template = null;

  if (templateIdParam) {
    template = await prisma.stickerTemplate.findUnique({
      where: { id: templateIdParam },
      select: { id: true, name: true, layout: true },
    });
  } else {
    let cur: bigint | null = copy.product.categoryId;
    let guard = 0;
    while (cur && guard++ < 20) {
      const found = await prisma.stickerTemplate.findFirst({
        where: { categoryId: cur, status: "active" },
        select: { id: true, name: true, layout: true },
      });
      if (found) {
        template = found;
        break;
      }
      const parentCat: { parentId: bigint | null } | null = await prisma.category.findUnique({
        where: { id: cur },
        select: { parentId: true },
      });
      cur = parentCat ? parentCat.parentId : null;
    }
  }

  if (!template) {
    return (
      <main className="mx-auto max-w-md p-10 text-center">
        <h1 className="text-lg font-semibold text-slate-800">No sticker template</h1>
        <p className="mt-2 text-sm text-slate-500">No active sticker template is configured for this product&apos;s category. Create one under Sticker Templates.</p>
      </main>
    );
  }

  const layout = normalizeLayout(template.layout);

  const attributeMap = new Map(attributes.map((a) => [a.id.toString(), a]));

  // Index attribute values by attributeId for fast lookup.
  const byAttr = new Map(copy.product.attrValues.map((v) => [String(v.attributeId), v]));

  const rows: RenderRow[] = layout.fields.map((f: StickerField) => {
    let value = "";
    switch (f.source) {
      case "productName":
        value = copy.product.name;
        break;
      case "sku":
        value = copy.product.sku;
        break;
      case "brandName":
        value = copy.product.brand?.name ?? "";
        break;
      case "instanceCode":
        value = copy.instanceCode;
        break;
      case "static":
        value = f.staticText ?? "";
        break;
      case "attribute": {
        const v = f.attributeId ? byAttr.get(String(f.attributeId)) : undefined;
        const attrMeta = f.attributeId ? attributeMap.get(String(f.attributeId)) : undefined;
        value = v ? formatAttrValue(v, attrMeta?.unit ?? null) : "";
        break;
      }
    }
    return { id: f.id, label: f.label, value };
  });

  // QR encodes the template's link with this copy's tokens filled in, so every
  // copy's QR opens its own URL. Generated server-side from the resolved link.
  let qrDataUrl: string | null = null;
  if (layout.showQr) {
    const target = resolveQrLink(layout.qrLink, {
      instanceCode: copy.instanceCode,
      sku: copy.product.sku,
      productName: copy.product.name,
      brandName: copy.product.brand?.name ?? "",
    });
    qrDataUrl = await QRCode.toDataURL(target, { width: 256, margin: 0 });
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 print:bg-white print:p-0">
      <div className="no-print mx-auto mb-4 flex max-w-md items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-slate-800">{template.name}</h1>
          <p className="text-xs text-slate-500">{copy.instanceCode}</p>
        </div>
        <PrintButton />
      </div>

      <div className="flex justify-center">
        <div className="print-sticker shadow-md ring-1 ring-slate-300 print:shadow-none print:ring-0">
          <StickerRender
            layout={layout}
            rows={rows}
            brandName={copy.product.brand?.name}
            brandLogoUrl={uploadSrc(copy.product.brand?.logo?.url)}
            qrUrl={qrDataUrl}
            barcodeValue={copy.instanceCode}
            bottomCode={copy.location?.locationId ?? null}
          />
        </div>
      </div>

      <style>{`
        @page { size: ${layout.size.w}mm ${layout.size.h}mm; margin: 0; }
        @media print {
          .no-print { display: none !important; }
          html, body { background: #fff !important; }
          .print-sticker { box-shadow: none !important; }
        }
      `}</style>
    </main>
  );
}

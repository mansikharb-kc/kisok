import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import StickerRender, { type RenderRow } from "@/components/stickers/StickerRender";
import PrintButton from "@/components/stickers/PrintButton";
import { normalizeLayout, resolveQrLink, type StickerField } from "@/lib/stickerLayout";

export const dynamic = "force-dynamic";

function parseIds(idsStr?: string): bigint[] {
  if (!idsStr) return [];
  return idsStr
    .split(",")
    .map((id) => {
      try {
        return BigInt(id.trim());
      } catch {
        return null;
      }
    })
    .filter((id): id is bigint => id !== null);
}

// Route runtime-written uploads so they load in production too
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

export default async function PrintStickersPage({
  searchParams,
}: {
  searchParams: { ids?: string };
}) {
  await requireRole("HO_ADMIN", "BRANCH_ADMIN", "ONB_LEAD", "OB_EXEC", "CONSIGNMENT_USER");
  const ids = parseIds(searchParams.ids);
  if (ids.length === 0) {
    return (
      <main className="mx-auto max-w-md p-10 text-center">
        <h1 className="text-lg font-semibold text-slate-800">No copies selected</h1>
        <p className="mt-2 text-sm text-slate-500">Please provide a valid list of copy IDs to print.</p>
      </main>
    );
  }

  // Fetch product copies
  const [copiesList, attributes] = await Promise.all([
    prisma.productCopy.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
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

  if (copiesList.length === 0) notFound();

  const attributeMap = new Map(attributes.map((a) => [a.id.toString(), a]));

  // Build the list of stickers with resolved templates
  const stickersToRender = [];

  for (const copy of copiesList) {
    // Resolve template using parent category fallback
    let template = null;
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
      const cat: { parentId: bigint | null } | null = await prisma.category.findUnique({
        where: { id: cur },
        select: { parentId: true },
      });
      cur = cat ? cat.parentId : null;
    }

    if (!template) {
      // If a copy lacks a template, we will render a fallback message block
      stickersToRender.push({
        copy,
        hasTemplate: false,
        errorMsg: `No active sticker template is configured for "${copy.product.name}" category hierarchy.`
      });
      continue;
    }

    const layout = normalizeLayout(template.layout);
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

    stickersToRender.push({
      copy,
      hasTemplate: true,
      templateName: template.name,
      layout,
      rows,
      qrDataUrl
    });
  }

  // Find a dominant/first layout to set the print size style if possible
  const firstSticker = stickersToRender.find((s) => s.hasTemplate);
  const sizeStyle = firstSticker?.layout
    ? `@page { size: ${firstSticker.layout.size.w}mm ${firstSticker.layout.size.h}mm; margin: 0; }`
    : "";

  return (
    <main className="min-h-screen bg-slate-100 p-6 print:bg-white print:p-0">
      <div className="no-print mx-auto mb-6 flex max-w-xl items-center justify-between bg-white px-5 py-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-base font-extrabold text-slate-900">Bulk Print Layout</h1>
          <p className="text-xs text-slate-500 mt-1">Ready to print {stickersToRender.length} stickers.</p>
        </div>
        <PrintButton />
      </div>

      <div className="flex flex-col items-center gap-6 print:gap-0 print:block">
        {stickersToRender.map((sticker, idx) => (
          <div
            key={sticker.copy.id.toString()}
            className="sticker-container flex flex-col items-center w-full print:block print:w-auto page-break"
          >
            {sticker.hasTemplate && sticker.layout && sticker.rows ? (
              <div className="print-sticker shadow-md ring-1 ring-slate-300 print:shadow-none print:ring-0 mb-6 print:mb-0">
                <StickerRender
                  layout={sticker.layout}
                  rows={sticker.rows}
                  brandName={sticker.copy.product.brand?.name}
                  brandLogoUrl={uploadSrc(sticker.copy.product.brand?.logo?.url)}
                  qrUrl={sticker.qrDataUrl}
                  barcodeValue={sticker.copy.instanceCode}
                  bottomCode={sticker.copy.location?.locationId ?? null}
                />
              </div>
            ) : (
              <div className="mx-auto max-w-md p-6 text-center bg-white border border-red-200 text-red-700 rounded-lg shadow-sm mb-6 print:hidden">
                <h3 className="text-sm font-bold">Sticker {idx + 1} — No Template</h3>
                <p className="text-xs text-slate-500 mt-1">{sticker.errorMsg}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <style>{`
        ${sizeStyle}
        @media print {
          .no-print { display: none !important; }
          html, body { background: #fff !important; }
          .print-sticker { box-shadow: none !important; margin: 0 !important; }
          .page-break { page-break-after: always; break-after: page; }
        }
      `}</style>
    </main>
  );
}

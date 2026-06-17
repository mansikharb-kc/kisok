// Sticker layout model — shared by the template builder, the live preview and
// the print page. A template stores a `layout` JSON of this shape. Field values
// are resolved at print time from the product's attribute values (or built-ins).

export const STICKER_BASES = ["laminate", "pioneer"] as const;
export type StickerBase = (typeof STICKER_BASES)[number];

// Where a field row's value comes from at print time.
export const FIELD_SOURCES = [
  "attribute", // mapped to one of the product category's attributes
  "productName", // BrandProduct.name
  "sku", // BrandProduct.sku
  "brandName", // Brand.name
  "instanceCode", // ProductCopy.instanceCode
  "static", // fixed text typed by HO
] as const;
export type FieldSource = (typeof FIELD_SOURCES)[number];

export const FIELD_SOURCE_LABELS: Record<FieldSource, string> = {
  attribute: "Product Attribute",
  productName: "Product Name (built-in)",
  sku: "SKU (built-in)",
  brandName: "Brand Name (built-in)",
  instanceCode: "Instance Code (built-in)",
  static: "Static Text",
};

export type StickerField = {
  id: string; // stable row key
  label: string; // editable display label, e.g. "Product Name"
  source: FieldSource;
  attributeId?: string | null; // when source === "attribute"
  attributeCode?: string | null; // denormalized for print-time resolution
  staticText?: string | null; // when source === "static"
};

export type StickerSize = { w: number; h: number }; // millimetres

export type StickerLayout = {
  base: StickerBase;
  size: StickerSize;
  fields: StickerField[];
  // Base art toggles (logos / codes are part of the design, not field rows).
  showBrandLogo: boolean;
  showQr: boolean;
  showBarcode: boolean;
  // URL the QR encodes. Supports tokens resolved per product copy at print time:
  // {instanceCode} {sku} {productName} {brandName}. Empty → encodes instanceCode.
  qrLink: string;
};

// Tokens available in the QR link template.
export const QR_LINK_TOKENS = ["{instanceCode}", "{sku}", "{productName}", "{brandName}"] as const;

// Per-base physical sizes (mm) matching the real printed samples.
export const BASE_META: Record<StickerBase, { label: string; size: StickerSize; orientation: "portrait" | "landscape" }> = {
  laminate: { label: "Laminate (37.5 × 50 mm, portrait)", size: { w: 37.5, h: 50 }, orientation: "portrait" },
  pioneer: { label: "Pioneer (85 × 60 mm, landscape)", size: { w: 85, h: 60 }, orientation: "landscape" },
};

let rowSeq = 0;
function rid(prefix: string) {
  rowSeq += 1;
  return `${prefix}-${rowSeq}`;
}

// Default field rows shipped with each base preset. HO maps each row to a real
// attribute (or keeps the built-in source) after picking a category.
function laminateFields(): StickerField[] {
  return [
    { id: rid("f"), label: "Product Name", source: "productName" },
    { id: rid("f"), label: "Product ID", source: "sku" },
    { id: rid("f"), label: "Product Series", source: "attribute", attributeId: null },
    { id: rid("f"), label: "Dimension", source: "attribute", attributeId: null },
    { id: rid("f"), label: "Thickness", source: "attribute", attributeId: null },
    { id: rid("f"), label: "Colour & Finish", source: "attribute", attributeId: null },
    { id: rid("f"), label: "Material Type", source: "attribute", attributeId: null },
  ];
}

function pioneerFields(): StickerField[] {
  return [
    { id: rid("f"), label: "Product Name", source: "productName" },
    { id: rid("f"), label: "Product Type", source: "attribute", attributeId: null },
    { id: rid("f"), label: "Dimension", source: "attribute", attributeId: null },
    { id: rid("f"), label: "Thickness", source: "attribute", attributeId: null },
    { id: rid("f"), label: "Colour & Finish", source: "attribute", attributeId: null },
    { id: rid("f"), label: "Application", source: "attribute", attributeId: null },
    { id: rid("f"), label: "Available Sizes", source: "attribute", attributeId: null },
  ];
}

/** A fresh editable preset for the given base design. */
export function basePreset(base: StickerBase): StickerLayout {
  return {
    base,
    size: { ...BASE_META[base].size },
    fields: base === "pioneer" ? pioneerFields() : laminateFields(),
    showBrandLogo: true,
    showQr: true,
    showBarcode: true,
    qrLink: "",
  };
}

export function newFieldRow(): StickerField {
  return { id: rid("f"), label: "New Field", source: "static", staticText: "" };
}

/** Coerce arbitrary JSON (from DB) into a valid layout, defaulting missing bits. */
export function normalizeLayout(raw: unknown): StickerLayout {
  const obj = (raw ?? {}) as Partial<StickerLayout>;
  const base: StickerBase = STICKER_BASES.includes(obj.base as StickerBase) ? (obj.base as StickerBase) : "laminate";
  const preset = basePreset(base);
  const fields = Array.isArray(obj.fields) && obj.fields.length > 0 ? (obj.fields as StickerField[]) : preset.fields;
  return {
    base,
    size: obj.size && typeof obj.size.w === "number" && typeof obj.size.h === "number" ? obj.size : preset.size,
    fields,
    showBrandLogo: obj.showBrandLogo ?? true,
    showQr: obj.showQr ?? true,
    showBarcode: obj.showBarcode ?? true,
    qrLink: typeof obj.qrLink === "string" ? obj.qrLink : "",
  };
}

/** Resolve QR-link tokens with a product copy's values. Empty template → code. */
export function resolveQrLink(
  template: string,
  values: { instanceCode: string; sku: string; productName: string; brandName: string },
): string {
  const t = (template ?? "").trim();
  if (!t) return values.instanceCode;
  return t
    .replace(/\{instanceCode\}/g, values.instanceCode)
    .replace(/\{sku\}/g, values.sku)
    .replace(/\{productName\}/g, values.productName)
    .replace(/\{brandName\}/g, values.brandName);
}

/** True when a layout is the new field-row model (vs. the legacy 8-toggle one). */
export function hasLayout(raw: unknown): boolean {
  const obj = raw as Partial<StickerLayout> | null;
  return Boolean(obj && Array.isArray(obj.fields) && obj.fields.length > 0);
}

// Sticker label element keys (shared by API + UI). Branch name auto-fills per
// branch at render time, but is still a toggle here so HO can control visibility.
export const ELEMENT_KEYS = [
  "brandLogo",
  "branchName",
  "productName",
  "category",
  "attributes",
  "locationId",
  "sku",
  "qr",
] as const;

export type ElementKey = (typeof ELEMENT_KEYS)[number];

export const ELEMENT_LABELS: Record<ElementKey, string> = {
  brandLogo: "Brand Logo",
  branchName: "Branch Name",
  productName: "Product Name",
  category: "Category",
  attributes: "Attributes",
  locationId: "Location ID",
  sku: "SKU",
  qr: "QR Code",
};

export const DEFAULT_ELEMENTS: Record<string, boolean> = {
  brandLogo: true,
  branchName: true,
  productName: true,
  category: true,
  attributes: false,
  locationId: true,
  sku: true,
  qr: true,
};

/** Merge provided element toggles over defaults so a row always has all 8 keys. */
export function normalizeElements(partial?: Partial<Record<string, boolean>>): Record<string, boolean> {
  const out: Record<string, boolean> = { ...DEFAULT_ELEMENTS };
  for (const [k, v] of Object.entries(partial ?? {})) {
    if (typeof v === "boolean") out[k] = v;
  }
  return out;
}

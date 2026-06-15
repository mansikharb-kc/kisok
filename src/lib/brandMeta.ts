// Brand form option lists (shared by API + UI).

// Indian GSTIN: 2-digit state code + 10-char PAN + entity digit + 'Z' + checksum (15 chars).
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function isValidGstin(v: string): boolean {
  return GSTIN_REGEX.test(v.trim().toUpperCase());
}

export const BRAND_TYPES = ["Handicraft", "Regional", "National", "International", "Others"];

// Brand ID prefix by type (e.g. National -> NAT-0001). Fallback BRD when type unset.
export const BRAND_TYPE_PREFIX: Record<string, string> = {
  Handicraft: "HND",
  Regional: "REG",
  National: "NAT",
  International: "INT",
  Others: "OTH",
};

export function brandPrefix(type?: string | null): string {
  return (type && BRAND_TYPE_PREFIX[type]) || "BRD";
}

/**
 * 4-letter base for the brand code, derived from the name:
 *  - strip non-letters, uppercase
 *  - if it has >= 4 consonants: first 2 + last 2 consonants  (Century -> CNTRY -> CNRY)
 *  - else: use the raw letters                                (EX -> EX)
 *  - pad to 4 with Z                                          (EX -> EXZZ)
 */
export function brandCodeBase(name: string): string {
  const letters = (name || "").toUpperCase().replace(/[^A-Z]/g, "");
  const cons = letters.replace(/[AEIOU]/g, "");
  const base = cons.length >= 4 ? cons.slice(0, 2) + cons.slice(-2) : letters;
  return (base + "ZZZZ").slice(0, 4);
}

export const AGREEMENT_DURATIONS = [
  { label: "6 Months", months: 6 },
  { label: "1 Year", months: 12 },
  { label: "2 Years", months: 24 },
  { label: "3 Years", months: 36 },
  { label: "5 Years", months: 60 },
];

export function durationMonths(label: string): number | null {
  return AGREEMENT_DURATIONS.find((d) => d.label === label)?.months ?? null;
}

/** Add `months` to an ISO date string (yyyy-mm-dd), return yyyy-mm-dd. */
export function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCMonth(base.getUTCMonth() + months);
  return base.toISOString().slice(0, 10);
}

/** yyyy-mm-dd -> dd/mm/yyyy (for display). */
export function formatDMY(isoDate: string): string {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

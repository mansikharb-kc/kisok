// Attribute data types and ML section groups (shared by API + UI).

export const DATA_TYPES = [
  { value: "string", label: "Text" },
  { value: "number", label: "Number" },
  { value: "enum", label: "Dropdown (enum)" },
  { value: "boolean", label: "Yes / No" },
  { value: "date", label: "Date" },
  { value: "file", label: "File" },
] as const;

export const DATA_TYPE_VALUES = DATA_TYPES.map((d) => d.value);

// Mirrors ML's 9 Section Groups.
export const SECTION_GROUPS = [
  "Technical",
  "Physical Properties",
  "Aesthetics",
  "Quality & Certifications",
  "Material & Construction",
  "Installation",
  "Features",
  "Sustainability",
  "Miscellaneous",
] as const;

export function dataTypeLabel(v: string) {
  return DATA_TYPES.find((d) => d.value === v)?.label ?? v;
}

export function slugFromName(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

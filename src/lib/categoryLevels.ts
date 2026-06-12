// Shared category level config (Domain → Group → Family → Category → Sub-Category)
export const LEVELS = [
  { label: "Domain", short: "L1", badge: "bg-purple-100 text-purple-700", dot: "bg-purple-500" },
  { label: "Group", short: "L2", badge: "bg-green-100 text-green-700", dot: "bg-green-500" },
  { label: "Family", short: "L3", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  { label: "Category", short: "L4", badge: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  { label: "Sub-Category", short: "L5", badge: "bg-slate-200 text-slate-600", dot: "bg-slate-500" },
];

export const MAX_LEVEL = LEVELS.length;

export function levelMeta(level: number) {
  return (
    LEVELS[level - 1] ?? {
      label: `Level ${level}`,
      short: `L${level}`,
      badge: "bg-slate-100 text-slate-500",
      dot: "bg-slate-400",
    }
  );
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

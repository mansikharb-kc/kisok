// Shared category level config (Domain → Group → Family → Category → Sub-Category)
export const LEVELS = [
  { label: "Domain", short: "L1", badge: "bg-purple-600 text-white", dot: "bg-purple-500" },
  { label: "Group", short: "L2", badge: "bg-green-600 text-white", dot: "bg-green-500" },
  { label: "Family", short: "L3", badge: "bg-amber-600 text-white", dot: "bg-amber-500" },
  { label: "Category", short: "L4", badge: "bg-blue-600 text-white", dot: "bg-blue-500" },
  { label: "Sub-Category", short: "L5", badge: "bg-rose-600 text-white", dot: "bg-rose-500" },
];

export const MAX_LEVEL = LEVELS.length;

export function levelMeta(level: number) {
  return (
    LEVELS[level - 1] ?? {
      label: `Level ${level}`,
      short: `L${level}`,
      badge: "bg-slate-600 text-white",
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

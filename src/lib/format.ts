export function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return d.toLocaleDateString();
}

// "category.create" -> "Created category"
const VERBS: Record<string, string> = {
  create: "Created",
  update: "Updated",
  retire: "Retired",
  activate: "Activated",
  deactivate: "Deactivated",
  delete: "Deleted",
  approve: "Approved",
  reject: "Rejected",
  map: "Mapped",
  unmap: "Unmapped",
  map_update: "Updated mapping on",
};

const ENTITY_LABEL: Record<string, string> = {
  category: "category",
  attribute: "attribute",
  brand: "brand",
  program: "program",
  categoryattribute: "attribute mapping",
};

export function actionLabel(action: string): string {
  const [entity, verb] = action.split(".");
  const v = VERBS[verb] ?? (verb ? verb[0].toUpperCase() + verb.slice(1) : "Changed");
  const e = ENTITY_LABEL[(entity || "").toLowerCase()] ?? entity ?? "record";
  return `${v} ${e}`;
}

// Colour family for the activity dot, by verb.
export function actionTone(action: string): string {
  const verb = action.split(".")[1] ?? "";
  if (["create", "approve", "activate", "map"].includes(verb)) return "bg-green-500";
  if (["delete", "reject", "retire", "deactivate", "unmap"].includes(verb)) return "bg-red-500";
  return "bg-slate-400";
}

type AuditJson = {
  name?: string;
  attribute?: string;
  names?: string[];
  created?: number;
} | null;

/** Best human-readable target for an audit row, or null if none. */
export function auditTarget(after: AuditJson, before: AuditJson): string | null {
  const a = after ?? {};
  if (a.name) return a.name;
  if (a.attribute) return a.attribute;
  if (Array.isArray(a.names) && a.names.length) {
    return a.names.length > 1 ? `${a.names[0]} +${a.names.length - 1} more` : a.names[0];
  }
  if (typeof a.created === "number") return `${a.created} item${a.created === 1 ? "" : "s"}`;
  if (before?.name) return before.name;
  return null;
}

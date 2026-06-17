export function formatDate(date: Date | string | number | null | undefined): string {
  if (!date) return "";
  
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split("-");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthIndex = parseInt(m, 10) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${d.padStart(2, "0")}-${months[monthIndex]}-${y}`;
    }
  }

  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  
  const day = String(d.getDate()).padStart(2, "0");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  
  return `${day}-${month}-${year}`;
}

export function formatDateTime(date: Date | string | number | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  
  const day = String(d.getDate()).padStart(2, "0");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const hoursStr = String(hours).padStart(2, "0");
  
  return `${day}-${month}-${year}, ${hoursStr}:${minutes} ${ampm}`;
}

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
  return formatDate(d);
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

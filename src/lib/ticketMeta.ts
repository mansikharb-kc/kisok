// Ticket channel meta (shared by API + UI). Tickets bounce between OB Exec and
// Consignment User: Sample-request / Fabrication / Damage.

export const TICKET_TYPES = [
  { value: "SAMPLE_REQUEST", label: "Sample Request" },
  { value: "FABRICATION", label: "Fabrication" },
  { value: "DAMAGE", label: "Damage / Re-request" },
  { value: "SPACE_RACK", label: "Space & Rack Request" },
  { value: "KT_REQUEST", label: "Knowledge Transfer Request" },
] as const;

export const TICKET_TYPE_VALUES = TICKET_TYPES.map((t) => t.value);

export function ticketTypeLabel(v: string) {
  return TICKET_TYPES.find((t) => t.value === v)?.label ?? v;
}

export const TICKET_STATUS_LABEL: Record<string, string> = {
  WITH_CONSIGNMENT: "With Consignment",
  WITH_EXEC: "With OB Exec",
  WITH_PROJECT_USER: "With Project User",
  WITH_CONCIERGE: "With Concierge Manager",
  WITH_LEAD: "With Onboarding Lead",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const TICKET_STATUS_BADGE: Record<string, string> = {
  WITH_CONSIGNMENT: "bg-amber-100 text-amber-700",
  WITH_EXEC: "bg-blue-100 text-blue-700",
  WITH_PROJECT_USER: "bg-purple-100 text-purple-700 border border-purple-150",
  WITH_CONCIERGE: "bg-indigo-100 text-indigo-700 border border-indigo-150",
  WITH_LEAD: "bg-orange-100 text-orange-700 border border-orange-150",
  RESOLVED: "bg-emerald-100 text-emerald-700",
  CLOSED: "bg-slate-200 text-slate-600",
};

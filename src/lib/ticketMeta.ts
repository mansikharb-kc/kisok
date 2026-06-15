// Ticket channel meta (shared by API + UI). Tickets bounce between OB Exec and
// Consignment User: Sample-request / Fabrication / Damage.

export const TICKET_TYPES = [
  { value: "SAMPLE_REQUEST", label: "Sample Request" },
  { value: "FABRICATION", label: "Fabrication" },
  { value: "DAMAGE", label: "Damage / Re-request" },
] as const;

export const TICKET_TYPE_VALUES = TICKET_TYPES.map((t) => t.value);

export function ticketTypeLabel(v: string) {
  return TICKET_TYPES.find((t) => t.value === v)?.label ?? v;
}

export const TICKET_STATUS_LABEL: Record<string, string> = {
  WITH_CONSIGNMENT: "With Consignment",
  WITH_EXEC: "With OB Exec",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const TICKET_STATUS_BADGE: Record<string, string> = {
  WITH_CONSIGNMENT: "bg-amber-100 text-amber-700",
  WITH_EXEC: "bg-blue-100 text-blue-700",
  RESOLVED: "bg-emerald-100 text-emerald-700",
  CLOSED: "bg-slate-200 text-slate-600",
};

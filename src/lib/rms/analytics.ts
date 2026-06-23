// RMS analytics — interaction/click-based (NO camera). Phase: P1.7
//
// Dwell-time = gap between consecutive timestamped interaction events.
// Client batches events and POSTs to /api/rms/events; server appends to rms_events,
// a scheduled job pre-aggregates into rollup tables.
//
// TODO: implement
//  - trackEvent(type, payload)   // batches client-side
//  - flush()                     // POST batch to /api/rms/events
// Event types: session_start, category_open, brand_open, product_view, search,
//              bom_add, locate_sample, idle_reset

export type RmsEventType =
  | "session_start"
  | "category_open"
  | "brand_open"
  | "product_view"
  | "search"
  | "bom_add"
  | "locate_sample"
  | "idle_reset";

export {};

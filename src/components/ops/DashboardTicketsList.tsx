"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, CheckCircle, ChevronDown, ChevronUp, Clock, User } from "lucide-react";
import {
  ticketTypeLabel,
  TICKET_STATUS_LABEL,
  TICKET_STATUS_BADGE,
} from "@/lib/ticketMeta";

type TEvent = {
  id: string;
  action: string;
  fromRole: string | null;
  toRole: string | null;
  note: string | null;
  createdAt: string;
};

type Ticket = {
  id: string;
  ticketNo: string | null;
  type: string;
  status: string;
  currentRole: string;
  title: string;
  description: string | null;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
  seller: { name: string; sellerCode: string } | null;
  brand: { name: string } | null;
  events: TEvent[];
};

interface DashboardTicketsListProps {
  tickets: Ticket[];
  userRoles: string[];
}

export default function DashboardTicketsList({ tickets, userRoles }: DashboardTicketsListProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [openThreads, setOpenThreads] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState<Record<string, string>>({});

  const isProjectUser = userRoles.includes("PROJECT_USER");
  const isConciergeManager = userRoles.includes("CONCIERGE_MANAGER");
  const isOBExec = userRoles.includes("OB_EXEC");

  const toggleThread = (id: string) => {
    setOpenThreads((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAction = async (ticketId: string, actionType: "note" | "resolve") => {
    setErrorMsg((prev) => ({ ...prev, [ticketId]: "" }));
    setSuccessMsg((prev) => ({ ...prev, [ticketId]: "" }));
    setBusy((prev) => ({ ...prev, [ticketId]: true }));

    try {
      const payload: any = { action: actionType };
      if (actionType === "note") {
        const noteText = notes[ticketId]?.trim();
        if (!noteText) {
          setErrorMsg((prev) => ({ ...prev, [ticketId]: "Note content cannot be empty." }));
          setBusy((prev) => ({ ...prev, [ticketId]: false }));
          return;
        }
        payload.note = noteText;
      }

      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg((prev) => ({ ...prev, [ticketId]: data.error || "Failed to perform action." }));
        return;
      }

      setSuccessMsg((prev) => ({
        ...prev,
        [ticketId]: actionType === "note" ? "Note added successfully!" : "Ticket resolved successfully!",
      }));
      setNotes((prev) => ({ ...prev, [ticketId]: "" }));
      router.refresh();
    } catch {
      setErrorMsg((prev) => ({ ...prev, [ticketId]: "A network error occurred." }));
    } finally {
      setBusy((prev) => ({ ...prev, [ticketId]: false }));
    }
  };

  if (tickets.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/40 backdrop-blur-md p-10 text-center text-sm text-slate-400">
        No active onboarding request tickets.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tickets.map((t) => {
        const isOpen = openThreads[t.id];
        const isCurrentHolder =
          (t.currentRole === "PROJECT_USER" && isProjectUser) ||
          (t.currentRole === "CONCIERGE_MANAGER" && isConciergeManager);

        const isActive = t.status !== "RESOLVED" && t.status !== "CLOSED";

        return (
          <div
            key={t.id}
            className="rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm transition-all hover:shadow-md"
          >
            {/* Top row */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-white select-all">
                    {t.ticketNo}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                    {ticketTypeLabel(t.type)}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${TICKET_STATUS_BADGE[t.status] || "bg-slate-100 text-slate-700"}`}>
                    {TICKET_STATUS_LABEL[t.status] || t.status}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-850 mt-1.5">{t.title}</h4>
                <p className="text-xs text-slate-500 font-semibold">
                  Seller: <span className="text-slate-700 font-bold">{t.seller?.name || "N/A"}</span>
                  {t.brand && (
                    <>
                      {" · "}
                      Brand: <span className="text-slate-750 font-bold">{t.brand.name}</span>
                    </>
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={() => toggleThread(t.id)}
                className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
              >
                <span>{isOpen ? "Collapse Details" : "View Details & Thread"}</span>
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>

            {/* Error and Success notifications */}
            {errorMsg[t.id] && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3 py-1.5 font-medium mt-3">
                {errorMsg[t.id]}
              </div>
            )}
            {successMsg[t.id] && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3 py-1.5 font-semibold mt-3">
                {successMsg[t.id]}
              </div>
            )}

            {/* Expanded section */}
            {isOpen && (
              <div className="mt-4 border-t border-slate-100 pt-4 space-y-4">
                {/* Description Box */}
                {t.description && (
                  <div className="rounded-xl bg-slate-50/70 border border-slate-150 p-4">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Request Details
                    </span>
                    <pre className="font-sans text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                      {t.description}
                    </pre>
                  </div>
                )}

                {/* Event Log Thread */}
                <div className="space-y-2">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Activity &amp; Discussion Thread
                  </span>
                  <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                    {t.events.length === 0 ? (
                      <span className="text-xs text-slate-400 italic font-medium block">No notes recorded yet.</span>
                    ) : (
                      t.events.map((ev) => (
                        <div key={ev.id} className="text-xs border-b border-slate-50 pb-2 last:border-0 last:pb-0 flex flex-col gap-0.5">
                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-450">
                            <span className="flex items-center gap-1 capitalize">
                              <User className="h-3 w-3 shrink-0" />
                              {ev.fromRole ? ev.fromRole.replace(/_/g, " ") : "System"}
                              {ev.toRole && ` → ${ev.toRole.replace(/_/g, " ")}`}
                            </span>
                            <span className="flex items-center gap-1 font-mono">
                              <Clock className="h-3 w-3 shrink-0" />
                              {new Date(ev.createdAt).toLocaleString(undefined, {
                                dateStyle: "short",
                                timeStyle: "short",
                              })}
                            </span>
                          </div>
                          {ev.note && <p className="text-slate-700 font-medium mt-1">"{ev.note}"</p>}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Actions Form */}
                {isActive && (
                  <div className="flex flex-col gap-3 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Type a note to record in the thread..."
                        value={notes[t.id] ?? ""}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [t.id]: e.target.value }))}
                        className="flex-1 rounded-lg border border-slate-350 px-3 py-1.5 text-xs focus:ring-1 focus:ring-slate-500 bg-white"
                        disabled={!!busy[t.id]}
                      />
                      <button
                        type="button"
                        onClick={() => handleAction(t.id, "note")}
                        disabled={!!busy[t.id] || !notes[t.id]?.trim()}
                        className="rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 px-4 py-1.5 text-xs font-semibold shrink-0 transition"
                      >
                        <MessageSquare className="h-3.5 w-3.5 inline mr-1" />
                        Add Note
                      </button>
                    </div>

                    {isCurrentHolder && (
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => handleAction(t.id, "resolve")}
                          disabled={!!busy[t.id]}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-semibold transition shadow-sm shrink-0"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Resolve Request
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

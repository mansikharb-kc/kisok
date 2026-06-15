"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  TICKET_TYPES,
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
  seller: { name: string; sellerCode: string } | null;
  brand: { name: string } | null;
  record: { product: { name: string; sku: string } } | null;
  events: TEvent[];
};
type SellerOpt = { id: string; name: string; sellerCode: string; brands: { id: string; name: string }[] };

export default function TicketsClient({
  tickets,
  sellers,
  canRaise,
  isExec,
  isConsign,
}: {
  tickets: Ticket[];
  sellers: SellerOpt[];
  canRaise: boolean;
  isExec: boolean;
  isConsign: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [noteText, setNoteText] = useState<Record<string, string>>({});

  // raise form
  const [showRaise, setShowRaise] = useState(false);
  const [rType, setRType] = useState("SAMPLE_REQUEST");
  const [rSeller, setRSeller] = useState("");
  const [rBrand, setRBrand] = useState("");
  const [rTitle, setRTitle] = useState("");
  const [rDesc, setRDesc] = useState("");
  const [rErr, setRErr] = useState("");

  const sellerBrands = useMemo(
    () => sellers.find((s) => s.id === rSeller)?.brands ?? [],
    [sellers, rSeller],
  );

  async function act(id: string, action: string, extra?: Record<string, unknown>) {
    setBusy(true);
    await fetch(`/api/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    setBusy(false);
    setNoteText((p) => ({ ...p, [id]: "" }));
    router.refresh();
  }

  async function raise(e: React.FormEvent) {
    e.preventDefault();
    setRErr("");
    if (!rSeller || !rTitle.trim()) {
      setRErr("Seller and title are required");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: rType,
          sellerId: rSeller,
          brandId: rBrand || null,
          title: rTitle,
          description: rDesc || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRErr(data.error || "Failed to raise ticket");
        return;
      }
      setShowRaise(false);
      setRTitle("");
      setRDesc("");
      setRBrand("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {canRaise && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowRaise(true)}
            className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700"
          >
            + Raise Ticket
          </button>
        </div>
      )}

      {tickets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-400">
          No tickets yet.{canRaise ? " Raise one when you need a sample, fabrication, or report damage." : ""}
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => {
            const open = openThread === t.id;
            const owner = t.currentRole === "OB_EXEC" ? "OB Exec" : "Consignment";
            const active = t.status !== "CLOSED";
            return (
              <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-white">{t.ticketNo}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{ticketTypeLabel(t.type)}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${TICKET_STATUS_BADGE[t.status]}`}>
                        {TICKET_STATUS_LABEL[t.status]}
                      </span>
                      {active && <span className="text-[10px] text-slate-400">· in {owner}'s court</span>}
                    </div>
                    <div className="font-semibold text-slate-800 mt-1">{t.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {t.seller?.name}
                      {t.brand ? ` · ${t.brand.name}` : ""}
                      {t.record ? ` · ${t.record.product.name} (${t.record.product.sku})` : ""}
                    </div>
                  </div>
                  <button onClick={() => setOpenThread(open ? null : t.id)} className="text-xs text-brand-600 hover:underline shrink-0">
                    {open ? "Hide" : `Thread (${t.events.length})`}
                  </button>
                </div>

                {/* Thread */}
                {open && (
                  <div className="mt-3 border-t border-slate-100 pt-3 space-y-2">
                    {t.events.map((ev) => (
                      <div key={ev.id} className="text-xs flex gap-2">
                        <span className="font-medium text-slate-600 capitalize">{ev.action.replace(/_/g, " ")}</span>
                        {ev.fromRole && ev.toRole && (
                          <span className="text-slate-400">{ev.fromRole === "OB_EXEC" ? "Exec" : "Consign"} → {ev.toRole === "OB_EXEC" ? "Exec" : "Consign"}</span>
                        )}
                        {ev.note && <span className="text-slate-600">“{ev.note}”</span>}
                        <span className="ml-auto text-slate-300">{new Date(ev.createdAt).toLocaleString()}</span>
                      </div>
                    ))}
                    {t.resolution && <div className="text-xs text-emerald-700">Resolution: {t.resolution}</div>}
                  </div>
                )}

                {/* Actions */}
                {active && (
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <input
                      value={noteText[t.id] ?? ""}
                      onChange={(e) => setNoteText((p) => ({ ...p, [t.id]: e.target.value }))}
                      placeholder="Add a note…"
                      className="flex-1 min-w-[160px] rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <button onClick={() => act(t.id, "note", { note: noteText[t.id] })} disabled={busy || !(noteText[t.id]?.trim())} className="text-xs text-slate-600 hover:underline disabled:opacity-40">
                      Note
                    </button>

                    {isConsign && t.currentRole === "CONSIGNMENT_USER" && (
                      <button onClick={() => act(t.id, "send_to_exec", { note: noteText[t.id] })} disabled={busy} className="rounded-md bg-blue-600 text-white px-3 py-1.5 text-xs hover:bg-blue-700">
                        Send to Exec →
                      </button>
                    )}
                    {isExec && t.currentRole === "OB_EXEC" && (
                      <button onClick={() => act(t.id, "send_to_consignment", { note: noteText[t.id] })} disabled={busy} className="rounded-md bg-amber-600 text-white px-3 py-1.5 text-xs hover:bg-amber-700">
                        ← Send to Consignment
                      </button>
                    )}
                    {((isExec && t.currentRole === "OB_EXEC") || (isConsign && t.currentRole === "CONSIGNMENT_USER")) && t.status !== "RESOLVED" && (
                      <button onClick={() => act(t.id, "resolve", { note: noteText[t.id] })} disabled={busy} className="rounded-md bg-emerald-600 text-white px-3 py-1.5 text-xs hover:bg-emerald-700">
                        Resolve
                      </button>
                    )}
                    {isExec && (
                      <button onClick={() => act(t.id, "close")} disabled={busy} className="text-xs text-rose-600 hover:underline">
                        Close
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Raise modal */}
      {showRaise && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <form onSubmit={raise} className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold">Raise Ticket</h3>
            {rErr && <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{rErr}</div>}
            <div className="space-y-1">
              <label className="text-sm font-medium">Type</label>
              <select value={rType} onChange={(e) => setRType(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                {TICKET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Seller</label>
              <select value={rSeller} onChange={(e) => { setRSeller(e.target.value); setRBrand(""); }} required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="">Select seller</option>
                {sellers.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.sellerCode})</option>)}
              </select>
            </div>
            {sellerBrands.length > 0 && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Brand (optional)</label>
                <select value={rBrand} onChange={(e) => setRBrand(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                  <option value="">—</option>
                  {sellerBrands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-sm font-medium">Title</label>
              <input value={rTitle} onChange={(e) => setRTitle(e.target.value)} required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. Need 1mm laminate sample" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Details</label>
              <textarea value={rDesc} onChange={(e) => setRDesc(e.target.value)} rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="What's needed / notes…" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowRaise(false)} className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={busy} className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-60">
                {busy ? "Raising…" : "Raise Ticket"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

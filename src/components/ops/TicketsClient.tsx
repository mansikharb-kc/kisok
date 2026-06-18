"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { isNonEmptyString } from "@/lib/validation";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  TICKET_TYPES,
  ticketTypeLabel,
  TICKET_STATUS_LABEL,
  TICKET_STATUS_BADGE,
} from "@/lib/ticketMeta";

const PIPELINE = [
  "initiated",
  "received",
  "in_buffer",
  "fabricating",
  "qc",
  "passed_back",
  "closed",
];

const PIPELINE_LABELS: Record<string, string> = {
  initiated: "Initiated",
  received: "Received",
  in_buffer: "In Buffer",
  fabricating: "Fabricating",
  qc: "In QC",
  passed_back: "Passed Back",
  closed: "Closed",
};

const PIPELINE_ACTION_LABELS: Record<string, string> = {
  received: "Mark Received",
  in_buffer: "Move to Buffer",
  fabricating: "Start Fabrication",
  qc: "Send to QC",
  passed_back: "Pass & Send Back",
  closed: "Close Consignment",
};

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
  onboardingPipeline?: any;
};
type SellerOpt = { id: string; name: string; sellerCode: string; brands: { id: string; name: string }[] };

type ConsignmentItem = {
  id: string;
  description: string | null;
  expectedQty: number | null;
  receivedQty: number | null;
  sampleType: string | null;
  status: string;
};

type Consignment = {
  id: string;
  sellerId: string;
  brandId: string;
  spocName: string | null;
  spocContact: string | null;
  expectedDate: string | null;
  remarks: string | null;
  status: string;
  seller: { name: string; sellerCode: string };
  brand: { name: string };
  items: ConsignmentItem[];
  createdAt: string;
  updatedAt: string;
};

export default function TicketsClient({
  tickets,
  sellers,
  execs = [],
  consignments = [],
  canRaise,
  isExec,
  isConsign,
  isLead = false,
  initialStatus = "",
  initialTab = "tickets",
}: {
  tickets: Ticket[];
  sellers: SellerOpt[];
  execs?: { id: string; fullName: string; email: string }[];
  consignments?: Consignment[];
  canRaise: boolean;
  isExec: boolean;
  isConsign: boolean;
  isLead?: boolean;
  initialStatus?: string;
  initialTab?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [noteText, setNoteText] = useState<Record<string, string>>({});
  const [selectedExec, setSelectedExec] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<"tickets" | "consignments">(initialTab as any);
  const [statusFilter, setStatusFilter] = useState(initialStatus);

  // Consignment Receipt & QC inline inputs
  const [receivedQtyInput, setReceivedQtyInput] = useState<Record<string, number>>({});
  const [qcResultInput, setQcResultInput] = useState<Record<string, string>>({});
  const [qcNotesInput, setQcNotesInput] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<Record<string, string>>({});

  // Pipeline consignment receipt form states
  const [pipelineReceivedDate, setPipelineReceivedDate] = useState<Record<string, string>>({});
  const [pipelineVehicleDetails, setPipelineVehicleDetails] = useState<Record<string, string>>({});
  const [pipelineQtyReceived, setPipelineQtyReceived] = useState<Record<string, string>>({});
  const [pipelineBoxQc, setPipelineBoxQc] = useState<Record<string, string>>({});
  const [pipelinePhotoUrl, setPipelinePhotoUrl] = useState<Record<string, string>>({});
  const [pipelinePackingListDoc, setPipelinePackingListDoc] = useState<Record<string, string>>({});
  const [pipelineRemarks, setPipelineRemarks] = useState<Record<string, string>>({});
  const [pipelineErrors, setPipelineErrors] = useState<Record<string, string>>({});
  const [uploadingPhotoMap, setUploadingPhotoMap] = useState<Record<string, boolean>>({});
  const [uploadingPackingMap, setUploadingPackingMap] = useState<Record<string, boolean>>({});

  async function handlePhotoUpload(ticketId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhotoMap((p) => ({ ...p, [ticketId]: true }));
    setPipelineErrors((p) => ({ ...p, [ticketId]: "" }));
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setPipelineErrors((p) => ({ ...p, [ticketId]: data.error || "Photograph upload failed" }));
        return;
      }
      setPipelinePhotoUrl((p) => ({ ...p, [ticketId]: data.url }));
    } catch {
      setPipelineErrors((p) => ({ ...p, [ticketId]: "Photograph upload failed" }));
    } finally {
      setUploadingPhotoMap((p) => ({ ...p, [ticketId]: false }));
    }
  }

  async function handlePackingUpload(ticketId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPackingMap((p) => ({ ...p, [ticketId]: true }));
    setPipelineErrors((p) => ({ ...p, [ticketId]: "" }));
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setPipelineErrors((p) => ({ ...p, [ticketId]: data.error || "Packing list upload failed" }));
        return;
      }
      setPipelinePackingListDoc((p) => ({ ...p, [ticketId]: data.url }));
    } catch {
      setPipelineErrors((p) => ({ ...p, [ticketId]: "Packing list upload failed" }));
    } finally {
      setUploadingPackingMap((p) => ({ ...p, [ticketId]: false }));
    }
  }

  async function submitPipelineReceipt(ticketId: string) {
    const qty = parseInt(pipelineQtyReceived[ticketId] || "0", 10);
    const boxQc = pipelineBoxQc[ticketId] || "Good";
    const date = pipelineReceivedDate[ticketId] || new Date().toISOString().slice(0, 10);
    const vehicle = pipelineVehicleDetails[ticketId] || "";
    const photo = pipelinePhotoUrl[ticketId] || "";
    const packingList = pipelinePackingListDoc[ticketId] || "";
    const remarks = pipelineRemarks[ticketId] || "";

    setBusy(true);
    setPipelineErrors((p) => ({ ...p, [ticketId]: "" }));
    try {
      const res = await fetch(`/api/tickets/${ticketId}/receive-consignment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receivedDate: date,
          vehicleDetails: vehicle,
          quantityReceived: qty,
          boxQc,
          photographUrl: photo,
          packingListDoc: packingList,
          consignmentRemarks: remarks,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setPipelineErrors((p) => ({ ...p, [ticketId]: data.error || "Failed to receive consignment" }));
        return;
      }

      setPipelineReceivedDate((p) => ({ ...p, [ticketId]: "" }));
      setPipelineVehicleDetails((p) => ({ ...p, [ticketId]: "" }));
      setPipelineQtyReceived((p) => ({ ...p, [ticketId]: "" }));
      setPipelineBoxQc((p) => ({ ...p, [ticketId]: "" }));
      setPipelinePhotoUrl((p) => ({ ...p, [ticketId]: "" }));
      setPipelinePackingListDoc((p) => ({ ...p, [ticketId]: "" }));
      setPipelineRemarks((p) => ({ ...p, [ticketId]: "" }));
      router.refresh();
    } catch {
      setPipelineErrors((p) => ({ ...p, [ticketId]: "A network error occurred." }));
    } finally {
      setBusy(false);
    }
  }

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

  // 1. Advance consignment status
  async function advanceConsignment(consignmentId: string, nextStatus: string) {
    setBusy(true);
    setActionError((p) => ({ ...p, [consignmentId]: "" }));
    try {
      const res = await fetch(`/api/consignments/${consignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError((p) => ({ ...p, [consignmentId]: data.error || "Failed to update status" }));
        return;
      }
      router.refresh();
    } catch {
      setActionError((p) => ({ ...p, [consignmentId]: "Network error" }));
    } finally {
      setBusy(false);
    }
  }

  // 2. Save received quantity
  async function saveReceivedQty(itemId: string, qty: number) {
    setBusy(true);
    setActionError((p) => ({ ...p, [itemId]: "" }));
    try {
      const res = await fetch(`/api/consignment-items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receivedQty: qty }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError((p) => ({ ...p, [itemId]: data.error || "Failed to save quantity" }));
        return;
      }
      router.refresh();
    } catch {
      setActionError((p) => ({ ...p, [itemId]: "Network error" }));
    } finally {
      setBusy(false);
    }
  }

  // 3. Submit QC check
  async function submitQc(itemId: string) {
    const result = qcResultInput[itemId] || "pass";
    const notes = qcNotesInput[itemId] || "";
    setBusy(true);
    setActionError((p) => ({ ...p, [itemId]: "" }));
    try {
      const res = await fetch(`/api/consignment-items/${itemId}/qc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result, notes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError((p) => ({ ...p, [itemId]: data.error || "QC failed" }));
        return;
      }
      setQcNotesInput((p) => ({ ...p, [itemId]: "" }));
      router.refresh();
    } catch {
      setActionError((p) => ({ ...p, [itemId]: "Network error" }));
    } finally {
      setBusy(false);
    }
  }

  async function raise(e: React.FormEvent) {
    e.preventDefault();
    setRErr("");
    if (!isNonEmptyString(rSeller) || !isNonEmptyString(rTitle)) {
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

  const filteredConsignments = useMemo(() => {
    if (!statusFilter) return consignments;
    return consignments.filter((c) => c.status === statusFilter);
  }, [consignments, statusFilter]);

  return (
    <div className="space-y-5">
      {/* Tabs Switcher */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("tickets")}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-all ${activeTab === "tickets"
              ? "border-brand-600 text-brand-600 bg-brand-50/10"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`}
        >
          Tickets ({tickets.length})
        </button>
        <button
          onClick={() => setActiveTab("consignments")}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-all ${activeTab === "consignments"
              ? "border-brand-600 text-brand-600 bg-brand-50/10"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`}
        >
          Consignments ({consignments.length})
        </button>
      </div>

      {activeTab === "tickets" ? (
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
            <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 backdrop-blur-md p-12 text-center text-sm text-slate-400">
              No tickets yet.{canRaise ? " Raise one when you need a sample, fabrication, or report damage." : ""}
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((t) => {
                const open = openThread === t.id;
                const owner = t.currentRole === "OB_EXEC" ? "OB Exec" : "Consignment";
                const active = t.status !== "CLOSED";
                return (
                  <div key={t.id} className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-4">
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
                            {ev.note && <span className="text-slate-600">"{ev.note}"</span>}
                            <span className="ml-auto text-slate-300">{formatDateTime(ev.createdAt)}</span>
                          </div>
                        ))}
                        {t.resolution && <div className="text-xs text-emerald-700">Resolution: {t.resolution}</div>}
                      </div>
                    )}

                    {/* Onboarding Pipeline Info Details for Consignment User */}
                    {t.onboardingPipeline && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-3 space-y-3">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Onboarding Pipeline Details
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs text-slate-600">
                          <div>
                            <span className="font-semibold text-slate-400 block mb-0.5">Sample Target List</span>
                            <span className="text-slate-800 font-medium">{t.onboardingPipeline.itemTarget || "—"}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-400 block mb-0.5">Next Action Time</span>
                            <span className="text-slate-800 font-medium">{t.onboardingPipeline.nextActionTime || "—"}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-400 block mb-0.5">Remarks</span>
                            <span className="text-slate-800 font-medium">{t.onboardingPipeline.remarks || "—"}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    {active && (
                      <div className="mt-3 flex items-center gap-2 flex-wrap w-full">
                        <input
                          value={noteText[t.id] ?? ""}
                          onChange={(e) => setNoteText((p) => ({ ...p, [t.id]: e.target.value }))}
                          placeholder="Add a note..."
                          className="flex-1 min-w-[160px] rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                        <button onClick={() => act(t.id, "note", { note: noteText[t.id] })} disabled={busy || !(noteText[t.id]?.trim())} className="text-xs text-slate-600 hover:underline disabled:opacity-40 mr-2">
                          Note
                        </button>

                        {isConsign && t.currentRole === "CONSIGNMENT_USER" && (
                          t.onboardingPipeline ? (
                            <details className="group mt-3 w-full">
                              <summary className="cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden flex items-center justify-start py-1">
                                <div className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-55 px-3.5 py-2 text-xs font-semibold text-indigo-900 shadow-sm transition active:scale-[0.98] select-none">
                                  <span className="group-open:hidden">Record Consignment Receipt</span>
                                  <span className="hidden group-open:inline">Hide Receipt Form</span>
                                  <svg className="w-3.5 h-3.5 transform group-open:rotate-180 transition-transform duration-200 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                  </svg>
                                </div>
                              </summary>
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  submitPipelineReceipt(t.id);
                                }}
                                className="w-full bg-indigo-50/50 border border-indigo-150 rounded-xl p-4 mt-3 space-y-4"
                              >
                                <div>
                                  <h4 className="font-bold text-indigo-900 text-xs uppercase tracking-wider">Record Consignment Receipt</h4>
                                  <p className="text-[11px] text-indigo-650 mt-0.5">Please fill out details of the received brand package to advance the pipeline.</p>
                                </div>

                                {pipelineErrors[t.id] && (
                                  <div className="rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3 py-1.5 font-medium">
                                    {pipelineErrors[t.id]}
                                  </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                                  <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 font-semibold">Date Received</label>
                                    <input
                                      type="date"
                                      value={pipelineReceivedDate[t.id] || new Date().toISOString().slice(0, 10)}
                                      onChange={(e) => setPipelineReceivedDate((p) => ({ ...p, [t.id]: e.target.value }))}
                                      required
                                      className="w-full rounded border border-slate-350 px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-brand-500 bg-white"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 font-semibold">Vehicle Details</label>
                                    <input
                                      type="text"
                                      placeholder="e.g. KA-01-MX-1234"
                                      value={pipelineVehicleDetails[t.id] || ""}
                                      onChange={(e) => setPipelineVehicleDetails((p) => ({ ...p, [t.id]: e.target.value }))}
                                      className="w-full rounded border border-slate-350 px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-brand-500 bg-white"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 font-semibold">Quantity Received</label>
                                    <input
                                      type="number"
                                      min="0"
                                      required
                                      value={pipelineQtyReceived[t.id] ?? ""}
                                      onChange={(e) => setPipelineQtyReceived((p) => ({ ...p, [t.id]: e.target.value }))}
                                      className="w-full rounded border border-slate-350 px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-brand-500 bg-white no-spinner"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 font-semibold">QC of the Box</label>
                                    <select
                                      value={pipelineBoxQc[t.id] || "Good"}
                                      onChange={(e) => setPipelineBoxQc((p) => ({ ...p, [t.id]: e.target.value }))}
                                      className="w-full rounded border border-slate-350 px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 bg-white cursor-pointer font-semibold"
                                    >
                                      <option value="Good">Good / Intact</option>
                                      <option value="Scratched">Scratched</option>
                                      <option value="Damaged">Damaged / Open</option>
                                      <option value="Incomplete">Incomplete Items</option>
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 font-semibold">Photograph Reference</label>
                                    <div className="flex gap-2">
                                      <input
                                        type="text"
                                        placeholder="e.g. DSC_1092.jpg"
                                        value={pipelinePhotoUrl[t.id] || ""}
                                        onChange={(e) => setPipelinePhotoUrl((p) => ({ ...p, [t.id]: e.target.value }))}
                                        className="flex-1 rounded border border-slate-350 px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-brand-500 bg-white"
                                      />
                                      <label className={`cursor-pointer rounded border border-slate-300 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 flex items-center justify-center shrink-0 shadow-sm transition active:scale-[0.98] ${uploadingPhotoMap[t.id] ? "opacity-60 cursor-not-allowed" : ""}`}>
                                        {uploadingPhotoMap[t.id] ? "Uploading..." : "Upload File"}
                                        <input
                                          type="file"
                                          accept="image/*,application/pdf"
                                          onChange={(e) => handlePhotoUpload(t.id, e)}
                                          className="hidden"
                                          disabled={!!uploadingPhotoMap[t.id]}
                                        />
                                      </label>
                                    </div>
                                    {pipelinePhotoUrl[t.id] && (
                                      <div className="mt-1 flex items-center gap-2">
                                        {pipelinePhotoUrl[t.id].startsWith("/api/uploads/") ? (
                                          <a
                                            href={pipelinePhotoUrl[t.id]}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-brand-600 hover:text-brand-850 hover:underline font-semibold text-[11px] flex items-center gap-1"
                                          >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                            View Photo
                                          </a>
                                        ) : (
                                          <span className="text-slate-500 text-[11px] italic">Ref: {pipelinePhotoUrl[t.id]}</span>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => setPipelinePhotoUrl((p) => ({ ...p, [t.id]: "" }))}
                                          className="text-red-500 hover:text-red-700 font-semibold text-[11px]"
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 font-semibold">Packing List Doc</label>
                                    <div className="flex gap-2">
                                      <input
                                        type="text"
                                        placeholder="e.g. PKG-551.pdf"
                                        value={pipelinePackingListDoc[t.id] || ""}
                                        onChange={(e) => setPipelinePackingListDoc((p) => ({ ...p, [t.id]: e.target.value }))}
                                        className="flex-1 rounded border border-slate-350 px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-brand-500 bg-white"
                                      />
                                      <label className={`cursor-pointer rounded border border-slate-300 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 flex items-center justify-center shrink-0 shadow-sm transition active:scale-[0.98] ${uploadingPackingMap[t.id] ? "opacity-60 cursor-not-allowed" : ""}`}>
                                        {uploadingPackingMap[t.id] ? "Uploading..." : "Upload File"}
                                        <input
                                          type="file"
                                          accept="application/pdf,image/*"
                                          onChange={(e) => handlePackingUpload(t.id, e)}
                                          className="hidden"
                                          disabled={!!uploadingPackingMap[t.id]}
                                        />
                                      </label>
                                    </div>
                                    {pipelinePackingListDoc[t.id] && (
                                      <div className="mt-1 flex items-center gap-2">
                                        {pipelinePackingListDoc[t.id].startsWith("/api/uploads/") ? (
                                          <a
                                            href={pipelinePackingListDoc[t.id]}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-brand-600 hover:text-brand-850 hover:underline font-semibold text-[11px] flex items-center gap-1"
                                          >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                            View Packing List
                                          </a>
                                        ) : (
                                          <span className="text-slate-500 text-[11px] italic">Ref: {pipelinePackingListDoc[t.id]}</span>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => setPipelinePackingListDoc((p) => ({ ...p, [t.id]: "" }))}
                                          className="text-red-500 hover:text-red-700 font-semibold text-[11px]"
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  <div className="sm:col-span-2 md:col-span-3">
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 font-semibold">Receipt Remarks</label>
                                    <textarea
                                      rows={2}
                                      placeholder="Remarks on the consignment..."
                                      value={pipelineRemarks[t.id] || ""}
                                      onChange={(e) => setPipelineRemarks((p) => ({ ...p, [t.id]: e.target.value }))}
                                      className="w-full rounded border border-slate-350 px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-brand-500 bg-white"
                                    />
                                  </div>
                                </div>

                                <div className="flex justify-end pt-1">
                                  <button
                                    type="submit"
                                    disabled={busy}
                                    className="rounded bg-indigo-600 text-white px-4 py-2 text-xs font-semibold hover:bg-indigo-700 transition disabled:opacity-60 shadow-sm"
                                  >
                                    {busy ? "Submitting..." : "Push Ticket: Consignment Received"}
                                  </button>
                                </div>
                              </form>
                            </details>
                          ) : (
                            <button onClick={() => act(t.id, "send_to_exec", { note: noteText[t.id] })} disabled={busy} className="rounded-md bg-blue-600 text-white px-3 py-1.5 text-xs hover:bg-blue-700">
                              Send to Exec →
                            </button>
                          )
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
                        {isLead && execs.length > 0 && (
                          <div className="flex items-center gap-2 border border-slate-200 rounded-md p-1 bg-slate-50">
                            <select
                              value={selectedExec[t.id] ?? ""}
                              onChange={(e) => setSelectedExec((p) => ({ ...p, [t.id]: e.target.value }))}
                              className="rounded border border-slate-300 px-2 py-1 text-xs outline-none bg-white/60 backdrop-blur-md font-medium text-slate-700"
                            >
                              <option value="">Transfer to Exec...</option>
                              {execs.map((ex) => (
                                <option key={ex.id} value={ex.id}>{ex.fullName} ({ex.email})</option>
                              ))}
                            </select>
                            <button
                              onClick={() => act(t.id, "transfer", { targetExecId: selectedExec[t.id], note: noteText[t.id] })}
                              disabled={busy || !selectedExec[t.id]}
                              className="rounded bg-indigo-600 text-white px-2.5 py-1 text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                            >
                              Assign -&gt;
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Status Filter Bar */}
          <div className="flex items-center justify-between gap-4 bg-white/60 backdrop-blur-md p-4 rounded-xl border border-slate-200 shadow-sm flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status Filter:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-750 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
              >
                <option value="">All Consignments ({consignments.length})</option>
                <option value="initiated">Initiated ({consignments.filter(c => c.status === "initiated").length})</option>
                <option value="received">Received ({consignments.filter(c => c.status === "received").length})</option>
                <option value="in_buffer">In Buffer ({consignments.filter(c => c.status === "in_buffer").length})</option>
                <option value="fabricating">Fabricating ({consignments.filter(c => c.status === "fabricating").length})</option>
                <option value="qc">In QC ({consignments.filter(c => c.status === "qc").length})</option>
                <option value="passed_back">Passed Back ({consignments.filter(c => c.status === "passed_back").length})</option>
                <option value="closed">Closed ({consignments.filter(c => c.status === "closed").length})</option>
              </select>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              Showing {filteredConsignments.length} of {consignments.length} consignments
            </span>
          </div>

          {filteredConsignments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 backdrop-blur-md p-12 text-center text-sm text-slate-400">
              No consignments matching the selected status filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredConsignments.map((c) => (
                <div key={c.id} className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <div className="text-sm font-bold text-slate-800">{c.seller.name}</div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">{c.seller.sellerCode} · Brand: {c.brand.name}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {isConsign && c.status !== "closed" && (
                        (() => {
                          const idx = PIPELINE.indexOf(c.status);
                          const next = PIPELINE[idx + 1];
                          const actionLabel = PIPELINE_ACTION_LABELS[next] ?? "Advance";
                          return (
                            <button
                              onClick={() => advanceConsignment(c.id, next)}
                              disabled={busy}
                              className="rounded bg-indigo-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-indigo-750 transition-colors disabled:opacity-50"
                            >
                              {busy ? "Updating..." : `${actionLabel} ->`}
                            </button>
                          );
                        })()
                      )}
                      <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold border ${c.status === "qc" ? "bg-purple-50 text-purple-700 border-purple-200" :
                          c.status === "passed_back" || c.status === "closed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            "bg-blue-55 text-blue-700 border-blue-200"
                        }`}>
                        {PIPELINE_LABELS[c.status] ?? c.status.replace(/_/g, " ")}
                      </span>
                      {c.expectedDate && (
                        <span className="text-xs text-slate-500">Expected: {formatDate(c.expectedDate)}</span>
                      )}
                    </div>
                  </div>

                  {actionError[c.id] && (
                    <div className="text-xs text-rose-600 font-semibold bg-rose-50 border border-rose-100 rounded px-2.5 py-1">
                      {actionError[c.id]}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs text-slate-600">
                    <div>
                      <span className="font-semibold text-slate-400 block mb-0.5">SPOC Name</span>
                      <span className="text-slate-800 font-medium">{c.spocName || "—"}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-400 block mb-0.5">SPOC Contact</span>
                      <span className="text-slate-800 font-medium font-mono">{c.spocContact || "—"}</span>
                    </div>
                    {c.remarks && (
                      <div className="sm:col-span-2 md:col-span-1">
                        <span className="font-semibold text-slate-400 block mb-0.5">Remarks</span>
                        <span className="text-slate-800 italic">"{c.remarks}"</span>
                      </div>
                    )}
                  </div>

                  {c.items.length > 0 && (
                    <div className="bg-slate-50 rounded-lg border border-slate-100 p-3.5 space-y-2">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Consigned Items ({c.items.length})</div>
                      <div className="divide-y divide-slate-100">
                        {c.items.map((it) => (
                          <div key={it.id} className="py-2.5 flex flex-col gap-2 text-xs">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <span className="font-medium text-slate-700">{it.description || "Unlabeled item"}</span>
                                {it.sampleType && <span className="text-[10px] text-slate-400 ml-1.5 font-semibold px-1 py-0.5 bg-slate-200/50 rounded">{it.sampleType}</span>}
                              </div>
                              <div className="flex items-center gap-3 text-[11px]">
                                {isConsign && c.status !== "closed" ? (
                                  <div className="flex items-center gap-1">
                                    <span className="text-slate-400">Qty:</span>
                                    <input
                                      type="number"
                                      min={0}
                                      value={receivedQtyInput[it.id] !== undefined ? receivedQtyInput[it.id] : (it.receivedQty ?? 0)}
                                      onChange={(e) => {
                                        const v = parseInt(e.target.value || "0", 10);
                                        setReceivedQtyInput((p) => ({ ...p, [it.id]: v }));
                                      }}
                                      disabled={busy}
                                      className="w-12 rounded border border-slate-350 px-1 py-0.5 text-center focus:ring-1 focus:ring-brand-500 font-semibold no-spinner"
                                    />
                                    <span className="text-slate-400">/ {it.expectedQty ?? 0}</span>
                                    {receivedQtyInput[it.id] !== undefined && receivedQtyInput[it.id] !== (it.receivedQty ?? 0) && (
                                      <button
                                        onClick={() => saveReceivedQty(it.id, receivedQtyInput[it.id])}
                                        disabled={busy}
                                        className="ml-1 text-[10px] text-brand-600 font-bold bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded px-1.5 py-0.5"
                                      >
                                        Save
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-400">Qty: <strong className="text-slate-700">{it.receivedQty ?? 0}</strong> / {it.expectedQty ?? 0}</span>
                                )}
                                <span className={`px-2 py-0.5 border rounded font-semibold text-[10px] uppercase ${it.status === "passed" ? "bg-emerald-50 text-emerald-700 border-emerald-150" :
                                    it.status === "flagged" ? "bg-rose-50 text-rose-700 border-rose-150" :
                                      "bg-slate-100 text-slate-500 border-slate-200"
                                  }`}>{it.status}</span>
                              </div>
                            </div>

                            {/* QC Form inside QC Stage */}
                            {isConsign && c.status === "qc" && it.status === "pending" && (
                              <div className="mt-1 bg-purple-50/40 p-2.5 rounded-lg border border-purple-100 flex flex-wrap items-center gap-3 w-full">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-bold text-purple-700 uppercase">QC Result:</span>
                                  <select
                                    value={qcResultInput[it.id] || "pass"}
                                    onChange={(e) => setQcResultInput((p) => ({ ...p, [it.id]: e.target.value }))}
                                    className="rounded border border-purple-200 px-2 py-1 text-xs bg-white/60 backdrop-blur-md focus:outline-none"
                                  >
                                    <option value="pass"> Pass</option>
                                    <option value="flag"> Flag</option>
                                    <option value="repair"> Repair</option>
                                    <option value="fabricate"> Fabricate</option>
                                  </select>
                                </div>
                                <input
                                  type="text"
                                  placeholder="Notes (optional)..."
                                  value={qcNotesInput[it.id] || ""}
                                  onChange={(e) => setQcNotesInput((p) => ({ ...p, [it.id]: e.target.value }))}
                                  className="flex-1 min-w-[120px] rounded border border-purple-250 px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white/60 backdrop-blur-md"
                                />
                                <button
                                  onClick={() => submitQc(it.id)}
                                  disabled={busy}
                                  className="rounded bg-purple-600 text-white px-3 py-1 text-xs font-semibold hover:bg-purple-700 transition-colors"
                                >
                                  {busy ? "Submitting..." : "Submit QC"}
                                </button>
                                {actionError[it.id] && (
                                  <div className="w-full text-[10px] text-rose-600 font-semibold">{actionError[it.id]}</div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Raise modal */}
      {showRaise && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <form onSubmit={raise} className="bg-white/60 backdrop-blur-md rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
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
              <textarea value={rDesc} onChange={(e) => setRDesc(e.target.value)} rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="What's needed / notes..." />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowRaise(false)} className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={busy} className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-60">
                {busy ? "Raising..." : "Raise Ticket"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

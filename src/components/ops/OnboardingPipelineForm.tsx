"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Send, Package, CheckCircle2, ChevronRight, HelpCircle } from "lucide-react";

interface OnboardingPipelineFormProps {
  assignmentId: string;
  pipeline: any;
  brands: { id: string; name: string; code: string }[];
}

function formatToDDMMMYYYY(dateStr: Date | string | null | undefined): string {
  if (!dateStr) return "";
  
  if (dateStr instanceof Date) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = String(dateStr.getDate()).padStart(2, "0");
    const month = months[dateStr.getMonth()];
    const year = dateStr.getFullYear();
    return `${day}-${month}-${year}`;
  }

  const cleanStr = String(dateStr).trim();
  
  // Case 1: YYYY-MM-DD format (e.g. 2026-07-26)
  let match = cleanStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [_, y, m, d] = match;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mName = months[parseInt(m, 10) - 1] ?? m;
    return `${d.padStart(2, "0")}-${mName}-${y}`;
  }

  // Case 2: DD/MM/YYYY or DD-MM-YYYY format (e.g. 26/07/2026 or 26-07-2026)
  match = cleanStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    const [_, d, m, y] = match;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mName = months[parseInt(m, 10) - 1] ?? m;
    return `${d.padStart(2, "0")}-${mName}-${y}`;
  }

  // Case 3: YYYY-MM-DD followed by time (e.g. 2026-07-26 14:00:00 or similar)
  match = cleanStr.match(/^(\d{4})-(\d{2})-(\d{2})\b(.*)$/);
  if (match) {
    const [_, y, m, d, rest] = match;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mName = months[parseInt(m, 10) - 1] ?? m;
    return `${d.padStart(2, "0")}-${mName}-${y}${rest}`;
  }

  // Case 4: DD/MM/YYYY followed by time (e.g. 26/07/2026, 2:00 PM)
  match = cleanStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b(.*)$/);
  if (match) {
    const [_, d, m, y, rest] = match;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mName = months[parseInt(m, 10) - 1] ?? m;
    return `${d.padStart(2, "0")}-${mName}-${y}${rest}`;
  }

  // Fallback: If it matches generic JS Date parsing
  const d = new Date(cleanStr);
  if (!isNaN(d.getTime())) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = String(d.getDate()).padStart(2, "0");
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  }

  return dateStr;
}

export default function OnboardingPipelineForm({
  assignmentId,
  pipeline,
  brands,
}: OnboardingPipelineFormProps) {
  const router = useRouter();

  // Initiation form fields state
  const [discussionDone, setDiscussionDone] = useState(pipeline.discussionDone ?? false);
  const [docAttached, setDocAttached] = useState(pipeline.docAttached ?? "");
  const [itemTarget, setItemTarget] = useState(pipeline.itemTarget ?? "");
  const [nextActionTime, setNextActionTime] = useState(formatToDDMMMYYYY(pipeline.nextActionTime) ?? "");
  const [remarks, setRemarks] = useState(pipeline.remarks ?? "");
  const [dateToRevisit, setDateToRevisit] = useState(formatToDDMMMYYYY(pipeline.dateToRevisit) ?? "");
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadingTarget, setUploadingTarget] = useState(false);

  async function handleDocUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDoc(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "File upload failed");
        return;
      }
      setDocAttached(data.url);
    } catch {
      setError("File upload failed");
    } finally {
      setUploadingDoc(false);
    }
  }

  async function handleTargetUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingTarget(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "File upload failed");
        return;
      }
      setItemTarget(data.url);
    } catch {
      setError("File upload failed");
    } finally {
      setUploadingTarget(false);
    }
  }

  // Verification checkbox state
  const [execVerified, setExecVerified] = useState(pipeline.execVerified ?? false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const status = pipeline.status; // INITIATION | TICKET_RAISED | CONSIGNMENT_RECEIVED | CLOSED

  async function handleAction(actionType: "save-initiation" | "raise-ticket" | "verify-consignment") {
    setError("");
    setSuccessMsg("");

    if (actionType === "raise-ticket") {
      if (!discussionDone) {
        setError("Please complete the discussion with the brand before raising a ticket.");
        return;
      }
      if (!itemTarget.trim()) {
        setError("Please specify the target items list before raising a ticket.");
        return;
      }
    }

    if (actionType === "verify-consignment" && !execVerified) {
      setError("Please check 'Received Consignment' to verify receipt.");
      return;
    }

    setBusy(true);

    try {
      const payload: any = { action: actionType };
      if (actionType === "save-initiation" || actionType === "raise-ticket") {
        payload.discussionDone = discussionDone;
        payload.docAttached = docAttached;
        payload.itemTarget = itemTarget;
        payload.nextActionTime = nextActionTime;
        payload.remarks = remarks;
        payload.dateToRevisit = dateToRevisit;
        payload.brandId = brandId;
      }

      const res = await fetch(`/api/assignments/${assignmentId}/pipeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Action failed");
        return;
      }

      setSuccessMsg(
        actionType === "save-initiation"
          ? "Initiation details saved successfully!"
          : actionType === "raise-ticket"
          ? "Ticket successfully raised to consignment user!"
          : "Consignment successfully verified and closed!"
      );
      router.refresh();
    } catch {
      setError("A network error occurred.");
    } finally {
      setBusy(false);
    }
  }

  // Visual steps
  const steps = [
    { key: "INITIATION", label: "Initiation", desc: "Discuss & Plan", icon: Check },
    { key: "TICKET_RAISED", label: "Sample Request", desc: "Awaiting Warehouse", icon: Send },
    { key: "CONSIGNMENT_RECEIVED", label: "Receipt & QC", desc: "Warehouse Received", icon: Package },
    { key: "CLOSED", label: "Verification", desc: "Ready to Onboard", icon: CheckCircle2 },
  ];

  const getStepStatusOrder = (stepKey: string) => {
    const statusOrder = ["INITIATION", "TICKET_RAISED", "CONSIGNMENT_RECEIVED", "CLOSED"];
    const currentIdx = statusOrder.indexOf(status);
    const stepIdx = statusOrder.indexOf(stepKey);

    if (currentIdx > stepIdx) return "completed";
    if (currentIdx === stepIdx) return "active";
    return "pending";
  };

  const cardStyle = "bg-white/60 backdrop-blur-md rounded-2xl border border-slate-200 p-6 shadow-sm";

  return (
    <details className="group space-y-3" open>
      <summary className="flex items-center justify-between cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden hover:opacity-85 transition-opacity py-1">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold text-slate-800">Onboarding Pipeline</h2>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
              status === "CLOSED"
                ? "bg-emerald-50 text-emerald-700 border-emerald-250"
                : status === "CONSIGNMENT_RECEIVED"
                ? "bg-indigo-50 text-indigo-700 border-indigo-255"
                : "bg-brand-50 text-brand-700 border-brand-200 animate-pulse"
            }`}
          >
            Stage: {status.replace(/_/g, " ")}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-800 transition-colors">
          <span className="group-open:hidden">Expand</span>
          <span className="hidden group-open:inline">Collapse</span>
          <svg className="w-4 h-4 transform group-open:rotate-180 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </summary>
      <div className="space-y-6 pt-1">
        {/* Visual Pipeline Tracker */}
        <div className={`${cardStyle} py-4 px-6`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {steps.map((step, idx) => {
            const stepStatus = getStepStatusOrder(step.key);
            const Icon = step.icon;

            return (
              <div key={step.key} className="flex-1 flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center border transition-all ${
                      stepStatus === "completed"
                        ? "bg-emerald-50 border-emerald-300 text-emerald-600 shadow-xs"
                        : stepStatus === "active"
                        ? "bg-brand-50 border-brand-300 text-brand-600 shadow-sm font-bold scale-105"
                        : "bg-slate-50 border-slate-200 text-slate-400"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div
                      className={`text-xs font-bold ${
                        stepStatus === "active" ? "text-slate-900" : "text-slate-500"
                      }`}
                    >
                      {step.label}
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium leading-none mt-0.5">
                      {step.desc}
                    </div>
                  </div>
                </div>
                {idx < steps.length - 1 && (
                  <ChevronRight className="hidden md:block h-4 w-4 text-slate-300 ml-auto shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* State details & interactive form card */}
      <div className={cardStyle}>
        <div className="border-b border-slate-100 pb-3 mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-950 text-sm">Onboarding Pipeline Stage</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {status === "INITIATION" && "Initiate discussion and prepare consignment request"}
              {status === "TICKET_RAISED" && "Consignment ticket raised, awaiting arrival at warehouse"}
              {status === "CONSIGNMENT_RECEIVED" && "Consignment received by warehouse, pending executive verification"}
              {status === "CLOSED" && "Onboarding pipeline complete. Proceed to onboard products"}
            </p>
          </div>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
              status === "CLOSED"
                ? "bg-emerald-50 text-emerald-700 border-emerald-250"
                : status === "CONSIGNMENT_RECEIVED"
                ? "bg-indigo-50 text-indigo-700 border-indigo-255"
                : "bg-brand-50 text-brand-700 border-brand-200 animate-pulse"
            }`}
          >
            {status.replace(/_/g, " ")}
          </span>
        </div>

        {error && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3 py-2 font-medium mb-4">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3 py-2 font-semibold mb-4">
            {successMsg}
          </div>
        )}

        {/* Phase 1: Initiation Form */}
        {status === "INITIATION" && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                <input
                  type="checkbox"
                  id="discussCheck"
                  checked={discussionDone}
                  onChange={(e) => setDiscussionDone(e.target.checked)}
                  className="rounded border-slate-355 h-4 w-4 text-brand-600 focus:ring-brand-500 cursor-pointer"
                />
                <label htmlFor="discussCheck" className="font-semibold text-slate-700 cursor-pointer">
                  Discussion with Brand Done
                </label>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Document Attached (e.g. MoU Ref)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. MoU-Kohler-2026.pdf"
                    value={docAttached}
                    onChange={(e) => setDocAttached(e.target.value)}
                    className="flex-1 rounded border border-slate-350 px-2.5 py-1.5 focus:ring-1 focus:ring-brand-500 bg-white"
                  />
                  <label className={`cursor-pointer rounded border border-slate-300 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 flex items-center justify-center shrink-0 shadow-sm transition active:scale-[0.98] ${uploadingDoc ? "opacity-60 cursor-not-allowed" : ""}`}>
                    {uploadingDoc ? "Uploading..." : "Upload File"}
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={handleDocUpload}
                      className="hidden"
                      disabled={uploadingDoc}
                    />
                  </label>
                </div>
                {docAttached && (
                  <div className="mt-1 flex items-center gap-2">
                    {docAttached.startsWith("/api/uploads/") ? (
                      <a
                        href={docAttached}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-600 hover:text-brand-850 hover:underline font-semibold text-[11px] flex items-center gap-1"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        View Uploaded Document
                      </a>
                    ) : (
                      <span className="text-slate-500 text-[11px] italic">Ref: {docAttached}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setDocAttached("")}
                      className="text-red-500 hover:text-red-700 font-semibold text-[11px]"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Item Target List
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. 5 taps, 2 showertrays, swatches"
                    value={itemTarget}
                    onChange={(e) => setItemTarget(e.target.value)}
                    required
                    className="flex-1 rounded border border-slate-350 px-2.5 py-1.5 focus:ring-1 focus:ring-brand-500 bg-white font-medium"
                  />
                  <label className={`cursor-pointer rounded border border-slate-300 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 flex items-center justify-center shrink-0 shadow-sm transition active:scale-[0.98] ${uploadingTarget ? "opacity-60 cursor-not-allowed" : ""}`}>
                    {uploadingTarget ? "Uploading..." : "Upload File"}
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={handleTargetUpload}
                      className="hidden"
                      disabled={uploadingTarget}
                    />
                  </label>
                </div>
                {itemTarget && (
                  <div className="mt-1 flex items-center gap-2">
                    {itemTarget.startsWith("/api/uploads/") ? (
                      <a
                        href={itemTarget}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-600 hover:text-brand-850 hover:underline font-semibold text-[11px] flex items-center gap-1"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        View Target List File
                      </a>
                    ) : (
                      <span className="text-slate-500 text-[11px] italic">Target: {itemTarget}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setItemTarget("")}
                      className="text-red-500 hover:text-red-700 font-semibold text-[11px]"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Next Action Time
                </label>
                <input
                  type="text"
                  placeholder="e.g. 25-Jun-2026, 2:00 PM"
                  value={nextActionTime}
                  onChange={(e) => setNextActionTime(e.target.value)}
                  onBlur={() => setNextActionTime(formatToDDMMMYYYY(nextActionTime))}
                  className="w-full rounded border border-slate-350 px-2.5 py-1.5 focus:ring-1 focus:ring-brand-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Date to Revisit
                </label>
                <input
                  type="text"
                  placeholder="e.g. 30-Jun-2026"
                  value={dateToRevisit}
                  onChange={(e) => setDateToRevisit(e.target.value)}
                  onBlur={() => setDateToRevisit(formatToDDMMMYYYY(dateToRevisit))}
                  className="w-full rounded border border-slate-350 px-2.5 py-1.5 focus:ring-1 focus:ring-brand-500 bg-white"
                />
              </div>

              {brands.length > 1 ? (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Select Target Brand
                  </label>
                  <select
                    value={brandId}
                    onChange={(e) => setBrandId(e.target.value)}
                    className="w-full rounded border border-slate-350 px-2.5 py-1.5 focus:ring-1 focus:ring-brand-500 bg-white cursor-pointer font-semibold"
                  >
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
              ) : brands.length === 1 ? (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Target Brand
                  </label>
                  <div className="w-full rounded border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 font-semibold text-slate-700">
                    {brands[0].name} ({brands[0].code})
                  </div>
                </div>
              ) : null}
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Initiation Remarks
              </label>
              <textarea
                rows={2}
                placeholder="Details of discussions..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full rounded border border-slate-350 px-2.5 py-1.5 focus:ring-1 focus:ring-brand-500 bg-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleAction("save-initiation")}
                disabled={busy}
                className="rounded-lg border border-slate-300 text-slate-700 bg-white px-4 py-2 text-xs font-semibold hover:bg-slate-50 transition"
              >
                Save Draft
              </button>
              <button
                type="button"
                onClick={() => handleAction("raise-ticket")}
                disabled={busy}
                className="rounded-lg bg-slate-900 text-white px-4 py-2 text-xs font-semibold hover:bg-slate-800 transition"
              >
                {busy ? "Raising..." : "Raise Ticket to Consignment User"}
              </button>
            </div>
          </div>
        )}

        {/* Phase 2: Awaiting Package Receipt */}
        {status === "TICKET_RAISED" && (
          <div className="space-y-4 text-xs">
            <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
              <HelpCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-900 block">Awaiting Package Receipt by Consignment User</span>
                <p className="text-amber-750 mt-1">
                  The ticket has been successfully raised. The consignment user will record the received date, vehicle, quantity, box QC, and package photograph when it arrives at the warehouse.
                </p>
              </div>
            </div>

            <div className="bg-slate-50/80 border border-slate-150 rounded-xl p-4 space-y-3 font-medium">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Raised Ticket Details</span>
                {pipeline.ticket?.ticketNo && (
                  <span className="font-mono text-[11px] bg-slate-900 text-white px-2 py-0.5 rounded">
                    {pipeline.ticket.ticketNo}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-slate-400 uppercase tracking-wider block text-[10px] font-bold">Target Samples List</span>
                  {itemTarget ? (
                    itemTarget.startsWith("/api/uploads/") ? (
                      <a
                        href={itemTarget}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-600 hover:text-brand-800 font-semibold hover:underline flex items-center gap-1 mt-0.5"
                      >
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        View Target List File
                      </a>
                    ) : (
                      <span className="text-slate-800 mt-0.5 block">{itemTarget}</span>
                    )
                  ) : (
                    <span className="text-slate-800 mt-0.5 block">—</span>
                  )}
                </div>
                <div>
                  <span className="text-slate-400 uppercase tracking-wider block text-[10px] font-bold">Document Attached</span>
                  {docAttached ? (
                    docAttached.startsWith("/api/uploads/") ? (
                      <a
                        href={docAttached}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-600 hover:text-brand-800 font-semibold hover:underline flex items-center gap-1 mt-0.5"
                      >
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        View Attached Document
                      </a>
                    ) : (
                      <span className="text-slate-800 mt-0.5 block">{docAttached}</span>
                    )
                  ) : (
                    <span className="text-slate-800 mt-0.5 block">None</span>
                  )}
                </div>
                 <div>
                  <span className="text-slate-400 uppercase tracking-wider block text-[10px] font-bold">Date to Revisit</span>
                  <span className="text-slate-800 mt-0.5 block">{formatToDDMMMYYYY(dateToRevisit) || "—"}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Phase 3: Consignment Received (Verify Box) */}
        {status === "CONSIGNMENT_RECEIVED" && (
          <div className="space-y-4 text-xs">
            <div className="bg-indigo-50/40 border border-indigo-100 rounded-xl p-4 flex items-start gap-3">
              <Package className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-indigo-900 block">Package Received &amp; QC'ed by Warehouse</span>
                <p className="text-indigo-700 mt-1">
                  Please review the receipt details uploaded by the consignment user. Check the "Received Consignment" box and verify to close the ticket and enable SKU onboarding.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50/50 border border-slate-150 rounded-xl p-4 font-medium text-slate-700">
               <div>
                <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Date Received</span>
                <span className="text-slate-900 block mt-0.5">
                  {pipeline.receivedDate ? formatToDDMMMYYYY(pipeline.receivedDate) : "—"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Quantity Received</span>
                <span className="text-slate-900 block mt-0.5 font-bold">
                  {pipeline.quantityReceived ?? "—"} unit(s)
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Box QC Status</span>
                <span
                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-semibold text-[10px] uppercase mt-1 ${
                    pipeline.boxQc === "Good"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-150"
                      : "bg-amber-50 text-amber-700 border border-amber-150"
                  }`}
                >
                  {pipeline.boxQc || "—"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Vehicle Details</span>
                <span className="text-slate-900 block mt-0.5">{pipeline.vehicleDetails || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Photograph Reference</span>
                <span className="text-slate-900 block mt-0.5 font-mono text-[11px]">{pipeline.photographUrl || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Packing List Document</span>
                <span className="text-slate-900 block mt-0.5 font-mono text-[11px]">{pipeline.packingListDoc || "—"}</span>
              </div>
              {pipeline.consignmentRemarks && (
                <div className="sm:col-span-2 md:col-span-3 pt-2 border-t border-slate-100">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Consignment Remarks</span>
                  <span className="text-slate-800 block mt-0.5 italic">"{pipeline.consignmentRemarks}"</span>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2 p-2 bg-indigo-50/20 border border-indigo-100 rounded-lg">
                <input
                  type="checkbox"
                  id="receivedCheck"
                  checked={execVerified}
                  onChange={(e) => setExecVerified(e.target.checked)}
                  className="rounded border-slate-350 h-4 w-4 text-brand-650 focus:ring-brand-500 cursor-pointer"
                />
                <label htmlFor="receivedCheck" className="font-bold text-indigo-900 cursor-pointer">
                  Received Consignment
                </label>
              </div>

              <button
                type="button"
                onClick={() => handleAction("verify-consignment")}
                disabled={busy}
                className="rounded-lg bg-slate-900 text-white px-4 py-2 text-xs font-semibold hover:bg-slate-800 transition shadow-sm"
              >
                {busy ? "Verifying..." : "Verify & Close Ticket"}
              </button>
            </div>
          </div>
        )}

        {/* Phase 4: Closed / Completed */}
        {status === "CLOSED" && (
          <div className="space-y-3 text-xs">
            <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-emerald-900 block">Consignment Verified &amp; Closed</span>
                <p className="mt-0.5 font-medium">
                  The consignment workflow is completed. The samples have been verified by you, and the consignment ticket is closed.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 text-slate-700">
              <p className="font-bold text-slate-850 mb-1 uppercase tracking-wider text-[9px]">Pipeline Summary</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 leading-relaxed">
                <div>
                  <span className="font-semibold text-slate-400">Target items:</span>{" "}
                  {itemTarget ? (
                    itemTarget.startsWith("/api/uploads/") ? (
                      <a
                        href={itemTarget}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-850 hover:underline font-semibold"
                      >
                        View Target List File
                      </a>
                    ) : (
                      itemTarget
                    )
                  ) : (
                    "—"
                  )}
                </div>
                <div>
                  <span className="font-semibold text-slate-400">Received quantity:</span> {pipeline.quantityReceived} units ({pipeline.boxQc})
                </div>
                 <div>
                  <span className="font-semibold text-slate-400">Received date:</span> {pipeline.receivedDate ? formatToDDMMMYYYY(pipeline.receivedDate) : "—"}
                </div>
                <div>
                  <span className="font-semibold text-slate-400">Packing List:</span> {pipeline.packingListDoc || "None"}
                </div>
                <div>
                  <span className="font-semibold text-slate-400">Document Attached:</span>{" "}
                  {pipeline.docAttached ? (
                    pipeline.docAttached.startsWith("/api/uploads/") ? (
                      <a
                        href={pipeline.docAttached}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-850 hover:underline font-semibold"
                      >
                        View Attached Document
                      </a>
                    ) : (
                      pipeline.docAttached
                    )
                  ) : (
                    "—"
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  </details>
  );
}

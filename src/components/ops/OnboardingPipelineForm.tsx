"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Send, Package, CheckCircle2, ChevronRight, HelpCircle, Bell, Flag as FlagIcon, AlertTriangle } from "lucide-react";

const steps = [
  { key: "INITIATION", label: "Initiation" },
  { key: "SAMPLE_REQUEST", label: "Sample Request" },
  { key: "DATA_AND_STICKER", label: "Data & Sticker" },
  { key: "CLOSED", label: "Verification" },
];

interface OnboardingPipelineFormProps {
  assignmentId: string;
  pipeline: any;
  brands: { id: string; name: string; code: string }[];
  isDirectConsignment?: boolean;
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
  isDirectConsignment = false,
}: OnboardingPipelineFormProps) {
  const router = useRouter();

  const getStepKeyFromStatus = (statusStr: string) => {
    if (statusStr === "INITIATION") return "INITIATION";
    if (statusStr === "TICKET_RAISED" || statusStr === "CONSIGNMENT_RECEIVED") return "SAMPLE_REQUEST";
    if (statusStr === "DATA_AND_STICKER") return "DATA_AND_STICKER";
    if (statusStr === "VERIFICATION" || statusStr === "CLOSED") return "CLOSED";
    return "INITIATION";
  };

  const [activeViewStep, setActiveViewStep] = useState<string>(getStepKeyFromStatus(pipeline.status));
  const currentActiveStepKey = getStepKeyFromStatus(pipeline.status);

  const [isExpanded, setIsExpanded] = useState(false);

  // Step 3 checkboxes state
  const [dataPendingResolved, setDataPendingResolved] = useState(pipeline.dataPendingResolved ?? false);
  const [stickerPasted, setStickerPasted] = useState(pipeline.stickerPasted ?? false);

  // Step 4 checkboxes/photo state
  const [placedInRack, setPlacedInRack] = useState(pipeline.placedInRack ?? false);
  const [verificationPhoto, setVerificationPhoto] = useState(pipeline.verificationPhoto ?? "");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Initiation form fields state
  const [discussionDone, setDiscussionDone] = useState(pipeline.discussionDone ?? false);
  const [reqSpaceAndRack, setReqSpaceAndRack] = useState(pipeline.reqSpaceAndRack ?? false);
  const [reqData, setReqData] = useState(pipeline.reqData ?? false);
  const [reqSample, setReqSample] = useState(pipeline.reqSample ?? false);
  const [reqKt, setReqKt] = useState(pipeline.reqKt ?? false);
  const [directConsignment, setDirectConsignment] = useState(isDirectConsignment);
  const [docAttached, setDocAttached] = useState(pipeline.docAttached ?? "");
  const [itemTarget, setItemTarget] = useState(pipeline.itemTarget ?? "");
  const [nextActionTime, setNextActionTime] = useState(pipeline.nextActionTime ?? "");
  const [remarks, setRemarks] = useState(pipeline.remarks ?? "");
  const [dateToRevisit, setDateToRevisit] = useState(formatToDDMMMYYYY(pipeline.dateToRevisit) ?? "");
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadingTarget, setUploadingTarget] = useState(false);

  const [savedReminderDate, setSavedReminderDate] = useState<string>(pipeline.reminders?.[0]?.dateToRevisit ?? "");
  const [savingReminder, setSavingReminder] = useState(false);
  const [reminderMsg, setReminderMsg] = useState("");

  // Flag states
  const [flagReason, setFlagReason] = useState("");
  const [flagStage, setFlagStage] = useState("INITIATION");
  const [raisingFlag, setRaisingFlag] = useState(false);
  const [resolvingFlag, setResolvingFlag] = useState(false);
  const [showRaiseFlag, setShowRaiseFlag] = useState(false);

  async function handleRaiseFlag(e: React.FormEvent) {
    e.preventDefault();
    if (!flagReason.trim()) return;
    setRaisingFlag(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch("/api/flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId,
          brandId: pipeline.brandId.toString(),
          reason: flagReason.trim(),
          stage: flagStage,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to raise flag");
        return;
      }
      setFlagReason("");
      setShowRaiseFlag(false);
      setSuccessMsg("Flag successfully raised!");
      router.refresh();
    } catch {
      setError("Failed to raise flag due to a network error.");
    } finally {
      setRaisingFlag(false);
    }
  }

  async function handleResolveFlag(activeFlagId: string) {
    setResolvingFlag(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch(`/api/flags/${activeFlagId}`, {
        method: "PUT",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to resolve flag");
        return;
      }
      setSuccessMsg("Flag successfully resolved!");
      router.refresh();
    } catch {
      setError("Failed to resolve flag due to a network error.");
    } finally {
      setResolvingFlag(false);
    }
  }

  async function handleSetReminder() {
    if (!dateToRevisit.trim()) return;
    setSavingReminder(true);
    setReminderMsg("");
    setError("");
    try {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipelineId: pipeline.id,
          dateToRevisit: dateToRevisit.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to set reminder");
        return;
      }
      setSavedReminderDate(dateToRevisit.trim());
      setReminderMsg("Reminder set successfully!");
      setTimeout(() => setReminderMsg(""), 3000);
      router.refresh();
    } catch {
      setError("Failed to set reminder due to a network error.");
    } finally {
      setSavingReminder(false);
    }
  }

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

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
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
      setVerificationPhoto(data.url);
    } catch {
      setError("File upload failed");
    } finally {
      setUploadingPhoto(false);
    }
  }

  // Verification checkbox state
  const [execVerified, setExecVerified] = useState(pipeline.execVerified ?? false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const status = pipeline.status; // INITIATION | TICKET_RAISED | CONSIGNMENT_RECEIVED | CLOSED

  async function handleAction(actionType: "save-initiation" | "raise-ticket" | "verify-consignment" | "save-data-sticker" | "save-verification") {
    setError("");
    setSuccessMsg("");

    if (actionType === "raise-ticket") {
      if (!discussionDone) {
        setError("Please complete the discussion with the brand before initiating onboarding.");
        return;
      }
      if (reqSample && !itemTarget.trim()) {
        setError("Please specify the target items list before raising a sample request ticket.");
        return;
      }
      if (!reqSample && !reqSpaceAndRack && !reqKt) {
        setError("Please select at least one onboarding request (Requested Space/Rack, Requested Sample, or Requested Knowledge Transfer) to initiate.");
        return;
      }
    }

    if (actionType === "verify-consignment" && !execVerified) {
      setError("Please check 'Received Consignment' to verify receipt.");
      return;
    }

    if (actionType === "save-verification" && !verificationPhoto.trim()) {
      setError("Verification Photograph is mandatory.");
      return;
    }

    setBusy(true);

    try {
      const payload: any = { action: actionType };
      if (actionType === "save-initiation" || actionType === "raise-ticket") {
        payload.discussionDone = discussionDone;
        payload.reqSpaceAndRack = reqSpaceAndRack;
        payload.reqData = reqData;
        payload.reqSample = reqSample;
        payload.reqKt = reqKt;
        payload.docAttached = docAttached;
        payload.itemTarget = itemTarget;
        payload.nextActionTime = nextActionTime;
        payload.remarks = remarks;
        payload.dateToRevisit = dateToRevisit;
        payload.brandId = brandId;
        payload.isDirectConsignment = directConsignment;
      }

      if (actionType === "save-data-sticker") {
        payload.dataPendingResolved = dataPendingResolved;
        payload.stickerPasted = stickerPasted;
      }

      if (actionType === "save-verification") {
        payload.placedInRack = placedInRack;
        payload.verificationPhoto = verificationPhoto;
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
            ? "Onboarding requests successfully initiated!"
            : actionType === "verify-consignment"
              ? "Consignment successfully verified!"
              : actionType === "save-data-sticker"
                ? "Data & Sticker details saved successfully!"
                : "Verification details saved successfully!"
      );
      router.refresh();
    } catch {
      setError("A network error occurred.");
    } finally {
      setBusy(false);
    }
  }


  const getStepStatusOrder = (stepKey: string) => {
    if (status === "INITIATION") {
      if (stepKey === "INITIATION") return "active";
      return "pending";
    }
    if (status === "TICKET_RAISED" || status === "CONSIGNMENT_RECEIVED") {
      if (stepKey === "INITIATION") return "completed";
      if (stepKey === "SAMPLE_REQUEST") return "active";
      return "pending";
    }
    if (status === "DATA_AND_STICKER") {
      if (stepKey === "INITIATION" || stepKey === "SAMPLE_REQUEST") return "completed";
      if (stepKey === "DATA_AND_STICKER") return "active";
      return "pending";
    }
    if (status === "VERIFICATION") {
      if (stepKey === "INITIATION" || stepKey === "SAMPLE_REQUEST" || stepKey === "DATA_AND_STICKER") return "completed";
      if (stepKey === "CLOSED") return "active";
      return "pending";
    }
    if (status === "CLOSED") {
      return "completed";
    }
    return "pending";
  };

  const cardStyle = "bg-white/60 backdrop-blur-md rounded-2xl border border-slate-200 p-6 shadow-sm";

  const currentStepIndex = steps.findIndex((s) => s.key === activeViewStep);
  const prevStepIndex = currentStepIndex > 0 ? currentStepIndex - 1 : -1;
  const nextStepIndex = currentStepIndex < steps.length - 1 ? currentStepIndex + 1 : -1;

  return (
    <div className="space-y-3">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer select-none py-1 hover:opacity-85 transition-opacity"
      >
        <div className="flex items-center gap-3 shrink-0">
          <h2 className="text-base font-bold text-slate-800">Onboarding Pipeline</h2>
          <span
            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${status === "CLOSED"
                ? "bg-emerald-50 text-emerald-700 border-emerald-250"
                : status === "CONSIGNMENT_RECEIVED"
                  ? "bg-indigo-50 text-indigo-700 border-indigo-255"
                  : "bg-amber-50 text-amber-700 border-amber-200 animate-pulse"
              }`}
          >
            Stage: {status.replace(/_/g, " ")}
          </span>
        </div>

        {/* Inline steps tracker */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs font-semibold text-slate-500 lg:border-l lg:border-slate-200 lg:pl-4 flex-1 justify-start lg:justify-end pr-4">
          {steps.map((step, idx) => {
            const stepStatus = getStepStatusOrder(step.key);
            const isViewing = activeViewStep === step.key;

            return (
              <div key={step.key} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(true);
                    setActiveViewStep(step.key);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all border ${
                    isViewing
                      ? "bg-slate-900 text-white border-slate-950 shadow-sm"
                      : "hover:bg-slate-100 bg-transparent border-transparent"
                  }`}
                >
                  <div className="relative flex items-center justify-center shrink-0 w-3 h-3">
                    {stepStatus === "completed" && (
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${isViewing ? "bg-emerald-400" : "bg-emerald-600"}`} />
                    )}
                    {stepStatus === "active" && (
                      <span className={`relative inline-flex rounded-full h-2 w-2 animate-led-yellow ${isViewing ? "bg-amber-300" : "bg-amber-500"}`} />
                    )}
                    {stepStatus === "pending" && (
                      <span className="relative inline-flex rounded-full h-2 w-2 border border-slate-300 bg-white" />
                    )}
                  </div>
                  <span
                    className={`text-[11px] font-bold tracking-wide transition-colors ${
                      isViewing
                        ? "text-white"
                        : stepStatus === "active"
                          ? "text-amber-700"
                          : stepStatus === "completed"
                            ? "text-slate-700"
                            : "text-slate-400"
                    }`}
                  >
                    {step.label}
                  </span>
                </button>
                {idx < steps.length - 1 && (
                  <ChevronRight className="h-3 w-3 text-slate-350 shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-855 transition-colors shrink-0">
          <span>{isExpanded ? "Collapse" : "Expand"}</span>
          <svg className={`w-4 h-4 transform transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Interactive Form Content (Collapsible) */}
      {isExpanded && (
        <div className={`${cardStyle} space-y-6`}>
          {/* Navigation Bar between stages */}
          <div className="flex items-center justify-between bg-slate-50/80 border border-slate-200 rounded-xl p-3 text-xs mb-4 select-none">
            <button
              type="button"
              disabled={prevStepIndex === -1}
              onClick={() => {
                if (prevStepIndex !== -1) {
                  setActiveViewStep(steps[prevStepIndex].key);
                }
              }}
              className={`px-3 py-1.5 rounded-lg border font-semibold flex items-center gap-1 transition ${
                prevStepIndex === -1
                  ? "bg-slate-100/60 text-slate-400 border-slate-200 cursor-not-allowed"
                  : "bg-white hover:bg-slate-100 text-slate-700 border-slate-300 active:scale-[0.98]"
              }`}
            >
              ← Previous Stage
            </button>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">
                Viewing:
              </span>
              <span className="font-bold text-slate-800 bg-slate-200/80 px-2.5 py-0.5 rounded-full text-[11px]">
                {steps.find((s) => s.key === activeViewStep)?.label}
              </span>
              {activeViewStep === currentActiveStepKey ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                  Active Stage
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                  Read-Only
                </span>
              )}
            </div>
            <button
              type="button"
              disabled={nextStepIndex === -1}
              onClick={() => {
                if (nextStepIndex !== -1) {
                  setActiveViewStep(steps[nextStepIndex].key);
                }
              }}
              className={`px-3 py-1.5 rounded-lg border font-semibold flex items-center gap-1 transition ${
                nextStepIndex === -1
                  ? "bg-slate-100/60 text-slate-400 border-slate-200 cursor-not-allowed"
                  : "bg-white hover:bg-slate-100 text-slate-700 border-slate-300 active:scale-[0.98]"
              }`}
            >
              Next Stage →
            </button>
          </div>

          <div className="border-b border-slate-100 pb-3 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-slate-950 text-sm">
                Stage Details: {steps.find((s) => s.key === activeViewStep)?.label}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeViewStep === "INITIATION" && "Initiate discussion and prepare consignment request"}
                {activeViewStep === "SAMPLE_REQUEST" && "Consignment sample request and receipt tracking"}
                {activeViewStep === "DATA_AND_STICKER" && "Verify SKU details, attributes, and paste layout stickers"}
                {activeViewStep === "CLOSED" && "Verify physical placement of samples in racks and upload confirmation photo"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Pipeline Status:</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${status === "CLOSED"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-250"
                    : status === "CONSIGNMENT_RECEIVED"
                      ? "bg-indigo-50 text-indigo-700 border-indigo-255"
                      : "bg-brand-50 text-brand-700 border-brand-200 animate-pulse"
                  }`}
              >
                {status.replace(/_/g, " ")}
              </span>
            </div>
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
          )}          {/* Phase 1: Initiation Form */}
          {activeViewStep === "INITIATION" && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {/* 1. Target Brand */}
                {brands.length > 1 ? (
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Select Target Brand
                    </label>
                    <select
                      value={brandId}
                      onChange={(e) => setBrandId(e.target.value)}
                      disabled={activeViewStep !== currentActiveStepKey}
                      className="w-full rounded border border-slate-350 px-2.5 py-1.5 focus:ring-1 focus:ring-brand-500 bg-white cursor-pointer font-semibold disabled:opacity-75 disabled:cursor-not-allowed"
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

                {/* Discussion checkbox moved to checkboxes row at the bottom of the grid */}

                {/* 3. Next Action Item */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Next Action Item
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Call brand manager for SKU details"
                    value={nextActionTime}
                    onChange={(e) => setNextActionTime(e.target.value)}
                    disabled={activeViewStep !== currentActiveStepKey}
                    className="w-full rounded border border-slate-350 px-2.5 py-1.5 focus:ring-1 focus:ring-brand-500 bg-white disabled:opacity-75 disabled:cursor-not-allowed"
                  />
                </div>

                {/* 4. Date to Revisit */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Date to Revisit
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. 30-Jun-2026"
                      value={dateToRevisit}
                      onChange={(e) => setDateToRevisit(e.target.value)}
                      onBlur={() => setDateToRevisit(formatToDDMMMYYYY(dateToRevisit))}
                      disabled={activeViewStep !== currentActiveStepKey}
                      className="flex-1 rounded border border-slate-350 px-2.5 py-1.5 focus:ring-1 focus:ring-brand-500 bg-white disabled:opacity-75 disabled:cursor-not-allowed"
                    />
                    {activeViewStep === currentActiveStepKey && dateToRevisit.trim() && (
                      <button
                        type="button"
                        onClick={handleSetReminder}
                        disabled={savingReminder || dateToRevisit.trim() === savedReminderDate}
                        className={`px-3 py-1.5 rounded border text-xs font-semibold flex items-center gap-1 shrink-0 transition ${dateToRevisit.trim() === savedReminderDate
                            ? "bg-emerald-50 text-emerald-700 border-emerald-250 cursor-default"
                            : "bg-brand-50 hover:bg-brand-100 text-brand-700 border-brand-200"
                          }`}
                      >
                        <Bell className="h-3.5 w-3.5" />
                        {savingReminder
                          ? "Setting..."
                          : dateToRevisit.trim() === savedReminderDate
                            ? "Reminder Set"
                            : savedReminderDate
                              ? "Update Reminder"
                              : "Set Reminder"}
                      </button>
                    )}
                  </div>
                  {reminderMsg && (
                    <div className="text-[10px] text-emerald-600 font-semibold mt-1">
                      {reminderMsg}
                    </div>
                  )}
                </div>

                {/* 5. Document Attached */}
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
                      disabled={activeViewStep !== currentActiveStepKey}
                      className="flex-1 rounded border border-slate-350 px-2.5 py-1.5 focus:ring-1 focus:ring-brand-500 bg-white disabled:opacity-75 disabled:cursor-not-allowed"
                    />
                    {activeViewStep === currentActiveStepKey && (
                      <label className={`cursor-pointer rounded border border-slate-300 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 flex items-center justify-center shrink-0 shadow-sm transition active:scale-[0.98] ${uploadingDoc ? "opacity-60 cursor-not-allowed" : ""}`}>
                        {uploadingDoc ? "Uploading..." : "Upload File"}
                        <input
                          type="file"
                          accept="application/pdf,image/*"
                          onChange={handleDocUpload}
                          className="hidden"
                          style={{ display: "none" }}
                          disabled={uploadingDoc}
                        />
                      </label>
                    )}
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
                      {activeViewStep === currentActiveStepKey && (
                        <button
                          type="button"
                          onClick={() => setDocAttached("")}
                          className="text-red-500 hover:text-red-700 font-semibold text-[11px]"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* 6. Item Target List */}
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
                      disabled={activeViewStep !== currentActiveStepKey}
                      className="flex-1 rounded border border-slate-350 px-2.5 py-1.5 focus:ring-1 focus:ring-brand-500 bg-white font-medium disabled:opacity-75 disabled:cursor-not-allowed"
                    />
                    {activeViewStep === currentActiveStepKey && (
                      <label className={`cursor-pointer rounded border border-slate-300 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 flex items-center justify-center shrink-0 shadow-sm transition active:scale-[0.98] ${uploadingTarget ? "opacity-60 cursor-not-allowed" : ""}`}>
                        {uploadingTarget ? "Uploading..." : "Upload File"}
                        <input
                          type="file"
                          accept="application/pdf,image/*"
                          onChange={handleTargetUpload}
                          className="hidden"
                          style={{ display: "none" }}
                          disabled={uploadingTarget}
                        />
                      </label>
                    )}
                  </div>
                  {itemTarget && (
                    <div className="mt-1 flex items-center gap-2">
                      {itemTarget.startsWith("/api/uploads/") ? (
                        <a
                          href={itemTarget}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-600 hover:text-brand-855 hover:underline font-semibold text-[11px] flex items-center gap-1"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          View Target List File
                        </a>
                      ) : (
                        <span className="text-slate-500 text-[11px] italic">Target: {itemTarget}</span>
                      )}
                      {activeViewStep === currentActiveStepKey && (
                        <button
                          type="button"
                          onClick={() => setItemTarget("")}
                          className="text-red-500 hover:text-red-700 font-semibold text-[11px]"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Checkboxes Row */}
                <div className="sm:col-span-2 md:col-span-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-2 select-none">
                  <div className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                    <input
                      type="checkbox"
                      id="discussCheck"
                      checked={discussionDone}
                      onChange={(e) => setDiscussionDone(e.target.checked)}
                      disabled={activeViewStep !== currentActiveStepKey}
                      className="rounded border-slate-355 h-4 w-4 text-brand-600 focus:ring-brand-500 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                    />
                    <label htmlFor="discussCheck" className="font-semibold text-slate-700 cursor-pointer select-none">
                      Discussion with Brand Done
                    </label>
                  </div>

                  <div className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                    <input
                      type="checkbox"
                      id="reqSpaceCheck"
                      checked={reqSpaceAndRack}
                      onChange={(e) => setReqSpaceAndRack(e.target.checked)}
                      disabled={activeViewStep !== currentActiveStepKey}
                      className="rounded border-slate-355 h-4 w-4 text-brand-600 focus:ring-brand-500 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                    />
                    <label htmlFor="reqSpaceCheck" className="font-semibold text-slate-700 cursor-pointer select-none">
                      Requested Space/Rack
                    </label>
                  </div>

                  <div className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                    <input
                      type="checkbox"
                      id="reqDataCheck"
                      checked={reqData}
                      onChange={(e) => setReqData(e.target.checked)}
                      disabled={activeViewStep !== currentActiveStepKey}
                      className="rounded border-slate-355 h-4 w-4 text-brand-600 focus:ring-brand-500 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                    />
                    <label htmlFor="reqDataCheck" className="font-semibold text-slate-700 cursor-pointer select-none">
                      Requested Data
                    </label>
                  </div>

                  <div className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                    <input
                      type="checkbox"
                      id="reqSampleCheck"
                      checked={reqSample}
                      onChange={(e) => setReqSample(e.target.checked)}
                      disabled={activeViewStep !== currentActiveStepKey}
                      className="rounded border-slate-355 h-4 w-4 text-brand-600 focus:ring-brand-500 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                    />
                    <label htmlFor="reqSampleCheck" className="font-semibold text-slate-700 cursor-pointer select-none">
                      Requested Sample
                    </label>
                  </div>

                  {isDirectConsignment && (
                    <div className="flex items-center gap-2 p-3 rounded-lg border border-orange-200 dark:border-orange-900 bg-orange-50/30 dark:bg-orange-950/20 text-orange-750 dark:text-orange-300">
                      <input
                        type="checkbox"
                        id="directConsignmentCheck"
                        checked={directConsignment}
                        onChange={(e) => setDirectConsignment(e.target.checked)}
                        disabled={activeViewStep !== currentActiveStepKey}
                        className="rounded border-orange-355 h-4 w-4 text-orange-600 focus:ring-orange-500 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                      />
                      <label htmlFor="directConsignmentCheck" className="font-semibold cursor-pointer select-none">
                        Direct Consignment
                      </label>
                    </div>
                  )}

                  <div className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                    <input
                      type="checkbox"
                      id="reqKtCheck"
                      checked={reqKt}
                      onChange={(e) => setReqKt(e.target.checked)}
                      disabled={activeViewStep !== currentActiveStepKey}
                      className="rounded border-slate-355 h-4 w-4 text-brand-600 focus:ring-brand-500 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                    />
                    <label htmlFor="reqKtCheck" className="font-semibold text-slate-700 cursor-pointer select-none">
                      Requested Knowledge Transfer
                    </label>
                  </div>
                </div>
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
                  disabled={activeViewStep !== currentActiveStepKey}
                  className="w-full rounded border border-slate-350 px-2.5 py-1.5 focus:ring-1 focus:ring-brand-500 bg-white disabled:opacity-75 disabled:cursor-not-allowed"
                />
              </div>

              {activeViewStep === currentActiveStepKey ? (
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
                    {busy ? "Initiating..." : "OB Initiated"}
                  </button>
                </div>
              ) : (
                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2 p-2 rounded-lg border border-emerald-250 bg-emerald-50 text-emerald-800 font-semibold w-fit">
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span>Initiation Details Completed</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Phase 2: Awaiting Package Receipt or Receipt Details */}
          {activeViewStep === "SAMPLE_REQUEST" && (
            <div className="space-y-4 text-xs">
              {/* If future stage (actual status is INITIATION) */}
              {status === "INITIATION" && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-3 text-slate-500">
                  <HelpCircle className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-700 block">Sample Request Stage Pending</span>
                    <p className="mt-1">
                      Onboarding requests have not been initiated yet. Once you fill out the Initiation details and click "OB Initiated", this stage will begin.
                    </p>
                  </div>
                </div>
              )}

              {/* If active stage: status is TICKET_RAISED */}
              {status === "TICKET_RAISED" && (
                <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
                  <HelpCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-amber-900 block">Awaiting Package Receipt by Consignment User</span>
                    <p className="text-amber-750 mt-1">
                      The ticket has been successfully raised. The consignment user will record the received date, vehicle, quantity, box QC, and package photograph when it arrives at the warehouse.
                    </p>
                  </div>
                </div>
              )}

              {/* If active stage: status is CONSIGNMENT_RECEIVED, OR completed (status is DATA_AND_STICKER, VERIFICATION, CLOSED) */}
              {(status === "CONSIGNMENT_RECEIVED" || ["DATA_AND_STICKER", "VERIFICATION", "CLOSED"].includes(status)) && (
                <div className="bg-indigo-50/40 border border-indigo-100 rounded-xl p-4 flex items-start gap-3">
                  <Package className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-indigo-900 block">Package Received &amp; QC'ed by Warehouse</span>
                    <p className="text-indigo-700 mt-1">
                      {status === "CONSIGNMENT_RECEIVED"
                        ? "Please review the receipt details uploaded by the consignment user. Check the 'Received Consignment' box and verify to close the ticket and enable SKU onboarding."
                        : "The consignment package has been successfully received, QC'ed, and verified."}
                    </p>
                  </div>
                </div>
              )}

              {/* Show Ticket Details (if status is not INITIATION) */}
              {status !== "INITIATION" && (
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
              )}

              {/* Show Received Consignment Details (if consignment is received or in later stages) */}
              {(status === "CONSIGNMENT_RECEIVED" || ["DATA_AND_STICKER", "VERIFICATION", "CLOSED"].includes(status)) && (
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
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-semibold text-[10px] uppercase mt-1 ${pipeline.boxQc === "Good"
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
              )}

              {/* Show check verification controls only if active and status is CONSIGNMENT_RECEIVED */}
              {status === "CONSIGNMENT_RECEIVED" && activeViewStep === currentActiveStepKey && (
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
              )}

              {/* Show check verification completed badge if past stage */}
              {["DATA_AND_STICKER", "VERIFICATION", "CLOSED"].includes(status) && (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-emerald-250 bg-emerald-50 text-emerald-800 font-semibold w-fit ml-auto">
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span>Consignment Verified and Closed</span>
                </div>
              )}
            </div>
          )}

          {/* Phase 3: Data Verification & Sticker Pasting */}
          {activeViewStep === "DATA_AND_STICKER" && (
            <div className="space-y-4 text-xs animate-[fadeIn_0.2s_ease-out]">
              {/* If future stage (actual status is INITIATION, TICKET_RAISED, CONSIGNMENT_RECEIVED) */}
              {["INITIATION", "TICKET_RAISED", "CONSIGNMENT_RECEIVED"].includes(status) && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-3 text-slate-500">
                  <HelpCircle className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-700 block">Data &amp; Sticker Stage Pending</span>
                    <p className="mt-1">
                      Data &amp; Sticker verification is pending. This stage will become active after the consignment is received and verified.
                    </p>
                  </div>
                </div>
              )}

              {/* If active or completed */}
              {!["INITIATION", "TICKET_RAISED", "CONSIGNMENT_RECEIVED"].includes(status) && (
                <>
                  <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
                    <Package className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-amber-900 block">Pending Data &amp; Sticker Verification</span>
                      <p className="text-amber-800 mt-1">
                        {pipeline.reqSample
                          ? "Please verify that all technical data is complete and correct (resolving any pending data flags), and that the physical layout stickers have been pasted on the samples."
                          : "Please verify that all technical data is complete and correct (resolving any pending data flags) to complete the onboarding pipeline."}
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-50/50 border border-slate-150 rounded-xl p-4 space-y-4">
                    <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px] block">Verification Checklist</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className={`flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-white shadow-xs ${!pipeline.reqSample ? "sm:col-span-2" : ""}`}>
                        <input
                          type="checkbox"
                          id="dataPendingResolvedCheck"
                          checked={dataPendingResolved}
                          onChange={(e) => setDataPendingResolved(e.target.checked)}
                          disabled={activeViewStep !== currentActiveStepKey}
                          className="rounded border-slate-350 h-4.5 w-4.5 text-brand-600 focus:ring-brand-500 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                        />
                        <label htmlFor="dataPendingResolvedCheck" className="font-bold text-slate-800 cursor-pointer select-none">
                          Data Pending Resolved / Data Done
                        </label>
                      </div>

                      {pipeline.reqSample && (
                        <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-white shadow-xs">
                          <input
                            type="checkbox"
                            id="stickerPastedCheck"
                            checked={stickerPasted}
                            onChange={(e) => setStickerPasted(e.target.checked)}
                            disabled={activeViewStep !== currentActiveStepKey}
                            className="rounded border-slate-355 h-4.5 w-4.5 text-brand-600 focus:ring-brand-500 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                          />
                          <label htmlFor="stickerPastedCheck" className="font-bold text-slate-800 cursor-pointer select-none">
                            Sticker Pasted on Sample
                          </label>
                        </div>
                      )}
                    </div>
                  </div>

                  {activeViewStep === currentActiveStepKey && (
                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleAction("save-data-sticker")}
                        disabled={busy}
                        className="rounded-lg bg-slate-900 text-white px-4 py-2 text-xs font-semibold hover:bg-slate-800 transition shadow-sm"
                      >
                        {busy ? "Saving..." : "Save & Update Stage"}
                      </button>
                    </div>
                  )}

                  {activeViewStep !== currentActiveStepKey && (
                    <div className="flex items-center gap-2 p-3 rounded-lg border border-emerald-250 bg-emerald-50 text-emerald-800 font-semibold w-fit ml-auto">
                      <Check className="h-4 w-4 text-emerald-600" />
                      <span>Data &amp; Stickers Verified</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Phase 4: Placement & Photo Verification or Summary */}
          {activeViewStep === "CLOSED" && (
            <div className="space-y-4 text-xs">
              {/* If future stage (actual status is not VERIFICATION or CLOSED) */}
              {!["VERIFICATION", "CLOSED"].includes(status) && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-3 text-slate-500">
                  <HelpCircle className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-700 block">Verification Stage Pending</span>
                    <p className="mt-1">
                      Placement &amp; Photograph verification is pending. This stage will become active after Data &amp; Sticker details are verified and completed.
                    </p>
                  </div>
                </div>
              )}

              {/* If active stage: status is VERIFICATION */}
              {status === "VERIFICATION" && (
                <>
                  <div className="bg-indigo-50/40 border border-indigo-100 rounded-xl p-4 flex items-start gap-3">
                    <Package className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-indigo-900 block">Placement &amp; Photograph Verification</span>
                      <p className="text-indigo-700 mt-1">
                        Please verify that the samples have been physically placed in the rack, and upload a photograph of the placement (mandatory) to complete the onboarding pipeline.
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-50/50 border border-slate-150 rounded-xl p-4 space-y-4">
                    <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px] block">Placement Verification Checklist</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-white shadow-xs">
                        <input
                          type="checkbox"
                          id="placedInRackCheck"
                          checked={placedInRack}
                          onChange={(e) => setPlacedInRack(e.target.checked)}
                          className="rounded border-slate-350 h-4.5 w-4.5 text-brand-600 focus:ring-brand-500 cursor-pointer"
                        />
                        <label htmlFor="placedInRackCheck" className="font-bold text-slate-800 cursor-pointer select-none">
                          Placed in Rack
                        </label>
                      </div>

                      <div className="flex flex-col gap-1 p-3 rounded-lg border border-slate-200 bg-white shadow-xs">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Verification Photograph <span className="text-red-500 font-extrabold">*</span>
                        </label>
                        <div className="flex gap-2 mt-1">
                          <input
                            type="text"
                            placeholder="e.g. /api/uploads/photo.jpg"
                            value={verificationPhoto}
                            onChange={(e) => setVerificationPhoto(e.target.value)}
                            required
                            className="flex-1 rounded border border-slate-350 px-2.5 py-1.5 focus:ring-1 focus:ring-brand-500 bg-white text-xs font-semibold"
                          />
                          <label className={`cursor-pointer rounded border border-slate-300 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 flex items-center justify-center shrink-0 shadow-sm transition active:scale-[0.98] ${uploadingPhoto ? "opacity-60 cursor-not-allowed" : ""}`}>
                            {uploadingPhoto ? "Uploading..." : "Upload Photo"}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handlePhotoUpload}
                              className="hidden"
                              style={{ display: "none" }}
                              disabled={uploadingPhoto}
                            />
                          </label>
                        </div>
                        {verificationPhoto && (
                          <div className="mt-1 flex items-center gap-2">
                            <a
                              href={verificationPhoto}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-brand-600 hover:text-brand-850 hover:underline font-semibold text-[11px] flex items-center gap-1"
                            >
                              View Verification Photo
                            </a>
                            <button
                              type="button"
                              onClick={() => setVerificationPhoto("")}
                              className="text-red-500 hover:text-red-700 font-semibold text-[11px]"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleAction("save-verification")}
                      disabled={busy}
                      className="rounded-lg bg-slate-900 text-white px-4 py-2 text-xs font-semibold hover:bg-slate-800 transition shadow-sm"
                    >
                      {busy ? "Completing..." : "Complete Onboarding Verification"}
                    </button>
                  </div>
                </>
              )}

              {/* If completed stage: status is CLOSED */}
              {status === "CLOSED" && (
                <div className="space-y-3">
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
                      <div>
                        <span className="font-semibold text-slate-400">Data Status:</span>{" "}
                        <span className="text-emerald-600 font-bold">Data Completed</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-400">Sticker Status:</span>{" "}
                        <span className="text-emerald-600 font-bold">Stickers Pasted</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-400">Rack Status:</span>{" "}
                        <span className="text-emerald-600 font-bold">{pipeline.placedInRack ? "Placed in Rack" : "Not Placed"}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-400">Verification Photo:</span>{" "}
                        {pipeline.verificationPhoto ? (
                          <a
                            href={pipeline.verificationPhoto}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-600 hover:text-brand-850 hover:underline font-bold"
                          >
                            View Photo
                          </a>
                        ) : (
                          "—"
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Flags Management Section */}
          {(() => {
            const activeFlag = (pipeline.flags || []).find((f: any) => !f.isResolved);
            const stageLabels: Record<string, string> = {
              INITIATION: "Initiation",
              SAMPLE_REQUEST: "Sample Request",
              TICKET_RAISED: "Sample Request (Raised)",
              CONSIGNMENT_RECEIVED: "Sample Request (Received)",
              DATA_AND_STICKER: "Data & Sticker",
              VERIFICATION: "Verification",
              CLOSED: "Verification",
            };

            return (
              <div className="border-t border-slate-200 mt-6 pt-5 space-y-4">
                <div className="flex items-center gap-2">
                  <FlagIcon className="h-4 w-4 text-slate-500" />
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Pipeline Flags</h4>
                </div>

                {activeFlag ? (
                  <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-amber-900 block text-xs">
                          Active Flag Raised at Stage: {stageLabels[activeFlag.stage] || activeFlag.stage}
                        </span>
                        <p className="text-amber-850 text-xs mt-1 font-medium">{activeFlag.reason}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-100/50 border border-amber-200 rounded-lg shrink-0">
                      <input
                        type="checkbox"
                        id="resolveFlagCheck"
                        checked={resolvingFlag}
                        onChange={() => handleResolveFlag(activeFlag.id)}
                        disabled={resolvingFlag}
                        className="rounded border-slate-350 h-4 w-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <label htmlFor="resolveFlagCheck" className="font-bold text-slate-700 text-xs cursor-pointer select-none">
                        {resolvingFlag ? "Resolving..." : "Mark as Resolved"}
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {!showRaiseFlag ? (
                      <button
                        type="button"
                        onClick={() => setShowRaiseFlag(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition"
                      >
                        <FlagIcon className="h-3.5 w-3.5" />
                        Raise Flag for Attention
                      </button>
                    ) : (
                      <form onSubmit={handleRaiseFlag} className="space-y-3 bg-slate-50/50 border border-slate-200 rounded-xl p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                              Flag Raised At Stage
                            </label>
                            <select
                              value={flagStage}
                              onChange={(e) => setFlagStage(e.target.value)}
                              className="w-full rounded border border-slate-350 px-2.5 py-1.5 focus:ring-1 focus:ring-brand-500 bg-white font-semibold text-xs"
                            >
                              <option value="INITIATION">Initiation</option>
                              <option value="SAMPLE_REQUEST">Sample Request</option>
                              <option value="DATA_AND_STICKER">Data & Sticker</option>
                              <option value="VERIFICATION">Verification</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                              Reason for Flag
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Design details missing, sample damaged..."
                              value={flagReason}
                              onChange={(e) => setFlagReason(e.target.value)}
                              className="w-full rounded border border-slate-350 px-2.5 py-1.5 focus:ring-1 focus:ring-brand-500 bg-white text-xs"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-250/60">
                          <button
                            type="button"
                            onClick={() => setShowRaiseFlag(false)}
                            className="rounded border border-slate-300 text-slate-700 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 transition"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={raisingFlag || !flagReason.trim()}
                            className="rounded bg-slate-900 text-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-800 transition"
                          >
                            {raisingFlag ? "Submitting..." : "Submit Flag"}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

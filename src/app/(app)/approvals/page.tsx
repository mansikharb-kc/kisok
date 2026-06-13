"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, AlertCircle, Clock, Check, X, Search, FileText } from "lucide-react";

type ChangeRequest = {
  id: string;
  type: string;
  payload: any;
  branchId: string | null;
  branchName: string | null;
  requestedBy: string | null;
  requestedByName: string;
  status: "pending" | "approved" | "rejected";
  decidedBy: string | null;
  decidedAt: string | null;
  reason: string | null;
  createdAt: string;
};

export default function ApprovalsPage() {
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [selectedRequest, setSelectedRequest] = useState<ChangeRequest | null>(null);
  const [decisionReason, setDecisionReason] = useState("");
  const [deciding, setDeciding] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  async function fetchRequests() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/change-requests");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load approvals.");
        return;
      }
      setRequests(data.requests || []);
    } catch {
      setError("Failed to communicate with database API.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDecide(status: "approved" | "rejected") {
    if (!selectedRequest) return;
    setDeciding(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/change-requests/${selectedRequest.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason: decisionReason }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to submit decision.");
        return;
      }

      setSuccess(`Request successfully ${status === "approved" ? "approved and executed" : "rejected"}!`);
      setSelectedRequest(null);
      setDecisionReason("");
      fetchRequests();
    } catch {
      setError("Failed to execute request decision.");
    } finally {
      setDeciding(false);
    }
  }

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const historyRequests = requests.filter((r) => r.status !== "pending");
  const visibleRequests = activeTab === "pending" ? pendingRequests : historyRequests;

  function renderPayload(payload: any, type: string) {
    if (!payload) return null;
    
    // Custom readable renderings
    if (type === "BRANCH_PROGRAM") {
      return (
        <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs space-y-1.5 text-slate-700">
          <div className="font-semibold text-slate-800">Branch Program Activation</div>
          <div><strong>Branch:</strong> {payload.branchName || `ID: ${payload.branchId}`}</div>
          <div><strong>Program:</strong> {payload.programName || `ID: ${payload.programId}`}</div>
        </div>
      );
    }

    // Default JSON print
    return (
      <pre className="bg-slate-900 text-slate-300 rounded p-4 text-xs font-mono overflow-auto max-h-60 border border-slate-800">
        {JSON.stringify(payload, null, 2)}
      </pre>
    );
  }

  function getRequestBadgeColor(type: string) {
    switch (type) {
      case "BRANCH_PROGRAM":
        return "bg-cyan-50 text-cyan-700 border-cyan-200";
      case "NEW_CATEGORY":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "NEW_ATTRIBUTE":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "EDIT_MASTER_FIELD":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  }

  function formatType(type: string) {
    return type.replace(/_/g, " ");
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-slate-400">Loading change requests inbox...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 font-sans">Approvals Inbox</h1>
        <p className="text-sm text-slate-500 mt-1">
          Review, approve, or reject downstream change requests submitted by branches.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")}><X className="w-4 h-4" /></button>
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md text-sm flex items-center justify-between">
          <span className="flex items-center gap-1.5"><Check className="w-4 h-4" /> {success}</span>
          <button onClick={() => setSuccess("")}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-6 -mb-px">
          <button
            onClick={() => {
              setActiveTab("pending");
              setSelectedRequest(null);
            }}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "pending"
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Pending Requests ({pendingRequests.length})
          </button>
          <button
            onClick={() => {
              setActiveTab("history");
              setSelectedRequest(null);
            }}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "history"
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Decision History ({historyRequests.length})
          </button>
        </nav>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Inbox List */}
        <div className="lg:col-span-2 space-y-3">
          {visibleRequests.length === 0 ? (
            <div className="bg-white rounded-lg border border-slate-200 p-10 text-center text-slate-400 text-sm">
              <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2.5" />
              No change requests in this inbox.
            </div>
          ) : (
            visibleRequests.map((req) => (
              <div
                key={req.id}
                onClick={() => setSelectedRequest(req)}
                className={`p-4 bg-white rounded-lg border cursor-pointer hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  selectedRequest?.id === req.id
                    ? "border-brand-500 ring-1 ring-brand-500"
                    : "border-slate-200"
                }`}
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getRequestBadgeColor(
                        req.type,
                      )}`}
                    >
                      {formatType(req.type)}
                    </span>
                    {req.branchName && (
                      <span className="text-xs font-semibold text-slate-600">
                        @{req.branchName}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">
                    Requested by <span className="font-semibold text-slate-600">{req.requestedByName}</span> ·{" "}
                    {new Date(req.createdAt).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                  {req.status === "pending" && (
                    <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-semibold px-2.5 py-1 bg-amber-50 rounded-full border border-amber-200">
                      <Clock className="w-3.5 h-3.5" /> Pending
                    </span>
                  )}
                  {req.status === "approved" && (
                    <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-semibold px-2.5 py-1 bg-emerald-50 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                    </span>
                  )}
                  {req.status === "rejected" && (
                    <span className="inline-flex items-center gap-1 text-rose-600 text-xs font-semibold px-2.5 py-1 bg-rose-50 rounded-full border border-rose-200">
                      <XCircle className="w-3.5 h-3.5" /> Rejected
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Sidebar Details Panel */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
          {selectedRequest ? (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Request Details</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">ID: {selectedRequest.id}</p>
                </div>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
                >
                  Close
                </button>
              </div>

              {/* Specs */}
              <div className="grid grid-cols-2 gap-3 text-xs border-b border-slate-100 pb-3">
                <div>
                  <span className="text-slate-400">Requestor</span>
                  <div className="font-semibold mt-0.5">{selectedRequest.requestedByName}</div>
                </div>
                {selectedRequest.branchName && (
                  <div>
                    <span className="text-slate-400">Branch</span>
                    <div className="font-semibold mt-0.5">{selectedRequest.branchName}</div>
                  </div>
                )}
                <div>
                  <span className="text-slate-400">Submitted</span>
                  <div className="font-semibold mt-0.5">
                    {new Date(selectedRequest.createdAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Status</span>
                  <div className="font-semibold mt-0.5 capitalize">{selectedRequest.status}</div>
                </div>
              </div>

              {/* Payload content */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" /> Proposed Changes
                </span>
                {renderPayload(selectedRequest.payload, selectedRequest.type)}
              </div>

              {/* Decision Section */}
              {selectedRequest.status === "pending" ? (
                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">
                      Decision Reason / Remarks (Optional)
                    </label>
                    <textarea
                      placeholder="Add reason for approval or rejection..."
                      value={decisionReason}
                      onChange={(e) => setDecisionReason(e.target.value)}
                      rows={3}
                      className="w-full text-xs rounded border border-slate-300 px-2.5 py-2 outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDecide("rejected")}
                      disabled={deciding}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded text-xs font-semibold transition-colors disabled:opacity-60"
                    >
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                    <button
                      onClick={() => handleDecide("approved")}
                      disabled={deciding}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold transition-colors disabled:opacity-60"
                    >
                      <Check className="w-3.5 h-3.5" /> Approve
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-t border-slate-100 pt-4 text-xs space-y-1.5 bg-slate-50 p-3 rounded border border-slate-200">
                  <div className="font-semibold text-slate-800">HO Decision Log</div>
                  <div>
                    <strong>Outcome:</strong>{" "}
                    <span
                      className={
                        selectedRequest.status === "approved" ? "text-emerald-700" : "text-rose-700"
                      }
                    >
                      {selectedRequest.status === "approved" ? "Approved" : "Rejected"}
                    </span>
                  </div>
                  {selectedRequest.reason && (
                    <div>
                      <strong>Remarks:</strong> {selectedRequest.reason}
                    </div>
                  )}
                  {selectedRequest.decidedAt && (
                    <div className="text-[10px] text-slate-400">
                      Decided: {new Date(selectedRequest.decidedAt).toLocaleString("en-IN")}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="py-20 text-center text-slate-400 text-xs space-y-1.5">
              <AlertCircle className="w-6 h-6 text-slate-300 mx-auto" />
              <p>Select a change request from the left to view details and make decisions.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

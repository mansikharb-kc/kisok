"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flag as FlagIcon, AlertTriangle, CheckCircle, Search, Calendar, User, Check, X } from "lucide-react";

type Flag = {
  id: string;
  pipelineId: string;
  reason: string;
  stage: string;
  isResolved: boolean;
  resolvedAt: string | null;
  createdAt: string;
  pipeline: {
    brand: { name: string; code: string };
    assignment: {
      seller: { name: string; sellerCode: string };
      program: { name: string };
      exec: { fullName: string; email: string };
    };
  };
};

interface FlagsClientProps {
  initialFlags: Flag[];
  isHo: boolean;
  branchName?: string;
}

export default function FlagsClient({ initialFlags, isHo, branchName }: FlagsClientProps) {
  const router = useRouter();
  const [flags, setFlags] = useState<Flag[]>(initialFlags);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "resolved">("active");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const stageLabels: Record<string, string> = {
    INITIATION: "Initiation",
    SAMPLE_REQUEST: "Sample Request",
    TICKET_RAISED: "Sample Request (Raised)",
    CONSIGNMENT_RECEIVED: "Sample Request (Received)",
    DATA_AND_STICKER: "Data & Sticker",
    VERIFICATION: "Verification",
    CLOSED: "Verification",
  };

  async function handleResolve(id: string) {
    if (!confirm("Are you sure you want to mark this flag as resolved?")) return;
    setBusyId(id);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/flags/${id}`, { method: "PUT" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to resolve flag");
        return;
      }

      setFlags((prev) =>
        prev.map((f) => (f.id === id ? { ...f, isResolved: true, resolvedAt: new Date().toISOString() } : f))
      );
      setSuccess("Flag successfully marked as resolved!");
      setTimeout(() => setSuccess(""), 4000);
      router.refresh();
    } catch {
      setError("Failed to resolve flag due to a network error.");
    } finally {
      setBusyId(null);
    }
  }

  // Filter logic
  const filteredFlags = flags.filter((f) => {
    // 1. Status Filter
    if (statusFilter === "active" && f.isResolved) return false;
    if (statusFilter === "resolved" && !f.isResolved) return false;

    // 2. Search query (Seller name, code, brand name, reason)
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;

    return (
      f.reason.toLowerCase().includes(q) ||
      f.pipeline.brand.name.toLowerCase().includes(q) ||
      f.pipeline.assignment.seller.name.toLowerCase().includes(q) ||
      f.pipeline.assignment.seller.sellerCode.toLowerCase().includes(q) ||
      f.pipeline.assignment.program.name.toLowerCase().includes(q) ||
      f.stage.toLowerCase().includes(q)
    );
  });

  const activeCount = flags.filter((f) => !f.isResolved).length;
  const resolvedCount = flags.filter((f) => f.isResolved).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FlagIcon className="h-6 w-6 text-slate-700" />
            Onboarding Flags
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor and resolve blocks raised across seller onboarding pipeline stages {branchName && `· ${branchName}`}.
          </p>
        </div>
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

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="flex items-center gap-2 bg-white/60 backdrop-blur-md px-4 py-2.5 rounded-lg border border-slate-200 w-full max-w-md shadow-xs">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search by brand, seller, or reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-sm outline-none placeholder:text-slate-400 bg-transparent"
          />
        </div>

        {/* Tab Filters */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 shadow-xs self-start md:self-auto">
          <button
            onClick={() => setStatusFilter("active")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
              statusFilter === "active"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <AlertTriangle className={`h-3.5 w-3.5 ${statusFilter === "active" ? "text-amber-500" : ""}`} />
            Active ({activeCount})
          </button>
          <button
            onClick={() => setStatusFilter("resolved")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
              statusFilter === "resolved"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <CheckCircle className={`h-3.5 w-3.5 ${statusFilter === "resolved" ? "text-emerald-500" : ""}`} />
            Resolved ({resolvedCount})
          </button>
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
              statusFilter === "all"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All ({flags.length})
          </button>
        </div>
      </div>

      {/* Flags List Table */}
      <div className="bg-white/60 backdrop-blur-md rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <th className="px-6 py-4">Seller &amp; Brand</th>
                <th className="px-6 py-4">Stage</th>
                <th className="px-6 py-4">Reason for Block</th>
                <th className="px-6 py-4">Date Raised</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredFlags.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">
                    No onboarding flags found matching the selected filters.
                  </td>
                </tr>
              ) : (
                filteredFlags.map((flag) => {
                  const dateStr = new Date(flag.createdAt).toLocaleDateString("en-US", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  });

                  return (
                    <tr key={flag.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-bold text-slate-900">{flag.pipeline.brand.name}</div>
                          <div className="text-xs text-slate-500 font-medium mt-0.5">
                            {flag.pipeline.assignment.seller.name} ({flag.pipeline.assignment.seller.sellerCode})
                          </div>
                          <div className="text-[10px] text-brand-600 font-semibold bg-brand-50 border border-brand-100 px-1.5 py-0.5 rounded inline-block mt-1">
                            {flag.pipeline.assignment.program.name}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-700 text-xs">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                          {stageLabels[flag.stage] || flag.stage}
                        </span>
                      </td>
                      <td className="px-6 py-4 max-w-md">
                        <div className="text-slate-800 font-medium leading-relaxed break-words">
                          {flag.reason}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          <span>{dateStr}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 font-semibold text-slate-600">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          <span>{flag.pipeline.assignment.exec.fullName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            flag.isResolved
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-150"
                              : "bg-amber-50 text-amber-700 border border-amber-150"
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${flag.isResolved ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`} />
                          {flag.isResolved ? "Resolved" : "Active Flag"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {!flag.isResolved ? (
                          <button
                            onClick={() => handleResolve(flag.id)}
                            disabled={busyId === flag.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg text-xs font-bold transition shadow-xs"
                          >
                            <Check className="h-3.5 w-3.5" />
                            {busyId === flag.id ? "Resolving..." : "Resolve"}
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs font-semibold italic">
                            Resolved
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

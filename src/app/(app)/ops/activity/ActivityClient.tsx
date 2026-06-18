"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  BellOff,
  CheckCircle2,
  ExternalLink,
  Search,
  Clock,
  User,
  Building,
  Landmark,
  Calendar,
  LayoutGrid,
  Table as TableIcon,
} from "lucide-react";

interface ActivityClientProps {
  initialReminders: any[];
  isLead: boolean;
}

// Utility to parse DD-MMM-YYYY date format into a JS Date object
function parseDDMMMYYYY(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;
  const [dayStr, monthStr, yearStr] = parts;
  const day = parseInt(dayStr, 10);
  const year = parseInt(yearStr, 10);
  
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthIdx = months.indexOf(monthStr);
  if (monthIdx === -1 || isNaN(day) || isNaN(year)) return null;
  
  return new Date(year, monthIdx, day);
}

type RevisitStatus = "overdue" | "approaching" | "scheduled" | "unknown";

function getRevisitStatus(dateStr: string): { status: RevisitStatus; label: string; daysDiff?: number } {
  const date = parseDDMMMYYYY(dateStr);
  if (!date) return { status: "unknown", label: "Scheduled" };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  const diffTime = date.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { status: "overdue", label: "Overdue", daysDiff: Math.abs(diffDays) };
  } else if (diffDays <= 3) {
    return { status: "approaching", label: diffDays === 0 ? "Revisit Today" : `Due in ${diffDays} day${diffDays > 1 ? "s" : ""}`, daysDiff: diffDays };
  } else {
    return { status: "scheduled", label: `In ${diffDays} days`, daysDiff: diffDays };
  }
}

export default function ActivityClient({ initialReminders, isLead }: ActivityClientProps) {
  const router = useRouter();
  const [reminders, setReminders] = useState<any[]>(initialReminders);
  const [activeTab, setActiveTab] = useState<"pending" | "dismissed">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleToggleStatus = async (reminderId: string, currentStatus: "pending" | "dismissed") => {
    const nextStatus = currentStatus === "pending" ? "dismissed" : "pending";
    setBusyId(reminderId);
    setError("");

    try {
      const res = await fetch(`/api/reminders/${reminderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update reminder status");
        return;
      }
      
      // Update local state
      setReminders((prev) =>
        prev.map((r) => (r.id === reminderId ? { ...r, status: nextStatus } : r))
      );
      router.refresh();
    } catch {
      setError("Failed to modify reminder status due to a network error.");
    } finally {
      setBusyId(null);
    }
  };

  const filteredReminders = useMemo(() => {
    let list = reminders.filter((r) => r.status === activeTab);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((r) => {
        const sellerName = r.pipeline?.assignment?.seller?.name?.toLowerCase() ?? "";
        const sellerCode = r.pipeline?.assignment?.seller?.sellerCode?.toLowerCase() ?? "";
        const brandName = r.pipeline?.brand?.name?.toLowerCase() ?? "";
        const programName = r.pipeline?.assignment?.program?.name?.toLowerCase() ?? "";
        return (
          sellerName.includes(q) ||
          sellerCode.includes(q) ||
          brandName.includes(q) ||
          programName.includes(q)
        );
      });
    }

    return list;
  }, [reminders, activeTab, searchQuery]);

  const cardStyle = "bg-white/60 backdrop-blur-md rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all duration-200";

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3 py-2 font-medium">
          {error}
        </div>
      )}

      {/* Tabs & Search Bar & View Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Tabs Switcher */}
        <div className="flex border-b border-slate-200 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "pending"
                ? "border-brand-600 text-brand-600 bg-brand-50/10"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Bell className="h-4 w-4" />
            Active Reminders ({reminders.filter((r) => r.status === "pending").length})
          </button>
          <button
            onClick={() => setActiveTab("dismissed")}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "dismissed"
                ? "border-brand-600 text-brand-600 bg-brand-50/10"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`}
          >
            <BellOff className="h-4 w-4" />
            Dismissed / History ({reminders.filter((r) => r.status === "dismissed").length})
          </button>
        </div>

        {/* Search & View Toggle Container */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:flex-initial sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search seller, brand, program..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-250 pl-9 pr-4 py-2 text-xs focus:ring-1 focus:ring-brand-500 focus:outline-none bg-white font-medium"
            />
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center border border-slate-200 rounded-lg bg-white p-1 select-none shadow-xs shrink-0">
            <button
              onClick={() => setViewMode("cards")}
              className={`p-1.5 rounded transition ${
                viewMode === "cards"
                  ? "bg-slate-100 text-slate-800 font-bold"
                  : "text-slate-400 hover:text-slate-600"
              }`}
              title="Cards View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded transition ${
                viewMode === "table"
                  ? "bg-slate-100 text-slate-800 font-bold"
                  : "text-slate-400 hover:text-slate-600"
              }`}
              title="Table View"
            >
              <TableIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Reminders View Area */}
      {filteredReminders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 backdrop-blur-md p-12 text-center text-sm text-slate-400">
          {searchQuery ? "No reminders match your search." : activeTab === "pending" ? "No active revisit reminders." : "No reminders in history."}
        </div>
      ) : viewMode === "cards" ? (
        // CARDS VIEW
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredReminders.map((r) => {
            const assignment = r.pipeline?.assignment;
            const seller = assignment?.seller;
            const brand = r.pipeline?.brand;
            const program = assignment?.program;
            const execUser = assignment?.exec;

            return (
              <div key={r.id} className={cardStyle}>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-white font-bold">
                        {seller?.sellerCode}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-150 text-indigo-700 font-bold uppercase tracking-wide">
                        {brand?.name}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                        r.pipeline?.status === "CLOSED"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : r.pipeline?.status === "CONSIGNMENT_RECEIVED"
                          ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                          : "bg-brand-50 text-brand-700 border-brand-200"
                      }`}>
                        Stage: {r.pipeline?.status?.replace(/_/g, " ") ?? "Unknown"}
                      </span>
                      {r.status === "pending" && (
                        (() => {
                          const { status: rStatus, label: rLabel } = getRevisitStatus(r.dateToRevisit);
                          return (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                              rStatus === "overdue"
                                ? "bg-rose-50 text-rose-700 border-rose-250 animate-pulse"
                                : rStatus === "approaching"
                                ? "bg-amber-50 text-amber-700 border-amber-250"
                                : "bg-slate-50 text-slate-600 border-slate-200"
                            }`}>
                              {rLabel}
                            </span>
                          );
                        })()
                      )}
                    </div>
                    <h3 className="font-bold text-slate-800 text-sm mt-1.5">{seller?.name}</h3>
                  </div>

                  {/* Complete/Dismiss Button */}
                  <button
                    onClick={() => handleToggleStatus(r.id, r.status)}
                    disabled={busyId === r.id}
                    className={`rounded-lg p-2 transition shadow-sm ${
                      activeTab === "pending"
                        ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200"
                    } disabled:opacity-50`}
                    title={activeTab === "pending" ? "Dismiss Reminder" : "Re-activate Reminder"}
                  >
                    {busyId === r.id ? (
                      <span className="block h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
                    ) : activeTab === "pending" ? (
                      <CheckCircle2 className="h-4.5 w-4.5" />
                    ) : (
                      <Bell className="h-4.5 w-4.5" />
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <Landmark className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold leading-none uppercase">Program</span>
                      <span className="font-semibold text-slate-700 leading-tight">{program?.name || "—"}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold leading-none uppercase">Revisit Date</span>
                      <span className="font-bold text-rose-600 leading-tight">{r.dateToRevisit || "—"}</span>
                    </div>
                  </div>

                  {isLead && (
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold leading-none uppercase">Assigned Exec</span>
                        <span className="font-semibold text-slate-700 leading-tight">{execUser?.fullName || "—"}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold leading-none uppercase">Set On</span>
                      <span className="font-medium text-slate-500 leading-tight">
                        {new Date(r.createdAt).toLocaleDateString("en-US", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
                  {assignment && (
                    <Link
                      href={`/ops/onboarding/task/${assignment.id}?brandId=${brand?.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 px-3.5 py-1.5 text-xs font-semibold shadow-xs transition"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Go to Workspace
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // TABLE VIEW
        <div className="overflow-x-auto bg-white/60 backdrop-blur-md rounded-2xl border border-slate-200 shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-[10px] font-semibold uppercase tracking-wider">
                <th className="px-5 py-3">Seller Name &amp; Code</th>
                <th className="px-5 py-3">Brand &amp; Program</th>
                <th className="px-5 py-3">Stage</th>
                <th className="px-5 py-3">Revisit Status</th>
                {isLead && <th className="px-5 py-3">Assigned Exec</th>}
                <th className="px-5 py-3">Set On</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 text-xs">
              {filteredReminders.map((r) => {
                const assignment = r.pipeline?.assignment;
                const seller = assignment?.seller;
                const brand = r.pipeline?.brand;
                const program = assignment?.program;
                const execUser = assignment?.exec;
                const { status: rStatus, label: rLabel } = getRevisitStatus(r.dateToRevisit);

                return (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-slate-800">
                        {seller?.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono font-bold mt-0.5">
                        {seller?.sellerCode}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-700">
                        {brand?.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                        {program?.name}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                        r.pipeline?.status === "CLOSED"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-150"
                          : r.pipeline?.status === "CONSIGNMENT_RECEIVED"
                          ? "bg-indigo-50 text-indigo-700 border-indigo-150"
                          : "bg-brand-50 text-brand-700 border-brand-200"
                      }`}>
                        {r.pipeline?.status?.replace(/_/g, " ") ?? "Unknown"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col gap-1 items-start">
                        <span className="font-bold text-slate-800">{r.dateToRevisit}</span>
                        {r.status === "pending" && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                            rStatus === "overdue"
                              ? "bg-rose-50 text-rose-700 border-rose-250 animate-pulse"
                              : rStatus === "approaching"
                              ? "bg-amber-50 text-amber-700 border-amber-250"
                              : "bg-slate-50 text-slate-600 border-slate-200"
                          }`}>
                            {rLabel}
                          </span>
                        )}
                      </div>
                    </td>
                    {isLead && (
                      <td className="px-5 py-3.5 font-medium text-slate-705">
                        {execUser?.fullName || "—"}
                      </td>
                    )}
                    <td className="px-5 py-3.5 font-medium text-slate-500">
                      {new Date(r.createdAt).toLocaleDateString("en-US", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        {assignment && (
                          <Link
                            href={`/ops/onboarding/task/${assignment.id}?brandId=${brand?.id}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 px-2.5 py-1.5 text-xs font-semibold shadow-xs transition"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Workspace
                          </Link>
                        )}
                        <button
                          onClick={() => handleToggleStatus(r.id, r.status)}
                          disabled={busyId === r.id}
                          className={`rounded-lg p-1.5 transition shadow-sm border ${
                            activeTab === "pending"
                              ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-250"
                              : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
                          } disabled:opacity-50`}
                          title={activeTab === "pending" ? "Dismiss Reminder" : "Re-activate Reminder"}
                        >
                          {busyId === r.id ? (
                            <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
                          ) : activeTab === "pending" ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <Bell className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

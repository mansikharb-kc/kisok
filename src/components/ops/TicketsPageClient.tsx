"use client";

import { useState, useMemo } from "react";
import { Clock, CheckSquare, Layers, Inbox, HelpCircle } from "lucide-react";
import DashboardTicketsList from "./DashboardTicketsList";

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

interface TicketsPageClientProps {
  tickets: Ticket[];
  userRoles: string[];
}

export default function TicketsPageClient({ tickets, userRoles }: TicketsPageClientProps) {
  const isOnbLead = userRoles.includes("ONB_LEAD");
  const [activeTab, setActiveTab] = useState<"all" | "consignment" | "space_rack" | "kt_request">("all");

  // Helper to categorize tickets
  const categorizeTicket = (t: Ticket) => {
    if (["SAMPLE_REQUEST", "FABRICATION", "DAMAGE"].includes(t.type)) {
      return "consignment";
    }
    if (t.type === "SPACE_RACK") {
      return "space_rack";
    }
    if (t.type === "KT_REQUEST") {
      return "kt_request";
    }
    return "other";
  };

  // Filtered list
  const filteredTickets = useMemo(() => {
    if (!isOnbLead || activeTab === "all") return tickets;
    return tickets.filter((t) => categorizeTicket(t) === activeTab);
  }, [tickets, activeTab, isOnbLead]);

  // Tab counts
  const tabCounts = useMemo(() => {
    const counts = { all: tickets.length, consignment: 0, space_rack: 0, kt_request: 0 };
    tickets.forEach((t) => {
      const cat = categorizeTicket(t);
      if (cat === "consignment") counts.consignment++;
      else if (cat === "space_rack") counts.space_rack++;
      else if (cat === "kt_request") counts.kt_request++;
    });
    return counts;
  }, [tickets]);

  // Raised vs Resolved metrics for the CURRENTLY FILTERED tickets list
  const metrics = useMemo(() => {
    let raised = 0;
    let resolved = 0;
    filteredTickets.forEach((t) => {
      if (t.status === "RESOLVED" || t.status === "CLOSED") {
        resolved++;
      } else {
        raised++;
      }
    });
    return { raised, resolved };
  }, [filteredTickets]);

  return (
    <div className="space-y-6">
      {/* Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Raised Card */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md p-5 shadow-sm hover:border-amber-300 hover:shadow-md transition-all duration-200 group">
          <div className="absolute top-4 right-4 text-slate-400 group-hover:text-amber-500 transition-colors">
            <Clock className="w-5 h-5" />
          </div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Raised Tickets
          </div>
          <div className="text-3xl font-black mt-1.5 text-amber-600 dark:text-amber-500 leading-none">
            {metrics.raised}
          </div>
          <div className="text-xs text-slate-400 mt-2 font-medium">Awaiting operational resolution</div>
        </div>

        {/* Resolved Card */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md p-5 shadow-sm hover:border-emerald-400 hover:shadow-md transition-all duration-200 group">
          <div className="absolute top-4 right-4 text-slate-400 group-hover:text-emerald-500 transition-colors">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Resolved Tickets
          </div>
          <div className="text-3xl font-black mt-1.5 text-emerald-600 dark:text-emerald-500 leading-none">
            {metrics.resolved}
          </div>
          <div className="text-xs text-slate-400 mt-2 font-medium">Successfully completed or closed</div>
        </div>
      </div>

      {/* Role / Type Filter Tabs for Onboarding Lead */}
      {isOnbLead && (
        <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          {(
            [
              { id: "all", label: "All Tickets" },
              { id: "consignment", label: "Consignment / QC" },
              { id: "space_rack", label: "Space & Rack" },
              { id: "kt_request", label: "Knowledge Transfer" },
            ] as const
          ).map((tab) => {
            const isActive = activeTab === tab.id;
            const count = tabCounts[tab.id];
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all hover:bg-slate-100 dark:hover:bg-slate-800/50 ${
                  isActive
                    ? "bg-slate-900 text-white hover:bg-slate-900 dark:bg-white dark:text-slate-900"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-md font-extrabold ${
                    isActive
                      ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-800"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Ticket List */}
      <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
        <DashboardTicketsList tickets={filteredTickets} userRoles={userRoles} />
      </div>
    </div>
  );
}

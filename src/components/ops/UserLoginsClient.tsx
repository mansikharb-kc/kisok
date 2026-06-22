"use client";

import { useState, useMemo, useEffect } from "react";
import { ROLE_LABELS, RoleCode } from "@/lib/rbac";
import { Search, Shield, Clock, Power, RefreshCw, Users } from "lucide-react";

type SessionLog = {
  id: string;
  userId: string;
  username: string;
  fullName: string;
  role: string;
  loginTime: string;
  logoutTime: string | null;
  logoutType: string | null;
  lastActive: string;
};

export default function UserLoginsClient({
  initialLogs,
  branchName,
}: {
  initialLogs: SessionLog[];
  branchName: string;
}) {
  const [logs, setLogs] = useState<SessionLog[]>(initialLogs);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [refreshing, setRefreshing] = useState(false);

  async function fetchLogs(silent = false) {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch("/api/ops/user-logins");
      if (res.ok) {
        const data = await res.json();
        if (data.logs) {
          setLogs(data.logs);
        }
      }
    } catch (e) {
      console.error("Failed to fetch user login sessions:", e);
    } finally {
      if (!silent) setRefreshing(false);
    }
  }

  useEffect(() => {
    // Poll dynamically every 10 seconds silently
    const interval = setInterval(() => {
      fetchLogs(true);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch =
        log.fullName.toLowerCase().includes(search.toLowerCase()) ||
        log.username.toLowerCase().includes(search.toLowerCase());

      const matchesRole = roleFilter === "ALL" || log.role === roleFilter;

      let matchesStatus = true;
      if (statusFilter === "ACTIVE") {
        matchesStatus = !log.logoutTime;
      } else if (statusFilter === "TIMEOUT") {
        matchesStatus = !!log.logoutTime && log.logoutType === "timeout";
      } else if (statusFilter === "MANUAL") {
        matchesStatus = !!log.logoutTime && log.logoutType === "manual";
      }

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [logs, search, roleFilter, statusFilter]);

  const stats = useMemo(() => {
    const active = logs.filter((l) => !l.logoutTime).length;
    const timeouts = logs.filter((l) => l.logoutTime && l.logoutType === "timeout").length;
    const manual = logs.filter((l) => l.logoutTime && l.logoutType === "manual").length;
    return { active, timeouts, manual, total: logs.length };
  }, [logs]);

  function formatDateTime(dateStr: string) {
    return new Date(dateStr).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  }

  function getStatusBadge(log: SessionLog) {
    if (!log.logoutTime) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Active
        </span>
      );
    }
    if (log.logoutType === "timeout") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Timeout
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 border border-slate-200">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
        Manual
      </span>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Login Sessions</h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor user activity, in/out timings, and active dashboards for {branchName}.
          </p>
        </div>
        <button
          onClick={() => fetchLogs()}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-350 disabled:opacity-60 transition-all shadow-sm shrink-0"
        >
          <RefreshCw className={`w-4 h-4 text-slate-500 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-white/60 backdrop-blur-md p-5 shadow-sm hover:shadow-md hover:border-indigo-400 transition-all duration-200 group">
          <div className="absolute top-4 right-4 text-slate-400 group-hover:text-indigo-500 transition-colors">
            <Clock className="w-5 h-5" />
          </div>
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Sessions</div>
          <div className="text-3xl font-black mt-1.5 text-slate-900 leading-none">{stats.total}</div>
        </div>
        <div className="relative overflow-hidden rounded-xl border border-emerald-250 bg-emerald-50/20 backdrop-blur-md p-5 shadow-sm hover:shadow-md hover:border-emerald-400 transition-all duration-200 group animate-fade-in">
          <div className="absolute top-4 right-4 text-emerald-400 group-hover:text-emerald-500 transition-colors">
            <Users className="w-5 h-5" />
          </div>
          <div className="text-xs font-medium text-emerald-650 uppercase tracking-wider">Active Users</div>
          <div className="text-3xl font-black mt-1.5 text-emerald-700 leading-none">{stats.active}</div>
        </div>
        <div className="relative overflow-hidden rounded-xl border border-amber-250 bg-amber-50/20 backdrop-blur-md p-5 shadow-sm hover:shadow-md hover:border-amber-400 transition-all duration-200 group">
          <div className="absolute top-4 right-4 text-amber-400 group-hover:text-amber-500 transition-colors">
            <Clock className="w-5 h-5" />
          </div>
          <div className="text-xs font-medium text-amber-650 uppercase tracking-wider">Auto-Logouts (Timeouts)</div>
          <div className="text-3xl font-black mt-1.5 text-amber-700 leading-none">{stats.timeouts}</div>
        </div>
        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50/40 backdrop-blur-md p-5 shadow-sm hover:shadow-md hover:border-slate-400 transition-all duration-200 group">
          <div className="absolute top-4 right-4 text-slate-400 group-hover:text-slate-500 transition-colors">
            <Power className="w-5 h-5" />
          </div>
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Manual Logouts</div>
          <div className="text-3xl font-black mt-1.5 text-slate-700 leading-none">{stats.manual}</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md shadow-sm">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by username or full name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-lg border border-slate-250 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 bg-white/80 text-slate-800 placeholder-slate-450 transition duration-150"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white font-medium text-slate-700"
            >
              <option value="ALL">All Roles</option>
              <option value="OB_EXEC">Onboarding Exec</option>
              <option value="CONSIGNMENT_USER">Consignment User</option>
              <option value="CONCIERGE_MANAGER">Concierge Manager</option>
              <option value="PROJECT_USER">Project User</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white font-medium text-slate-700"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="TIMEOUT">Timeout</option>
              <option value="MANUAL">Manual</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            No session logs found matching the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-4 text-left">User</th>
                  <th className="px-5 py-4 text-left">Dashboard/Role</th>
                  <th className="px-5 py-4 text-left">Login (In-Time)</th>
                  <th className="px-5 py-4 text-left">Logout (Out-Time)</th>
                  <th className="px-5 py-4 text-left">Status / Type</th>
                  <th className="px-5 py-4 text-left">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div>
                        <div className="font-semibold text-slate-800">{log.fullName}</div>
                        <div className="text-xs text-slate-400">@{log.username}</div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                        <Shield className="w-4 h-4 text-slate-400 shrink-0" />
                        {ROLE_LABELS[log.role as RoleCode] ?? log.role}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                        {formatDateTime(log.loginTime)}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {log.logoutTime ? (
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Power className="w-4 h-4 text-slate-400 shrink-0" />
                          {formatDateTime(log.logoutTime)}
                        </div>
                      ) : (
                        <span className="text-slate-350 italic font-medium">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      {getStatusBadge(log)}
                    </td>
                    <td className="px-5 py-4 text-slate-500 font-medium border-l border-slate-50">
                      {formatDateTime(log.lastActive)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

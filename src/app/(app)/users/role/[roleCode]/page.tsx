"use client";

import { useEffect, useState, useMemo } from "react";
import { Plus, Edit2, Trash2, Shield, User as UserIcon, X, Check, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Role = {
  id: string;
  code: string;
  name: string;
  description: string;
};

type Branch = {
  id: string;
  name: string;
  branchCode: string;
};

type UserRoleAssignment = {
  id?: string;
  roleId: string;
  branchId: string | null;
  role?: Role;
  branch?: Branch;
};

type User = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  status: string;
  roles: UserRoleAssignment[];
};

const SLUG_TO_ROLE: Record<string, string> = {
  "ho-admin": "HO_ADMIN",
  "branch-admin": "BRANCH_ADMIN",
  "onb-lead": "ONB_LEAD",
  "consignment-user": "CONSIGNMENT_USER",
  "ob-exec": "OB_EXEC",
};

const ROLE_NAME_MAP: Record<string, string> = {
  "ho-admin": "HO Admins",
  "branch-admin": "Branch Admins",
  "onb-lead": "Onboarding Leads",
  "consignment-user": "Consignment Users",
  "ob-exec": "Onboarding Execs",
};

interface PageProps {
  params: { roleCode: string };
}

export default function RoleUsersPage({ params }: PageProps) {
  const { roleCode } = params;
  const router = useRouter();

  const targetRoleCode = SLUG_TO_ROLE[roleCode] ?? "";
  const roleDisplayName = ROLE_NAME_MAP[roleCode] ?? "Users";

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState("");

  useEffect(() => {
    fetchUsers();
    setBranchFilter("");
  }, [roleCode]);

  async function fetchUsers() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users ?? []);
      } else {
        setError(data.error || "Failed to load users.");
      }
    } catch {
      setError("Failed to load users from the API.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Are you sure you want to remove user "${name}" or their roles?`)) return;

    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to delete user.");
        return;
      }

      setSuccess("User deleted/disassociated successfully.");
      fetchUsers();
    } catch {
      setError("Failed to execute deletion.");
    }
  }

  // Extract unique branches matching the current role code
  const availableBranches = useMemo(() => {
    const branchesMap = new Map<string, Branch>();
    users.forEach((u) => {
      u.roles.forEach((r) => {
        if (r.role?.code === targetRoleCode && r.branch) {
          branchesMap.set(r.branch.id, r.branch);
        }
      });
    });
    return Array.from(branchesMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [users, targetRoleCode]);

  // Filter users to only include those that have assignments for the current role Code
  const filteredUsers = users
    .filter((u) => u.roles.some((r) => r.role?.code === targetRoleCode))
    .filter((u) => {
      if (roleCode !== "ho-admin" && branchFilter) {
        return u.roles.some((r) => r.role?.code === targetRoleCode && r.branchId === branchFilter);
      }
      return true;
    })
    .filter((u) => {
      const q = searchQuery.toLowerCase();
      return (
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone && u.phone.includes(q)) ||
        u.roles.some((r) => r.branch?.name.toLowerCase().includes(q))
      );
    });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-slate-400">Loading {roleDisplayName.toLowerCase()}...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{roleDisplayName}</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage user profiles, accounts, and branch scopes for the {roleDisplayName} directory.
          </p>
        </div>
        <Link
          href={`/users/role/${roleCode}/new`}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add {roleDisplayName.replace(/s$/, "")}
        </Link>
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
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="flex items-center gap-2 bg-white/60 backdrop-blur-md px-4 py-3 rounded-lg border border-slate-200 w-full max-w-md">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder={`Search ${roleDisplayName.toLowerCase()}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-sm outline-none placeholder:text-slate-400 bg-transparent"
          />
        </div>
        {roleCode !== "ho-admin" && (
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md px-3 py-3 text-sm focus:border-brand-500 focus:outline-none min-w-[200px] shadow-sm"
          >
            <option value="">All Branches</option>
            {availableBranches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.branchCode})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-white/60 backdrop-blur-md rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Phone</th>
                <th className="px-6 py-4">Branch Scope</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-400">
                    No {roleDisplayName.toLowerCase()} matching the filters were found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  // Filter roles to display only the scopes of the current page's role
                  const currentRoleAssignments = user.roles.filter(
                    (r) => r.role?.code === targetRoleCode,
                  );

                  return (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                            <UserIcon className="w-4 h-4 text-slate-600" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800">{user.fullName}</div>
                            <div className="text-xs text-slate-500">
                              {user.email} {(user as any).username ? `· @${(user as any).username}` : ""}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{user.phone || "—"}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1.5 max-w-md">
                          {currentRoleAssignments.map((r, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border bg-blue-50 text-blue-700 border-blue-200"
                            >
                              <Shield className="w-3 h-3" />
                              {r.branch ? r.branch.name : "Global"}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            user.status === "active"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {user.status === "active" ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/users/role/${roleCode}/${user.id}`}
                            className="p-1 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-900 transition-colors"
                            title="Edit User"
                          >
                            <Edit2 className="w-4.5 h-4.5" />
                          </Link>
                          <button
                            onClick={() => handleDelete(user.id, user.fullName)}
                            className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-700 transition-colors"
                            title="Delete / Revoke Roles"
                          >
                            <Trash2 className="w-4.5 h-4.5" />
                          </button>
                        </div>
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

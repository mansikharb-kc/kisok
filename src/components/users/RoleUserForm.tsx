"use client";

import { useEffect, useState } from "react";
import { isValidPhone, isValidEmail, isNonEmptyString } from "../../lib/validation";
import { Plus, X, ArrowLeft } from "lucide-react";
import Link from "next/link";

export type Role = {
  id: string;
  code: string;
  name: string;
  description: string;
};

export type Branch = {
  id: string;
  name: string;
  branchCode: string;
};

export type UserRoleAssignment = {
  id?: string;
  roleId: string;
  branchId: string | null;
  role?: Role;
  branch?: Branch;
};

export type UserFormData = {
  fullName: string;
  email: string;
  username: string;
  phone: string;
  password?: string;
  status: string;
};

interface RoleUserFormProps {
  mode: "create" | "edit";
  roleSlug: string;
  initialUser?: {
    id: string;
    fullName: string;
    email: string;
    username?: string | null;
    phone: string | null;
    status: string;
    roles: UserRoleAssignment[];
  };
  onSubmit: (formData: UserFormData, assignments: { roleId: string; branchId: string | null }[]) => Promise<void>;
  saving: boolean;
  error: string;
}

const SLUG_TO_ROLE: Record<string, string> = {
  "ho-admin": "HO_ADMIN",
  "branch-admin": "BRANCH_ADMIN",
  "onb-lead": "ONB_LEAD",
  "consignment-user": "CONSIGNMENT_USER",
  "ob-exec": "OB_EXEC",
  "project-user": "PROJECT_USER",
  "concierge-manager": "CONCIERGE_MANAGER",
  "screen-manager": "SCREEN_MANAGER",
};

const ROLE_NAME_MAP: Record<string, string> = {
  "ho-admin": "HO Admin",
  "branch-admin": "Branch Admin",
  "onb-lead": "Onboarding Lead",
  "consignment-user": "Consignment User",
  "ob-exec": "Onboarding Exec",
  "project-user": "Project User",
  "concierge-manager": "Concierge Manager",
  "screen-manager": "RMS Manager",
};

export default function RoleUserForm({
  mode,
  roleSlug,
  initialUser,
  onSubmit,
  saving,
  error: propError,
}: RoleUserFormProps) {
  const targetRoleCode = SLUG_TO_ROLE[roleSlug] ?? "";
  const roleDisplayName = ROLE_NAME_MAP[roleSlug] ?? "User";

  const [roles, setRoles] = useState<Role[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [sessionUser, setSessionUser] = useState<{ isHo: boolean; adminBranchIds: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState<UserFormData>({
    fullName: "",
    email: "",
    username: "",
    phone: "",
    password: "",
    status: "active",
  });

  // State to hold assignments for the CURRENT role
  const [formAssignments, setFormAssignments] = useState<{ roleId: string; branchId: string | null }[]>([]);
  // State to preserve other roles if editing
  const [preservedAssignments, setPreservedAssignments] = useState<{ roleId: string; branchId: string | null }[]>([]);

  useEffect(() => {
    fetchMetadata();
  }, []);

  async function fetchMetadata() {
    setLoading(true);
    setError("");
    try {
      const [meRes, branchesRes, rolesRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/branches"),
        fetch("/api/roles"),
      ]);

      const [meData, branchesData, rolesData] = await Promise.all([
        meRes.json(),
        branchesRes.json(),
        rolesRes.json(),
      ]);

      const sessionRoles: { code: string; branchId: string | null }[] = meData.session?.roles ?? [];
      const isHo = sessionRoles.some((r) => r.code === "HO_ADMIN");
      const branchAdminBranchIds = sessionRoles
        .filter((r) => r.code === "BRANCH_ADMIN" && r.branchId)
        .map((r) => r.branchId as string);

      setSessionUser({
        isHo,
        adminBranchIds: branchAdminBranchIds,
      });

      const loadedRoles: Role[] = rolesData.roles ?? [];
      const loadedBranches: Branch[] = branchesData.branches ?? [];

      setRoles(loadedRoles);
      setBranches(loadedBranches);

      // Once metadata is loaded, setup form states
      const targetRole = loadedRoles.find((r) => r.code === targetRoleCode);
      const targetRoleId = targetRole?.id ?? "";

      if (mode === "create") {
        setFormData({ fullName: "", email: "", username: "", phone: "", password: "", status: "active" });
        // Set default assignment
        const defaultBranchId = isHo
          ? (loadedBranches.length > 0 ? loadedBranches[0].id : null)
          : (branchAdminBranchIds[0] ?? null);
        setFormAssignments([{ roleId: targetRoleId, branchId: defaultBranchId }]);
      } else if (mode === "edit" && initialUser) {
        setFormData({
          fullName: initialUser.fullName,
          email: initialUser.email,
          username: initialUser.username || "",
          phone: initialUser.phone || "",
          password: "",
          status: initialUser.status,
        });

        // Filter assignments:
        // - Those matching targetRoleCode go to editable formAssignments
        // - Those matching other roles go to preservedAssignments
        const editable: { roleId: string; branchId: string | null }[] = [];
        const preserved: { roleId: string; branchId: string | null }[] = [];

        for (const r of initialUser.roles) {
          if (r.role?.code === targetRoleCode) {
            editable.push({ roleId: r.roleId, branchId: r.branchId });
          } else {
            preserved.push({ roleId: r.roleId, branchId: r.branchId });
          }
        }

        // If editable is empty (somehow), add a default row for the target role
        if (editable.length === 0) {
          const defaultBranchId = isHo
            ? (loadedBranches.length > 0 ? loadedBranches[0].id : null)
            : (branchAdminBranchIds[0] ?? null);
          editable.push({ roleId: targetRoleId, branchId: defaultBranchId });
        }

        setFormAssignments(editable);
        setPreservedAssignments(preserved);
      }
    } catch {
      setError("Failed to load metadata.");
    } finally {
      setLoading(false);
    }
  }

  // Get branches available for assignment
  function getAvailableBranches(): Branch[] {
    if (sessionUser?.isHo) return branches;
    return branches.filter((b) => sessionUser?.adminBranchIds.includes(b.id));
  }

  function addAssignmentRow() {
    const targetRoleId = roles.find((r) => r.code === targetRoleCode)?.id ?? "";
    const defaultBranchId = sessionUser?.isHo
      ? (branches.length > 0 ? branches[0].id : null)
      : (sessionUser?.adminBranchIds[0] ?? null);
    setFormAssignments([...formAssignments, { roleId: targetRoleId, branchId: defaultBranchId }]);
  }

  function removeAssignmentRow(index: number) {
    const next = [...formAssignments];
    next.splice(index, 1);
    setFormAssignments(next);
  }

  function updateAssignmentRow(index: number, branchId: string | null) {
    const next = [...formAssignments];
    next[index] = {
      ...next[index],
      branchId,
    };
    setFormAssignments(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Validate required text fields
    if (!isNonEmptyString(formData.fullName)) {
      setError("Full Name is required");
      return;
    }
    if (!isNonEmptyString(formData.username)) {
      setError("Username is required");
      return;
    }
    // Validate email and phone
    if (formData.email && !isValidEmail(formData.email)) {
      setError("Please enter a valid email address containing '@'");
      return;
    }
    if (formData.phone && !isValidPhone(formData.phone)) {
      setError("Phone number must be exactly 10 digits");
      return;
    }
    if (formAssignments.length === 0) {
      setError("Please assign at least one branch scope.");
      return;
    }

    // Combine form (editable) assignments with preserved (other roles) assignments
    const combined = [...formAssignments, ...preservedAssignments];
    await onSubmit(formData, combined);
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-slate-400">Loading form settings...</p>
      </div>
    );
  }

  const listUrl = `/users/role/${roleSlug}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={listUrl}
          className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {mode === "create" ? `Create ${roleDisplayName}` : `Edit ${roleDisplayName}`}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {mode === "create"
              ? `Add a new account with the ${roleDisplayName} role.`
              : `Modify profile details and branch scopes for this ${roleDisplayName}.`}
          </p>
        </div>
      </div>

      {(error || propError) && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error || propError}
        </div>
      )}

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white/60 backdrop-blur-md rounded-xl border border-slate-200 shadow-sm overflow-hidden" autoComplete="off">
        <div className="p-6 space-y-6">
          {/* Identity Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase">Full Name</label>
              <input
                type="text"
                required
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full text-sm rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="Enter full name"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase">Email Address</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full text-sm rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="name@kc.local"
                autoComplete="new-email"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase">Username</label>
              <input
                type="text"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full text-sm rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="Enter username"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase">Phone Number</label>
              <input
                type="tel"
                maxLength={10}
                pattern="\d{10}"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, "") })}
                className="w-full text-sm rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase">
                {mode === "edit" ? "Change Password (Optional)" : "Password"}
              </label>
              <input
                type="password"
                required={mode === "create"}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full text-sm rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:ring-1 focus:ring-brand-500"
                placeholder={mode === "edit" ? "Leave blank to keep same" : "Minimum 4 characters"}
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase">Account Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full text-sm rounded-lg border border-slate-300 px-4 py-2.5 outline-none bg-white/60 backdrop-blur-md focus:ring-1 focus:ring-brand-500"
              >
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase">Role Type</label>
              <input
                type="text"
                disabled
                value={roleDisplayName}
                className="w-full text-sm rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-500 cursor-not-allowed"
              />
            </div>
          </div>

          {/* Branch Assignments Section */}
          <div className="border-t border-slate-100 pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Branch Scope Mapping</h3>
                <p className="text-xs text-slate-500 mt-0.5">Assign which branches this {roleDisplayName} can operate in.</p>
              </div>
              {targetRoleCode !== "HO_ADMIN" && sessionUser?.isHo && (
                <button
                  type="button"
                  onClick={addAssignmentRow}
                  className="text-xs text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1 px-3 py-1.5 border border-brand-100 hover:border-brand-200 rounded-lg hover:bg-brand-50 transition"
                >
                  <Plus className="w-4 h-4" /> Add Branch Scope
                </button>
              )}
            </div>

            <div className="space-y-3">
              {targetRoleCode === "HO_ADMIN" ? (
                <div className="flex items-center gap-2 bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div className="flex-1">
                    <span className="text-sm text-slate-600 font-medium">Global (HO Admin has full system access across all branches)</span>
                  </div>
                </div>
              ) : (
                formAssignments.map((a, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                    <div className="flex-1 min-w-0">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Select Branch</label>
                      {!sessionUser?.isHo ? (
                        // Branch Admin: locked to their own branch
                        <select
                          value={a.branchId || ""}
                          disabled
                          className="w-full text-sm rounded border border-slate-200 px-3 py-2 outline-none bg-slate-100 text-slate-600 cursor-not-allowed"
                        >
                          {getAvailableBranches().map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                      ) : (
                        // HO Admin: full branch selector
                        <select
                          value={a.branchId || ""}
                          onChange={(e) => updateAssignmentRow(idx, e.target.value || null)}
                          className="w-full text-sm rounded border border-slate-300 px-3 py-2 outline-none bg-white/60 backdrop-blur-md focus:ring-1 focus:ring-brand-500"
                        >
                          <option value="">— Select Branch —</option>
                          {getAvailableBranches().map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    {formAssignments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAssignmentRow(idx)}
                        className="self-end p-2.5 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded-lg transition-colors mb-0.5"
                        title="Remove branch scope"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-6 py-4 flex items-center justify-end gap-3 bg-slate-50">
          <Link
            href={listUrl}
            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            {saving ? "Saving changes…" : "Save User"}
          </button>
        </div>
      </form>
    </div>
  );
}

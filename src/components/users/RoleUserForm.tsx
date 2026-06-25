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
  avatarUrl?: string | null;
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
    avatarUrl?: string | null;
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
    avatarUrl: null,
  });

  // State to hold assignments for the CURRENT role
  const [formAssignments, setFormAssignments] = useState<{ roleId: string; branchId: string | null }[]>([]);
  // State to preserve other roles if editing
  const [preservedAssignments, setPreservedAssignments] = useState<{ roleId: string; branchId: string | null }[]>([]);

  const [uploading, setUploading] = useState(false);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("File is too large (max 5 MB)");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to upload image");
        return;
      }

      setFormData((prev) => ({
        ...prev,
        avatarUrl: data.url,
      }));
    } catch {
      setError("Failed to upload image.");
    } finally {
      setUploading(false);
    }
  }

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
        setFormData({ fullName: "", email: "", username: "", phone: "", password: "", status: "active", avatarUrl: null });
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
          avatarUrl: initialUser.avatarUrl || null,
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
          {/* Profile Image Section */}
          <div className="flex flex-col sm:flex-row items-center gap-5 border-b border-slate-100 pb-6">
            <div className="relative group w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center shrink-0 overflow-hidden shadow-sm hover:border-brand-500 transition-colors">
              {formData.avatarUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={formData.avatarUrl} alt="Avatar Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <span className="text-[10px] text-white font-semibold">Change</span>
                  </div>
                </>
              ) : (
                <div className="text-center flex flex-col items-center justify-center p-2 text-slate-400 dark:text-slate-500">
                  <svg className="w-6 h-6 mb-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                  </svg>
                  <span className="text-[9px] font-medium tracking-tight">Upload</span>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploading}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>
            <div className="flex-1 text-center sm:text-left space-y-1">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Profile Photograph</h4>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {uploading ? "Uploading your image..." : "Upload a PNG, JPG, or WEBP photo. (Max 5MB)"}
              </p>
              {formData.avatarUrl && !uploading && (
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, avatarUrl: null })}
                  className="text-xs text-rose-600 hover:text-rose-700 font-semibold transition animate-fade-in"
                >
                  Remove Photo
                </button>
              )}
            </div>
          </div>

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

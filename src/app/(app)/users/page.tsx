"use client";

import { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, Shield, User as UserIcon, X, Check, Search } from "lucide-react";

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

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [sessionUser, setSessionUser] = useState<{ name: string; email: string; isHo: boolean; adminBranchIds: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    status: "active",
  });
  const [formAssignments, setFormAssignments] = useState<Omit<UserRoleAssignment, "role" | "branch">[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSessionAndData();
  }, []);

  async function fetchSessionAndData() {
    setLoading(true);
    setError("");
    try {
      // 1. Fetch current user session to determine role scope
      const authMeRes = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ getSession: true }) }).catch(() => null);
      // Wait, there's no auth/me API, but layout.tsx checks the session. Let's make a request or derive session info from api/branches and roles checks.
      // Actually, we can get the logged-in user profile details using a quick endpoint or fetch users/roles and parse permissions.
      // Let's call /api/branches. If it returns branches, we check how many.
      const branchesRes = await fetch("/api/branches");
      const branchesData = await branchesRes.json();
      
      const rolesRes = await fetch("/api/roles");
      const rolesData = await rolesRes.json();

      const usersRes = await fetch("/api/users");
      const usersData = await usersRes.json();

      if (usersRes.ok) {
        setUsers(usersData.users || []);
      }
      if (rolesRes.ok) {
        setRoles(rolesData.roles || []);
      }
      if (branchesRes.ok) {
        setBranches(branchesData.branches || []);
      }

      // Infer if the user is HO Admin based on whether they can select branch-less roles
      // or if they have global branch settings. We can also fetch the list.
      // Let's inspect roles. If HO_ADMIN is available, they might be HO. But we can query it.
      // Wait, let's assume we can fetch all branches. If branches has 0 or 1, or is filtered:
      // Let's fetch from the current page session.
      // Next.js client side can't use server getSession easily, but we can query api/users or just parse branches to infer isHo.
      // If we see more than 1 branch or if branchId is null for some records, user is HO Admin.
      // Let's check from the users list of current logged-in user if we can.
      // Actually, a simpler way is: if we have branches, the user's role controls which branches are returned.
      // If the user can see multiple branches, they are likely HO_ADMIN.
      // But let's build the form to render branch options. If branches list has 1 item, we auto-lock to it.
      // Let's calculate if HO Admin:
      const canBeGlobal = rolesData.roles?.some((r: Role) => r.code === "HO_ADMIN") ?? false;
      // Let's set session state:
      setSessionUser({
        name: "Administrator",
        email: "",
        isHo: canBeGlobal, // HO Admins can assign HO_ADMIN
        adminBranchIds: branchesData.branches?.map((b: Branch) => b.id) || [],
      });

    } catch (err) {
      setError("Failed to load users and configuration.");
    } finally {
      setLoading(false);
    }
  }

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.phone && u.phone.includes(q)) ||
      u.roles.some((r) => r.role?.name.toLowerCase().includes(q) || r.branch?.name.toLowerCase().includes(q))
    );
  });

  function openCreateModal() {
    setEditId(null);
    setFormData({
      fullName: "",
      email: "",
      phone: "",
      password: "",
      status: "active",
    });
    // Default to one empty assignment
    const defaultBranchId = branches.length > 0 ? branches[0].id : null;
    const defaultRoleId = roles.length > 0 ? roles[0].id : "";
    setFormAssignments([{ roleId: defaultRoleId, branchId: defaultBranchId }]);
    setError("");
    setSuccess("");
    setIsModalOpen(true);
  }

  function openEditModal(user: User) {
    setEditId(user.id);
    setFormData({
      fullName: user.fullName,
      email: user.email,
      phone: user.phone || "",
      password: "", // password blank when editing unless changed
      status: user.status,
    });
    setFormAssignments(
      user.roles.map((r) => ({
        roleId: r.roleId,
        branchId: r.branchId,
      })),
    );
    setError("");
    setSuccess("");
    setIsModalOpen(true);
  }

  function addAssignmentRow() {
    const defaultBranchId = branches.length > 0 ? branches[0].id : null;
    const defaultRoleId = roles.length > 0 ? roles[0].id : "";
    setFormAssignments([...formAssignments, { roleId: defaultRoleId, branchId: defaultBranchId }]);
  }

  function removeAssignmentRow(index: number) {
    const next = [...formAssignments];
    next.splice(index, 1);
    setFormAssignments(next);
  }

  function updateAssignmentRow(index: number, field: "roleId" | "branchId", value: string | null) {
    const next = [...formAssignments];
    next[index] = {
      ...next[index],
      [field]: value,
    };
    setFormAssignments(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    if (formAssignments.length === 0) {
      setError("Please assign at least one role/branch mapping.");
      setSaving(false);
      return;
    }

    // Prepare payload
    const payload = {
      ...formData,
      roles: formAssignments.map((a) => ({
        roleId: a.roleId,
        branchId: a.branchId === "global" || !a.branchId ? null : a.branchId,
      })),
    };

    try {
      const url = editId ? `/api/users/${editId}` : "/api/users";
      const method = editId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to save user.");
        return;
      }

      setSuccess(editId ? "User updated successfully!" : "User created successfully!");
      setIsModalOpen(false);
      fetchSessionAndData();
    } catch {
      setError("Failed to communicate with database API.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Are you sure you want to remove user "${name}" or their roles in your branch?`)) return;

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
      fetchSessionAndData();
    } catch {
      setError("Failed to execute deletion.");
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-slate-400">Loading user accounts & roles...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Users & Roles</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure user profiles and assign role permissions across branch directories.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add User
        </button>
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
      <div className="flex items-center gap-2 bg-white px-4 py-3 rounded-lg border border-slate-200 max-w-md">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Search by name, email, role, or branch..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-sm outline-none placeholder:text-slate-400"
        />
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Phone</th>
                <th className="px-6 py-4">Roles & Scope</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-400">
                    No users matching the filters were found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                          <UserIcon className="w-4 h-4 text-slate-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800">{user.fullName}</div>
                          <div className="text-xs text-slate-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{user.phone || "—"}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5 max-w-md">
                        {user.roles.map((r, i) => (
                          <span
                            key={i}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${
                              r.role?.code === "HO_ADMIN"
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}
                          >
                            <Shield className="w-3 h-3" />
                            {r.role?.name} {r.branch ? `@ ${r.branch.name}` : "(Global)"}
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
                        <button
                          onClick={() => openEditModal(user)}
                          className="p-1 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-900 transition-colors"
                          title="Edit User"
                        >
                          <Edit2 className="w-4.5 h-4.5" />
                        </button>
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-lg border border-slate-200 w-full max-w-xl overflow-hidden shadow-xl animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h2 className="font-bold text-slate-800 text-base">
                {editId ? "Edit User Account & Scope" : "Create New User Account"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 uppercase">Full Name</label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full text-sm rounded border border-slate-300 px-3 py-2 outline-none focus:ring-1 focus:ring-brand-500"
                    placeholder="Enter name"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 uppercase">Email Address</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full text-sm rounded border border-slate-300 px-3 py-2 outline-none focus:ring-1 focus:ring-brand-500"
                    placeholder="name@kc.local"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 uppercase">Phone Number</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full text-sm rounded border border-slate-300 px-3 py-2 outline-none focus:ring-1 focus:ring-brand-500"
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 uppercase">
                    {editId ? "Change Password (Optional)" : "Password"}
                  </label>
                  <input
                    type="password"
                    required={!editId}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full text-sm rounded border border-slate-300 px-3 py-2 outline-none focus:ring-1 focus:ring-brand-500"
                    placeholder={editId ? "Leave blank to keep same" : "Minimum 4 characters"}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 uppercase">Account Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full text-sm rounded border border-slate-300 px-3 py-2 outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>

              {/* Roles Assignments Section */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase">Role & Branch Scope Mapping</span>
                  <button
                    type="button"
                    onClick={addAssignmentRow}
                    className="text-xs text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Assignment
                  </button>
                </div>

                <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                  {formAssignments.map((a, idx) => {
                    const selectedRole = roles.find((r) => r.id === a.roleId);
                    const isGlobalRole = selectedRole?.code === "HO_ADMIN";

                    return (
                      <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded border border-slate-200">
                        {/* Role Select */}
                        <div className="flex-1 min-w-0">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Role</label>
                          <select
                            value={a.roleId}
                            onChange={(e) => updateAssignmentRow(idx, "roleId", e.target.value)}
                            className="w-full text-xs rounded border border-slate-300 px-2 py-1 outline-none bg-white"
                          >
                            {roles.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Branch Select */}
                        <div className="flex-1 min-w-0">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Branch</label>
                          {isGlobalRole ? (
                            <select
                              disabled
                              className="w-full text-xs rounded border border-slate-200 px-2 py-1 outline-none bg-slate-100 text-slate-500"
                            >
                              <option value="">Global (HO Admin)</option>
                            </select>
                          ) : (
                            <select
                              value={a.branchId || ""}
                              onChange={(e) => updateAssignmentRow(idx, "branchId", e.target.value || null)}
                              className="w-full text-xs rounded border border-slate-300 px-2 py-1 outline-none bg-white"
                            >
                              {sessionUser?.isHo && <option value="">Global / Select Branch</option>}
                              {branches.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        {/* Remove Row */}
                        <button
                          type="button"
                          onClick={() => removeAssignmentRow(idx)}
                          className="self-end p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded transition-colors"
                          title="Remove assignment row"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-slate-100 pt-4 flex items-center justify-end gap-3 bg-white">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded text-sm font-medium transition-colors"
                >
                  {saving ? "Saving changes…" : "Save User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

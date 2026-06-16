"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RoleUserForm, { UserFormData, UserRoleAssignment } from "@/components/users/RoleUserForm";

interface PageProps {
  params: { roleCode: string; id: string };
}

type UserDetail = {
  id: string;
  fullName: string;
  email: string;
  username?: string | null;
  phone: string | null;
  status: string;
  roles: UserRoleAssignment[];
};

export default function EditRoleUserPage({ params }: PageProps) {
  const { roleCode, id } = params;
  const router = useRouter();

  const [initialUser, setInitialUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUser();
  }, [id]);

  async function fetchUser() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/users/${id}`);
      const data = await res.json();
      if (res.ok && data.user) {
        // Since BigInt returns as string/number depending on serializer, let's normalize id keys
        const user = data.user;
        const normalizedUser: UserDetail = {
          id: user.id.toString(),
          fullName: user.fullName,
          email: user.email,
          username: user.username,
          phone: user.phone,
          status: user.status,
          roles: (user.roles ?? []).map((r: any) => ({
            id: r.id.toString(),
            roleId: r.roleId.toString(),
            branchId: r.branchId ? r.branchId.toString() : null,
            role: r.role ? {
              id: r.role.id.toString(),
              code: r.role.code,
              name: r.role.name,
              description: r.role.description || "",
            } : undefined,
            branch: r.branch ? {
              id: r.branch.id.toString(),
              name: r.branch.name,
              branchCode: r.branch.branchCode,
            } : undefined,
          })),
        };
        setInitialUser(normalizedUser);
      } else {
        setError(data.error || "User not found.");
      }
    } catch {
      setError("Failed to fetch user details.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(
    formData: UserFormData,
    assignments: { roleId: string; branchId: string | null }[],
  ) {
    setError("");
    setSaving(true);

    const payload = {
      fullName: formData.fullName,
      email: formData.email,
      username: formData.username || null,
      phone: formData.phone || null,
      status: formData.status,
      roles: assignments,
      ...(formData.password ? { password: formData.password } : {}),
    };

    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to update user.");
        return;
      }

      router.push(`/users/role/${roleCode}`);
      router.refresh();
    } catch {
      setError("Failed to communicate with database API.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-slate-400">Loading user profile...</p>
      </div>
    );
  }

  if (error && !initialUser) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-4">
      {initialUser && (
        <RoleUserForm
          mode="edit"
          roleSlug={roleCode}
          initialUser={initialUser}
          onSubmit={handleSubmit}
          saving={saving}
          error={error}
        />
      )}
    </div>
  );
}

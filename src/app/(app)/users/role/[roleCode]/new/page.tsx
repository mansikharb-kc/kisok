"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import RoleUserForm, { UserFormData } from "@/components/users/RoleUserForm";

interface PageProps {
  params: { roleCode: string };
}

export default function NewRoleUserPage({ params }: PageProps) {
  const { roleCode } = params;
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
      password: formData.password,
      status: formData.status,
      roles: assignments,
      avatarUrl: formData.avatarUrl || null,
    };

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create user.");
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

  return (
    <div className="max-w-2xl mx-auto py-4">
      <RoleUserForm
        mode="create"
        roleSlug={roleCode}
        onSubmit={handleSubmit}
        saving={saving}
        error={error}
      />
    </div>
  );
}

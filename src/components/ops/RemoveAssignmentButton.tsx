"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RemoveAssignmentButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleRemove() {
    if (!confirm("Are you sure you want to remove this seller assignment?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/assignments/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to remove assignment");
      } else {
        router.refresh();
      }
    } catch {
      alert("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={handleRemove}
      disabled={busy}
      className="text-xs px-2 py-1 rounded-md border border-slate-200 text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors disabled:opacity-60 font-semibold"
    >
      {busy ? "Removing…" : "Remove"}
    </button>
  );
}

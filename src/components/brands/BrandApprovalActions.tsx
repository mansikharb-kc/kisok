"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const APPROVAL_BADGE: Record<string, string> = {
  draft: "bg-amber-500 text-white",
  pending: "bg-amber-500 text-white",
  approved: "bg-emerald-600 text-white",
  rejected: "bg-rose-600 text-white",
};

export default function BrandApprovalActions({
  brandId,
  approval,
  readOnly,
}: {
  brandId: string;
  approval: string;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setApproval(next: "approved" | "rejected") {
    setBusy(true);
    try {
      await fetch(`/api/brands/${brandId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalStatus: next }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const isPending = approval === "pending" || approval === "draft";

  return (
    <div className="flex items-center gap-3">
      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${APPROVAL_BADGE[approval] ?? "bg-slate-100 text-slate-500"}`}>
        {approval}
      </span>

      {!readOnly && approval !== "approved" && (
        <button
          type="button"
          onClick={() => setApproval("approved")}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          Approve
        </button>
      )}

      {!readOnly && isPending && (
        <button
          type="button"
          onClick={() => setApproval("rejected")}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          Reject
        </button>
      )}
    </div>
  );
}

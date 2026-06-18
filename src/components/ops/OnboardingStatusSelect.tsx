"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ONBOARDING_STATUSES, onboardingStatusMeta } from "@/lib/onboardingMeta";

export default function OnboardingStatusSelect({
  assignmentId,
  status,
}: {
  assignmentId: string;
  status: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [busy, setBusy] = useState(false);
  const meta = onboardingStatusMeta(value);

  async function change(next: string) {
    const prev = value;
    setValue(next);
    setBusy(true);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboardingStatus: next }),
      });
      if (!res.ok) {
        setValue(prev);
        return;
      }
      router.refresh();
    } catch {
      setValue(prev);
    } finally {
      setBusy(false);
    }
  }

  return (
    <select
      value={value}
      disabled={busy}
      onChange={(e) => change(e.target.value)}
      aria-label="Onboarding status"
      title="Update onboarding status"
      className={`cursor-pointer rounded-full border-0 py-1 pl-2.5 pr-6 text-[11px] font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 ${meta.badge}`}
    >
      {ONBOARDING_STATUSES.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
}

import { onboardingStatusMeta } from "@/lib/onboardingMeta";

export default function OnboardingStatusSelect({
  status,
}: {
  assignmentId?: string;
  status: string;
}) {
  const meta = onboardingStatusMeta(status);

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.badge}`}
    >
      {meta.label}
    </span>
  );
}

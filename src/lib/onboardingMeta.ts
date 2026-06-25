// Onboarding progress status for a seller-program assignment.
// The OB Exec updates it; the ONB Lead sees it read-only.

export const ONBOARDING_STATUSES = [
  { value: "yet_to_start", label: "Yet to start", badge: "bg-slate-500 text-white" },
  { value: "in_progress", label: "In progress", badge: "bg-amber-500 text-white" },
  { value: "on_hold", label: "On hold", badge: "bg-red-600 text-white" },
  { value: "onboarded", label: "Onboarded", badge: "bg-emerald-600 text-white" },
] as const;

export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number]["value"];

export const ONBOARDING_STATUS_VALUES = ONBOARDING_STATUSES.map((s) => s.value);

export function onboardingStatusMeta(value: string) {
  return ONBOARDING_STATUSES.find((s) => s.value === value) ?? ONBOARDING_STATUSES[0];
}

import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import OnboardingForm from "@/components/ops/OnboardingForm";

export const dynamic = "force-dynamic";

export default async function NewOnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasRole(session.roles, "OB_EXEC")) redirect("/dashboard");

  const roleEntry = session.roles.find((r) => r.code === "OB_EXEC" && r.branchId);
  if (!roleEntry?.branchId) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link href="/ops/onboarding" className="text-xs text-slate-500 hover:underline">
          ← Back to Product Onboarding
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Onboard a Product</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pick an assigned seller, a brand they deal in, an approved program and a category, then
          enter the SKU. Existing masters are reused automatically.
        </p>
      </div>

      <OnboardingForm />
    </div>
  );
}

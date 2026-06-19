import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import RequestNewProgramForm from "@/components/branch/RequestNewProgramForm";

export const dynamic = "force-dynamic";

export default async function RequestNewProgramPage() {
  const session = await getSession();
  if (!session || !hasRole(session.roles, "BRANCH_ADMIN")) redirect("/dashboard");

  const branchRole = session.roles.find((r) => r.code === "BRANCH_ADMIN" && r.branchId);
  const branchId = branchRole?.branchId ? String(branchRole.branchId) : null;

  if (!branchId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Request New Program</h1>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
          No branch is assigned to your Branch Admin role. Contact HO to get a branch assigned.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Request New Program</h1>
        <p className="mt-1 text-sm text-slate-500">
          Submit a request to HO for creating a new program.
        </p>
      </div>
      <RequestNewProgramForm branchId={branchId} />
    </div>
  );
}

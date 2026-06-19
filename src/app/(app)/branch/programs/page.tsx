import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma, serialize } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import BranchProgramsClient, {
  type SelectedProgramRow,
  type AvailableProgramRow,
} from "@/components/branch/BranchProgramsClient";

export const dynamic = "force-dynamic";

export default async function BranchProgramsPage() {
  const session = await getSession();
  if (!session || !hasRole(session.roles, "BRANCH_ADMIN")) redirect("/dashboard");

  const branchRole = session.roles.find((r) => r.code === "BRANCH_ADMIN" && r.branchId);
  const branchId = branchRole?.branchId ? BigInt(branchRole.branchId) : null;

  if (branchId === null) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Programs</h1>
          <p className="mt-1 text-sm text-slate-500">Select HO programs for your branch (HO approval required).</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
          No branch is assigned to your Branch Admin role. Contact HO to get a branch assigned.
        </div>
      </div>
    );
  }

  const [branchPrograms, activePrograms, pendingRequests] = await Promise.all([
    prisma.branchProgram.findMany({
      where: { branchId },
      orderBy: { createdAt: "desc" },
      include: {
        program: { select: { id: true, name: true, code: true, status: true } },
      },
    }),
    prisma.program.findMany({
      where: { status: "active" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
    prisma.changeRequest.findMany({
      where: {
        branchId,
        type: "NEW_PROGRAM",
        status: "pending",
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const selected: SelectedProgramRow[] = [
    ...serialize(branchPrograms).map((bp: any) => ({
      id: bp.id,
      programId: bp.program.id,
      name: bp.program.name,
      code: bp.program.code,
      status: bp.program.status,
      approvalStatus: bp.approvalStatus,
      createdAt: bp.createdAt,
      isNewProgramRequest: false,
    })),
    ...serialize(pendingRequests).map((cr: any) => ({
      id: cr.id,
      programId: `cr-${cr.id}`,
      name: cr.payload?.name || "New Program Request",
      code: "Pending",
      status: "active",
      approvalStatus: "pending",
      createdAt: cr.createdAt,
      isNewProgramRequest: true,
    })),
  ];

  const selectedIds = new Set(selected.map((s) => s.programId));
  const available: AvailableProgramRow[] = serialize(activePrograms)
    .filter((p: any) => !selectedIds.has(p.id))
    .map((p: any) => ({ id: p.id, name: p.name, code: p.code }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Programs</h1>
          <p className="mt-1 text-sm text-slate-500">
            Request HO programs for your branch. Each request is sent to HO for approval before it becomes active.
          </p>
        </div>
        <div>
          <Link
            href="/branch/programs/request-new"
            className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
          >
            + Request New Program
          </Link>
        </div>
      </div>
      <BranchProgramsClient selected={selected} available={available} />
    </div>
  );
}

import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";
import WarehouseTree, { LocationNode } from "@/components/warehouse/WarehouseTree";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: { program?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const isHo = hasRole(session.roles, "HO_ADMIN");
  const isBranchAdmin = hasRole(session.roles, "BRANCH_ADMIN");
  if (!isHo && !isBranchAdmin) redirect("/dashboard");

  let branchId: bigint | null = null;
  if (isBranchAdmin) {
    const branchRole = session.roles.find((r) => r.code === "BRANCH_ADMIN" && r.branchId);
    branchId = branchRole?.branchId ? BigInt(branchRole.branchId) : null;
  }
  if (!branchId) {
    const first = await prisma.branch.findFirst({ where: { status: "active" }, orderBy: { name: "asc" } });
    branchId = first?.id ?? null;
  }
  if (!branchId) {
    return (
      <div className="text-center py-20 text-slate-500">
        No active branch found. Please create a branch from HO Masters → Branches.
      </div>
    );
  }

  const branch = await prisma.branch.findUnique({ where: { id: branchId } });

  // The warehouse tree is built FOR a specific approved program of this branch.
  const branchPrograms = await prisma.branchProgram.findMany({
    where: { branchId, approvalStatus: "approved" },
    orderBy: { program: { name: "asc" } },
    select: {
      programId: true,
      program: { select: { id: true, name: true, code: true } },
    },
  });

  const programs = branchPrograms
    .map((bp) => bp.program)
    .filter((p): p is { id: bigint; name: string; code: string } => p !== null);

  const branchTag = branch ? (
    <p className="text-xs text-slate-400 font-mono">
      Branch: <span className="font-semibold text-slate-600">{branch.name}</span> · {branch.branchCode}
    </p>
  ) : null;

  if (programs.length === 0) {
    return (
      <div className="space-y-2">
        {branchTag}
        <div className="rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md px-4 py-16 text-center text-slate-500 text-sm">
          <div className="text-4xl mb-3"></div>
          This branch has no approved programs yet. A program must be approved before
          you can build its warehouse tree.
        </div>
      </div>
    );
  }

  // Resolve the selected program from the query param; require an explicit pick.
  const selectedProgramId = searchParams.program;
  const selectedProgram = selectedProgramId
    ? programs.find((p) => String(p.id) === selectedProgramId)
    : null;

  const programSelector = (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md p-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 mr-1">
        Program
      </span>
      {programs.map((p) => {
        const active = selectedProgram && String(selectedProgram.id) === String(p.id);
        return (
          <Link
            key={String(p.id)}
            href={`?program=${String(p.id)}`}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              active
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {p.name} <span className="font-mono text-[10px] opacity-70">({p.code})</span>
          </Link>
        );
      })}
    </div>
  );

  if (!selectedProgram) {
    return (
      <div className="space-y-2">
        {branchTag}
        {programSelector}
        <div className="rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md px-4 py-16 text-center text-slate-500 text-sm">
          <div className="text-4xl mb-3"></div>
          Select a program above to build or view its warehouse location tree.
        </div>
      </div>
    );
  }

  const nodeRows = await prisma.locationNode.findMany({
    where: { branchId, programId: selectedProgram.id },
    orderBy: [{ path: "asc" }, { name: "asc" }],
    select: {
      id: true,
      parentId: true,
      nodeType: true,
      name: true,
      code: true,
      categoryId: true,
      path: true,
      depth: true,
      isPlacementEligible: true,
      isScreenMountable: true,
      locationId: true,
      status: true,
      category: {
        select: {
          id: true,
          name: true,
          code: true,
          categoryAttributes: { select: { attribute: { select: { name: true, code: true } } } },
        },
      },
      _count: { select: { children: true, copies: true } },
      copies: { where: { status: "active" }, select: { copyRole: true } },
    },
  });

  const nodes: LocationNode[] = serialize(nodeRows) as any;

  return (
    <div className="space-y-2">
      {branchTag}
      {programSelector}
      <WarehouseTree
        programId={String(selectedProgram.id)}
        programName={selectedProgram.name}
        initial={nodes}
      />
    </div>
  );
}

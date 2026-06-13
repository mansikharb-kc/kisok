import Link from "next/link";
import { prisma, serialize } from "@/lib/prisma";
import BranchesClient, { BranchRow } from "@/components/branches/BranchesClient";

export const dynamic = "force-dynamic";

export default async function Page() {
  const rows = await prisma.branch.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          branchPrograms: true,
          branchBrands: true,
          locationNodes: true,
          sampleSizes: true,
          sellers: true,
          localRecords: true,
          productCopies: true,
          screens: true,
          userRoles: true,
        },
      },
    },
  });

  const branches: BranchRow[] = serialize(rows).map((branch: any) => ({
    id: branch.id,
    name: branch.name,
    branchCode: branch.branchCode,
    status: branch.status,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-700">
            <span className="h-2 w-2 rounded-full bg-brand-600" />
            HO Master
          </div>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">Branches</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">Branch master follows the BRD core: name, branch code, and status.</p>
        </div>
        <Link href="/masters/branches/new" className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-brand-700">
          New Branch
        </Link>
      </div>

      <BranchesClient initial={branches} />
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma, serialize } from "@/lib/prisma";
import { requirePageRole } from "@/lib/guard";

export const dynamic = "force-dynamic";

function parseId(id: string): bigint | null {
  try {
    return BigInt(id);
  } catch {
    return null;
  }
}

export default async function Page({ params }: { params: { id: string } }) {
  await requirePageRole("HO_ADMIN");
  const id = parseId(params.id);
  if (id === null) notFound();

  const branch = await prisma.branch.findUnique({
    where: { id },
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

  if (!branch) notFound();

  const b = serialize(branch) as any;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/masters/branches" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
            Back to branches
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">{b.name}</h1>
          <p className="mt-2 text-sm text-slate-600">Branch master details: name, branch code, and status.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/masters/branches/${b.id}/edit`} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Edit
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Code</div>
          <div className="mt-2 font-mono text-lg font-semibold text-slate-900">{b.branchCode}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Status</div>
          <div className="mt-2 text-lg font-semibold text-slate-900 capitalize">{b.status}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Branch Master</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">Core record</div>
        </div>
      </div>
    </div>
  );
}
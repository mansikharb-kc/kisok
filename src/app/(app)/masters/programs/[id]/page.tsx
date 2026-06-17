import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma, serialize } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function parseId(id: string): bigint | null {
  try {
    return BigInt(id);
  } catch {
    return null;
  }
}

export default async function Page({ params }: { params: { id: string } }) {
  const id = parseId(params.id);
  if (id === null) notFound();

  const program = await prisma.program.findUnique({
    where: { id },
    include: {
      _count: { select: { branchPrograms: true, contracts: true, localRecords: true } },
    },
  });

  if (!program) notFound();

  const s = serialize(program) as any;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-md p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/masters/programs" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
            Back to programs
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">{s.name}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/masters/programs/${s.id}/edit`} className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Edit core
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Code</div>
          <div className="mt-2 font-mono text-lg font-semibold text-slate-900">{s.code}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Status</div>
          <div className="mt-2 text-lg font-semibold text-slate-900 capitalize">{s.status}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Usage</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">{s._count.branchPrograms} branches</div>
        </div>
      </div>
    </div>
  );
}
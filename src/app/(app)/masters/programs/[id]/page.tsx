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
      branchPrograms: {
        include: {
          branch: {
            select: {
              id: true,
              name: true,
              branchCode: true,
            },
          },
        },
      },
      _count: { select: { branchPrograms: true, contracts: true, localRecords: true } },
    },
  });

  if (!program) notFound();

  const s = serialize(program) as any;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-md p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{s.name}</h1>
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

      <div className="rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-md p-6 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Included in Branches</h3>
        {s.branchPrograms && s.branchPrograms.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {s.branchPrograms.map((bp: any) => (
              <Link
                key={bp.id}
                href={`/masters/branches/${bp.branch.id}`}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white/40 p-4 transition-all hover:bg-white/80 hover:border-slate-350 hover:shadow-sm"
              >
                <div>
                  <div className="font-semibold text-slate-800 text-sm hover:underline">{bp.branch.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">{bp.branch.branchCode}</div>
                </div>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${bp.approvalStatus === "approved" ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"}`}>
                  {bp.approvalStatus}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-sm text-slate-400 py-2">This program is not associated with any branches yet.</div>
        )}
      </div>
    </div>
  );
}
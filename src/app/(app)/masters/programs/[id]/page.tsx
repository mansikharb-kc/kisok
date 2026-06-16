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
      defAttrs: { include: { attribute: { select: { id: true, name: true, code: true, dataType: true, sectionGroup: true, status: true } } } },
      commonAttrs: { include: { attribute: { select: { id: true, name: true, code: true, dataType: true, sectionGroup: true, status: true } } } },
      _count: { select: { branchPrograms: true, contracts: true, localRecords: true } },
    },
  });

  if (!program) notFound();

  const s = serialize(program) as any;
  const definitionAttributes = s.defAttrs.map((row: any) => row.attribute);
  const commonAttributes = s.commonAttrs.map((row: any) => row.attribute);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-md p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/masters/programs" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
            Back to programs
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">{s.name}</h1>
          <p className="mt-2 text-sm text-slate-600">A program is a master group of existing attributes, not a new attribute source.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/masters/programs/${s.id}/edit`} className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Edit core
          </Link>
          <Link href={`/masters/programs/${s.id}/attributes`} className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-100">
            Attributes
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
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
        <div className="rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Bindings</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">{definitionAttributes.length + commonAttributes.length} total</div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-md p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Definition attributes</h2>
          <p className="mt-1 text-sm text-slate-600">Attributes used for program contract terms.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {definitionAttributes.length ? (
              definitionAttributes.map((attribute: any) => (
                <span key={attribute.id} className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700">
                  {attribute.name} · {attribute.code}
                </span>
              ))
            ) : (
              <span className="text-sm text-slate-500">No attributes mapped</span>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-md p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Common attributes</h2>
          <p className="mt-1 text-sm text-slate-600">Attributes shared across all products in this program.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {commonAttributes.length ? (
              commonAttributes.map((attribute: any) => (
                <span key={attribute.id} className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700">
                  {attribute.name} · {attribute.code}
                </span>
              ))
            ) : (
              <span className="text-sm text-slate-500">No attributes mapped</span>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
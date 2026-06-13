import { prisma, serialize } from "@/lib/prisma";
import ProgramsClient, { AttributeRow, ProgramRow } from "@/components/programs/ProgramsClient";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [programRows, attributeRows] = await Promise.all([
    prisma.program.findMany({
      orderBy: [{ status: "asc" }, { name: "asc" }],
      include: {
        defAttrs: {
          include: {
            attribute: { select: { id: true, name: true, code: true, dataType: true, sectionGroup: true, status: true } },
          },
        },
        commonAttrs: {
          include: {
            attribute: { select: { id: true, name: true, code: true, dataType: true, sectionGroup: true, status: true } },
          },
        },
        _count: { select: { branchPrograms: true, contracts: true, localRecords: true } },
      },
    }),
    prisma.attribute.findMany({
      orderBy: [{ status: "asc" }, { sectionGroup: "asc" }, { name: "asc" }],
      select: { id: true, name: true, code: true, dataType: true, sectionGroup: true, status: true },
    }),
  ]);

  const programs: ProgramRow[] = serialize(programRows).map((program: any) => ({
    id: program.id,
    name: program.name,
    code: program.code,
    status: program.status,
    definitionAttributes: program.defAttrs.map((row: any) => ({
      id: row.attribute.id,
      name: row.attribute.name,
      code: row.attribute.code,
      dataType: row.attribute.dataType,
      sectionGroup: row.attribute.sectionGroup,
      status: row.attribute.status,
    })),
    commonAttributes: program.commonAttrs.map((row: any) => ({
      id: row.attribute.id,
      name: row.attribute.name,
      code: row.attribute.code,
      dataType: row.attribute.dataType,
      sectionGroup: row.attribute.sectionGroup,
      status: row.attribute.status,
    })),
    branchCount: program._count.branchPrograms,
    contractCount: program._count.contracts,
    localCount: program._count.localRecords,
  }));

  const attributes: AttributeRow[] = serialize(attributeRows).map((attribute: any) => ({
    id: attribute.id,
    name: attribute.name,
    code: attribute.code,
    dataType: attribute.dataType,
    sectionGroup: attribute.sectionGroup,
    status: attribute.status,
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-700">
          <span className="h-2 w-2 rounded-full bg-brand-600"></span>
          HO Master
        </div>
        <h1 className="text-3xl font-bold text-slate-900">Programs</h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Define programs and bind common attributes (shared across products) and definition attributes (contract-specific).
        </p>
      </div>

      <ProgramsClient initialPrograms={programs} attributes={attributes} />
    </div>
  );
}

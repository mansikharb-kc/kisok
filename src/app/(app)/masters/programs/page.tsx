import { prisma, serialize } from "@/lib/prisma";
import ProgramsClient, { AttributeRow, ProgramRow } from "@/components/programs/ProgramsClient";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getSession();
  const readOnly = session ? !hasRole(session.roles, "HO_ADMIN") : true;
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
      <ProgramsClient initialPrograms={programs} attributes={attributes} readOnly={readOnly} />
    </div>
  );
}

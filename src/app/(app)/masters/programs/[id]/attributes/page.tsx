import { notFound } from "next/navigation";
import { prisma, serialize } from "@/lib/prisma";
import ProgramBindingsClient from "@/components/programs/ProgramBindingsClient";

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

  const [program, attributeRows] = await Promise.all([
    prisma.program.findUnique({
      where: { id },
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

  if (!program) notFound();

  const s = serialize(program) as any;
  const attributes = serialize(attributeRows).map((attribute: any) => ({
    id: attribute.id,
    name: attribute.name,
    code: attribute.code,
    dataType: attribute.dataType,
    sectionGroup: attribute.sectionGroup,
    status: attribute.status,
  }));

  const programRow = {
    id: s.id,
    name: s.name,
    code: s.code,
    status: s.status,
    definitionAttributes: s.defAttrs.map((row: any) => ({
      id: row.attribute.id,
      name: row.attribute.name,
      code: row.attribute.code,
      dataType: row.attribute.dataType,
      sectionGroup: row.attribute.sectionGroup,
      status: row.attribute.status,
    })),
    commonAttributes: s.commonAttrs.map((row: any) => ({
      id: row.attribute.id,
      name: row.attribute.name,
      code: row.attribute.code,
      dataType: row.attribute.dataType,
      sectionGroup: row.attribute.sectionGroup,
      status: row.attribute.status,
    })),
    branchCount: s._count.branchPrograms,
    contractCount: s._count.contracts,
    localCount: s._count.localRecords,
  };

  return <ProgramBindingsClient program={programRow} attributes={attributes} />;
}
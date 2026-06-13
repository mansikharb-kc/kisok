import { notFound } from "next/navigation";
import { prisma, serialize } from "@/lib/prisma";
import ProgramFormClient from "@/components/programs/ProgramFormClient";

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

  const program = await prisma.program.findUnique({ where: { id } });
  if (!program) notFound();

  const s = serialize(program) as any;

  return (
    <ProgramFormClient
      mode="edit"
      programId={s.id}
      initialValues={{ name: s.name, code: s.code, status: s.status }}
      title="Edit Program"
      description="Update the core program details on its own page. Attribute bindings stay on the Attributes page."
      submitLabel="Save Changes"
      successRedirect="/masters/programs/[id]"
    />
  );
}
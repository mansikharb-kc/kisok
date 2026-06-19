import { notFound } from "next/navigation";
import { prisma, serialize } from "@/lib/prisma";
import { requirePageRole } from "@/lib/guard";
import BranchFormClient from "@/components/branches/BranchFormClient";

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
    include: { branchCategories: true },
  });
  if (!branch) notFound();

  const b = serialize(branch) as any;
  const initialCategories = b.branchCategories?.map((bc: any) => String(bc.categoryId)) ?? [];

  return (
    <BranchFormClient
      mode="edit"
      branchId={b.id}
      initialCategories={initialCategories}
      initialValues={{
        name: b.name,
        branchCode: b.branchCode,
        status: b.status,
      }}
      title="Edit Branch"
      description="Update the branch master row on a separate page. Keep the core BRD fields only."
      submitLabel="Save Changes"
      successRedirect="/masters/branches/[id]"
    />
  );
}
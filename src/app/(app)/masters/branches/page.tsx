import { prisma, serialize } from "@/lib/prisma";
import { requirePageRole } from "@/lib/guard";
import BranchesClient, { BranchRow } from "@/components/branches/BranchesClient";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requirePageRole("HO_ADMIN");
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
      <BranchesClient initial={branches} />
    </div>
  );
}

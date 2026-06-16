import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";
import SellerForm from "@/components/ops/SellerForm";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasRole(session.roles, "ONB_LEAD")) redirect("/dashboard");

  const roleEntry = session.roles.find((r) => r.code === "ONB_LEAD" && r.branchId);
  const branchId = roleEntry?.branchId ? BigInt(roleEntry.branchId) : null;
  if (!branchId) redirect("/dashboard");

  // Brands = all HO-approved active brands (availability flows through sellers,
  // not through any Branch-Admin step). Programs = branch's HO-approved programs.
  const [brandRows, branchPrograms, execRows, categoryRows] = await Promise.all([
    prisma.brand.findMany({
      where: { status: "active", approvalStatus: "approved" },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
    prisma.branchProgram.findMany({
      where: { branchId, approvalStatus: "approved", program: { status: "active" } },
      include: { program: { select: { id: true, name: true, code: true } } },
    }),
    prisma.user.findMany({
      where: {
        status: "active",
        roles: {
          some: {
            role: { code: "OB_EXEC" },
            branchId,
          },
        },
      },
      select: { id: true, fullName: true, email: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.category.findMany({
      where: { status: "active" },
      select: { id: true, name: true, parentId: true },
    }),
  ]);

  const brands = serialize(brandRows);
  const programs = serialize(branchPrograms.map((bp) => bp.program));
  const execs = serialize(execRows);
  const flatCategories = serialize(categoryRows);

  return (
    <div className="space-y-6">
      <SellerForm brands={brands} programs={programs} execs={execs} flatCategories={flatCategories} />
    </div>
  );
}

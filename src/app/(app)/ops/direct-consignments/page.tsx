import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";
import DirectConsignmentsClient from "@/components/ops/DirectConsignmentsClient";
import DirectConsignmentsListClient from "@/components/ops/DirectConsignmentsListClient";

export const dynamic = "force-dynamic";

export default async function DirectConsignmentsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasRole(session.roles, "ONB_LEAD", "CONSIGNMENT_USER")) redirect("/dashboard");

  const isLead = hasRole(session.roles, "ONB_LEAD");
  const isConsign = hasRole(session.roles, "CONSIGNMENT_USER");

  const roleEntry = session.roles.find(
    (r) => ["ONB_LEAD", "CONSIGNMENT_USER"].includes(r.code) && r.branchId
  );
  const branchId = roleEntry?.branchId ? BigInt(roleEntry.branchId) : null;
  if (!branchId) redirect("/dashboard");

  // Fetch Direct Consignments in the branch based on role
  const dcWhere: any = { branchId };
  if (isLead) {
    dcWhere.status = "WITH_LEAD";
  }

  const directConsignments = await prisma.directConsignment.findMany({
    where: dcWhere,
    orderBy: { createdAt: "desc" },
  });

  if (isConsign) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Direct Consignments</h1>
          <p className="text-sm text-slate-500 mt-1">
            Raise and track direct consignment packages received at the warehouse before seller registration.
          </p>
        </div>
        <DirectConsignmentsListClient
          directConsignments={serialize(directConsignments) as any[]}
        />
      </div>
    );
  }

  // Fetch all HO-approved active brands (for Lead view)
  const brands = await prisma.brand.findMany({
    where: { status: "active", approvalStatus: "approved" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });

  // Fetch all categories (for Lead view)
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true, parentId: true },
  });

  // Fetch all active programs (for Lead view)
  const programs = await prisma.program.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });

  // Fetch all OB Execs in the branch (for Lead view)
  const obExecRoles = await prisma.userRole.findMany({
    where: {
      branchId,
      role: { code: "OB_EXEC" },
      user: { status: "active" },
    },
    include: {
      user: { select: { id: true, fullName: true, email: true } },
    },
  });
  const obExecs = obExecRoles.map((r) => r.user);

  const serializedDcs = serialize(directConsignments) as any[];
  const serializedBrands = serialize(brands) as any[];
  const serializedCategories = serialize(categories) as any[];
  const serializedPrograms = serialize(programs) as any[];
  const serializedExecs = serialize(obExecs) as any[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Direct Consignments</h1>
        <p className="text-sm text-slate-500 mt-1">
          Review packages received directly at the warehouse before registration. Register the seller and assign an onboarding executive.
        </p>
      </div>

      <DirectConsignmentsClient
        directConsignments={serializedDcs}
        brands={serializedBrands}
        categories={serializedCategories}
        programs={serializedPrograms}
        execs={serializedExecs}
      />
    </div>
  );
}

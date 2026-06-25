import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";
import DirectConsignmentsClient from "@/components/ops/DirectConsignmentsClient";

export const dynamic = "force-dynamic";

export default async function DirectConsignmentsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasRole(session.roles, "ONB_LEAD")) redirect("/dashboard");

  const roleEntry = session.roles.find((r) => r.code === "ONB_LEAD" && r.branchId);
  const branchId = roleEntry?.branchId ? BigInt(roleEntry.branchId) : null;
  if (!branchId) redirect("/dashboard");

  // Fetch all open Direct Consignment tickets in the branch
  const tickets = await prisma.ticket.findMany({
    where: {
      branchId,
      type: "DIRECT_CONSIGNMENT",
      status: "WITH_LEAD",
    },
    orderBy: { createdAt: "desc" },
    include: {
      events: { orderBy: { createdAt: "asc" } },
    },
  });

  // Fetch all HO-approved active brands
  const brands = await prisma.brand.findMany({
    where: { status: "active", approvalStatus: "approved" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });

  // Fetch all categories
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true, parentId: true },
  });

  // Fetch all active programs
  const programs = await prisma.program.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });

  // Fetch all OB Execs in the branch
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

  const serializedTickets = serialize(tickets) as any[];
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
        tickets={serializedTickets}
        brands={serializedBrands}
        categories={serializedCategories}
        programs={serializedPrograms}
        execs={serializedExecs}
      />
    </div>
  );
}

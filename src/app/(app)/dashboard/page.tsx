import { getSession } from "@/lib/auth";
import { ROLE_LABELS, RoleCode, hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";
import { timeAgo, actionLabel, actionTone, auditTarget } from "@/lib/format";
import LeadAssignmentsTable from "@/components/ops/LeadAssignmentsTable";

async function recentActivity(branchId: bigint | null, targetRoles: string[]) {
  let whereClause = {};

  let actorUserIds: bigint[] | undefined = undefined;

  if (targetRoles.length > 0) {
    const matchingRoles = await prisma.userRole.findMany({
      where: {
        role: { code: { in: targetRoles } },
        ...(branchId ? { branchId } : {}),
      },
      select: { userId: true },
    });
    actorUserIds = matchingRoles.map((ur) => ur.userId);
    whereClause = { actorUserId: { in: actorUserIds } };
  } else if (branchId) {
    const userRoles = await prisma.userRole.findMany({
      where: { branchId },
      select: { userId: true },
    });
    actorUserIds = userRoles.map((ur) => ur.userId);
    whereClause = { actorUserId: { in: actorUserIds } };
  }

  const logs = await prisma.auditLog.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  const actorIds = [...new Set(logs.map((l) => l.actorUserId).filter(Boolean) as bigint[])];
  const actors = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, fullName: true } })
    : [];
  const nameById = new Map(actors.map((a) => [a.id.toString(), a.fullName]));

  return logs.map((l) => ({
    id: l.id.toString(),
    label: actionLabel(l.action),
    tone: actionTone(l.action),
    target: auditTarget(l.afterJson as never, l.beforeJson as never),
    actor: l.actorUserId ? nameById.get(l.actorUserId.toString()) ?? "Someone" : "System",
    when: timeAgo(l.createdAt),
  }));
}

async function countL4Categories(status?: string) {
  const l1 = await prisma.category.findMany({ where: { parentId: null }, select: { id: true } });
  const l1Ids = l1.map((c) => c.id);
  if (l1Ids.length === 0) return 0;

  const l2 = await prisma.category.findMany({ where: { parentId: { in: l1Ids } }, select: { id: true } });
  const l2Ids = l2.map((c) => c.id);
  if (l2Ids.length === 0) return 0;

  const l3 = await prisma.category.findMany({ where: { parentId: { in: l2Ids } }, select: { id: true } });
  const l3Ids = l3.map((c) => c.id);
  if (l3Ids.length === 0) return 0;

  const whereClause: any = { parentId: { in: l3Ids } };
  if (status) whereClause.status = status;
  return prisma.category.count({ where: whereClause });
}

async function globalCounts() {
  const [categories, attributes, brands, programs, sellers, products, copies, pendingApprovals] =
    await Promise.all([
      countL4Categories(),
      prisma.attribute.count(),
      prisma.brand.count(),
      prisma.program.count(),
      prisma.seller.count(),
      prisma.brandProduct.count(),
      prisma.productCopy.count(),
      prisma.changeRequest.count({ where: { status: "pending" } }),
    ]);
  return { categories, attributes, brands, programs, sellers, products, copies, pendingApprovals };
}

async function branchCounts(branchId: bigint) {
  const [
    totalCategories,
    totalAttributes,
    totalAttributeBindings,
    totalBrands,
    approvedBrands,
    totalProducts,
    branchBrandsCount,
    branchProductsCount,
    sellersCount,
    assignedSellersCount,
    locationsCount,
    copiesCount,
    labeledCopiesCount,
    openConsignmentsCount,
    pendingApprovalsCount,
    programsCount,
  ] = await Promise.all([
    countL4Categories("active"),
    prisma.attribute.count({ where: { status: "active" } }),
    prisma.categoryAttribute.count(),
    prisma.brand.count({ where: { status: "active" } }),
    prisma.brand.count({ where: { status: "active", approvalStatus: "approved" } }),
    prisma.brandProduct.count({ where: { status: "active" } }),
    prisma.branchBrand.count({ where: { branchId } }),
    prisma.brandProduct.count({ where: { copies: { some: { branchId } } } }),
    prisma.seller.count({ where: { branchId } }),
    prisma.sellerAssignment.count({ where: { seller: { branchId } } }),
    prisma.locationNode.count({ where: { branchId, isPlacementEligible: true } }),
    prisma.productCopy.count({ where: { branchId } }),
    prisma.sticker.count({ where: { copy: { branchId }, status: "printed" } }),
    prisma.consignment.count({ where: { seller: { branchId }, status: { not: "closed" } } }),
    prisma.changeRequest.count({ where: { branchId, status: "pending" } }),
    prisma.branchProgram.count({ where: { branchId, approvalStatus: "approved" } }),
  ]);

  return {
    totalCategories,
    totalAttributes,
    totalAttributeBindings,
    totalBrands,
    approvedBrands,
    totalProducts,
    branchBrands: branchBrandsCount,
    branchProducts: branchProductsCount,
    sellers: sellersCount,
    assignedSellers: assignedSellersCount,
    locations: locationsCount,
    copies: copiesCount,
    labeledCopies: labeledCopiesCount,
    pendingCopies: copiesCount - labeledCopiesCount,
    openConsignments: openConsignmentsCount,
    pendingApprovals: pendingApprovalsCount,
    programs: programsCount,
  };
}

async function onbLeadCounts(branchId: bigint) {
  const [
    sellersCount,
    unassignedCount,
    openConsignments,
    sampleSizes,
    programs,
  ] = await Promise.all([
    prisma.seller.count({ where: { branchId } }),
    prisma.seller.count({ where: { branchId, assignments: { none: {} } } }),
    prisma.consignment.count({ where: { seller: { branchId }, status: { not: "closed" } } }),
    prisma.sampleSize.count({ where: { branchId } }),
    prisma.branchProgram.count({ where: { branchId, approvalStatus: "approved" } }),
  ]);
  const assignedCount = sellersCount - unassignedCount;
  return { sellersCount, unassignedCount, assignedCount, openConsignments, sampleSizes, programs };
}

async function obExecCounts(branchId: bigint, userId: string) {
  const uid = BigInt(userId);
  const assignedSellers = await prisma.sellerAssignment.findMany({
    where: { obExecUserId: uid },
    select: { sellerId: true },
  });
  const sellerIds = assignedSellers.map((a) => a.sellerId);
  const assignedSellersCount = sellerIds.length;

  const [
    pendingConsignments,
    productsOnboarded,
    copiesPlaced,
    copiesUnplaced,
    placementLocations,
  ] = await Promise.all([
    sellerIds.length > 0
      ? prisma.consignment.count({ where: { sellerId: { in: sellerIds }, status: "passed_back" } })
      : Promise.resolve(0),
    prisma.localOnboardingRecord.count({
      where: {
        branchId,
        OR: [
          { onboardedBy: uid },
          { sellerId: { in: sellerIds.length > 0 ? sellerIds : [BigInt(-1)] } },
        ],
      },
    }),
    prisma.productCopy.count({
      where: {
        branchId,
        locationNodeId: { not: null },
        record: { sellerId: { in: sellerIds.length > 0 ? sellerIds : [BigInt(-1)] } },
      },
    }),
    prisma.productCopy.count({
      where: {
        branchId,
        locationNodeId: null,
        record: { sellerId: { in: sellerIds.length > 0 ? sellerIds : [BigInt(-1)] } },
      },
    }),
    prisma.locationNode.count({ where: { branchId, isPlacementEligible: true } }),
  ]);

  return {
    assignedSellersCount,
    pendingConsignments,
    productsOnboarded,
    copiesPlaced,
    copiesUnplaced,
    placementLocations,
  };
}

async function consignmentUserCounts(branchId: bigint) {
  const statuses = ["initiated", "received", "in_buffer", "fabricating", "qc", "passed_back"];
  const counts = await Promise.all(
    statuses.map((status) =>
      prisma.consignment.count({ where: { seller: { branchId }, status } })
    )
  );
  const statusBreakdown = Object.fromEntries(statuses.map((s, i) => [s, counts[i]]));

  // Items pending QC = consignment items for consignments in "qc" status
  const pendingQcItems = await prisma.consignmentItem.count({
    where: {
      consignment: { seller: { branchId }, status: "qc" },
      status: "pending",
    },
  });

  // Passed QC today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const passedToday = await prisma.qcRecord.count({
    where: {
      result: "pass",
      qcAt: { gte: todayStart },
      item: { consignment: { seller: { branchId } } },
    },
  });

  return { statusBreakdown, pendingQcItems, passedToday };
}

async function getBranchWarehouseOccupancy(branchId: bigint) {
  const eligibleNodes = await prisma.locationNode.findMany({
    where: {
      branchId,
      isPlacementEligible: true,
      status: "active",
    },
    select: {
      id: true,
      copies: {
        where: {
          status: "active",
        },
        select: {
          copyRole: true,
        },
      },
    },
  });

  const total = eligibleNodes.length;
  let occupied = 0;
  let masterLocations = 0;
  let slaveOnlyLocations = 0;

  for (const node of eligibleNodes) {
    if (node.copies.length > 0) {
      occupied++;
      const hasMaster = node.copies.some((c) => c.copyRole === "MASTER");
      if (hasMaster) {
        masterLocations++;
      } else {
        slaveOnlyLocations++;
      }
    }
  }

  const empty = total - occupied;
  const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;

  return {
    total,
    occupied,
    empty,
    occupancyRate,
    masterLocations,
    slaveOnlyLocations,
  };
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const isHo = hasRole(session.roles, "HO_ADMIN");
  const branchRole = session.roles.find((r) => r.code === "BRANCH_ADMIN");
  const branchId = branchRole?.branchId ? BigInt(branchRole.branchId) : null;

  const isOnbLead = hasRole(session.roles, "ONB_LEAD");
  const isOBExec = hasRole(session.roles, "OB_EXEC");
  const isConsignment = hasRole(session.roles, "CONSIGNMENT_USER");

  // Get branchId for ops roles
  const opsRole = session.roles.find(
    (r) => ["ONB_LEAD", "OB_EXEC", "CONSIGNMENT_USER"].includes(r.code) && r.branchId
  );
  const opsBranchId = opsRole?.branchId ? BigInt(opsRole.branchId) : null;

  let countsData: Record<string, unknown> = {};
  let branchName = "";
  let opsBranchName = "";

  if (isHo || (!branchId && !opsBranchId)) {
    countsData = await globalCounts();
  } else if (branchId) {
    countsData = await branchCounts(branchId);
    const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } });
    branchName = branch?.name || "Managed Branch";
  }

  let onbLeadData: Awaited<ReturnType<typeof onbLeadCounts>> | null = null;
  let obExecData: Awaited<ReturnType<typeof obExecCounts>> | null = null;
  let consignmentData: Awaited<ReturnType<typeof consignmentUserCounts>> | null = null;
  let onbLeadAssignmentsList: any[] = [];
  let obExecAssignmentsList: any[] = [];

  if (opsBranchId) {
    const branch = await prisma.branch.findUnique({ where: { id: opsBranchId }, select: { name: true } });
    opsBranchName = branch?.name || "Branch";

    if (isOnbLead) {
      onbLeadData = await onbLeadCounts(opsBranchId);
      const assignments = await prisma.sellerAssignment.findMany({
        where: { seller: { branchId: opsBranchId } },
        orderBy: { assignedAt: "desc" },
        include: {
          seller: {
            select: {
              id: true,
              name: true,
              sellerCode: true,
              membershipId: true,
              status: true,
              sellerBrands: { include: { brand: { select: { id: true, name: true, code: true } } } },
            },
          },
          program: { select: { id: true, name: true, code: true } },
          exec: { select: { id: true, fullName: true, email: true } },
        },
      });
      const detailed = await Promise.all(
        assignments.map(async (a) => {
          const onboardedCount = await prisma.localOnboardingRecord.count({
            where: {
              sellerId: a.sellerId,
              branchId: opsBranchId,
              ...(a.programId ? { programId: a.programId } : {}),
            },
          });
          return {
            ...a,
            onboardedCount,
          };
        })
      );
      onbLeadAssignmentsList = serialize(detailed);
    }
    if (isOBExec) {
      obExecData = await obExecCounts(opsBranchId, session.uid);
    }
    if (isConsignment) consignmentData = await consignmentUserCounts(opsBranchId);
  }

  const targetBranchId = branchId ?? opsBranchId;
  let occupancyData = null;
  if (targetBranchId) {
    occupancyData = await getBranchWarehouseOccupancy(targetBranchId);
  }

  const ROLE_TO_VISIBLE_ACTOR_ROLE: Record<string, string> = {
    HO_ADMIN: "BRANCH_ADMIN",
    BRANCH_ADMIN: "ONB_LEAD",
    ONB_LEAD: "OB_EXEC",
    OB_EXEC: "CONSIGNMENT_USER",
  };
  const targetRoles = session.roles
    .map((r) => ROLE_TO_VISIBLE_ACTOR_ROLE[r.code])
    .filter(Boolean);

  const activity = await recentActivity(isHo ? null : targetBranchId, targetRoles);
  const roleLabels = session.roles.map((r) => ROLE_LABELS[r.code as RoleCode] ?? r.code);

  const displayBranchName = branchName || opsBranchName;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome, {session.name}</h1>
        <p className="text-sm text-slate-500 mt-1">
          Signed in as {roleLabels.join(", ")} {displayBranchName && `· ${displayBranchName}`}
        </p>
      </div>

      {isHo || (!branchId && !opsBranchId) ? (
        // HO Admin Global Dashboard
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md p-4 shadow-sm">
            <div className="text-2xl font-bold">{countsData.categories as number}</div>
            <div className="text-xs text-slate-500 mt-1">Categories</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md p-4 shadow-sm">
            <div className="text-2xl font-bold">{countsData.attributes as number}</div>
            <div className="text-xs text-slate-500 mt-1">Attributes</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md p-4 shadow-sm">
            <div className="text-2xl font-bold">{countsData.brands as number}</div>
            <div className="text-xs text-slate-500 mt-1">Brands</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md p-4 shadow-sm">
            <div className="text-2xl font-bold">{countsData.programs as number}</div>
            <div className="text-xs text-slate-500 mt-1">Programs</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md p-4 shadow-sm">
            <div className="text-2xl font-bold">{countsData.sellers as number}</div>
            <div className="text-xs text-slate-500 mt-1">Sellers</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md p-4 shadow-sm">
            <div className="text-2xl font-bold">{countsData.products as number}</div>
            <div className="text-xs text-slate-500 mt-1">Products (SKUs)</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md p-4 shadow-sm">
            <div className="text-2xl font-bold">{countsData.copies as number}</div>
            <div className="text-xs text-slate-500 mt-1">Physical Copies</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md p-4 shadow-sm">
            <div className="text-2xl font-bold">{countsData.pendingApprovals as number}</div>
            <div className="text-xs text-slate-500 mt-1">Pending Approvals</div>
          </div>
        </div>
      ) : branchId ? (
        // Branch Admin Dashboard
        <div className="space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">HO Masters</span>
              <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Global catalogue · view only</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <a href="/masters/categories" className="group rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm hover:border-brand-300 hover:shadow-md transition-all">
                <div className="text-xs font-medium text-slate-400 group-hover:text-brand-600">Categories</div>
                <div className="text-3xl font-bold mt-1 text-slate-900">{countsData.totalCategories as number}</div>
                <div className="text-xs text-slate-500 mt-1">{countsData.totalAttributeBindings as number} attribute bindings</div>
              </a>
              <a href="/masters/attributes" className="group rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm hover:border-brand-300 hover:shadow-md transition-all">
                <div className="text-xs font-medium text-slate-400 group-hover:text-brand-600">Attributes</div>
                <div className="text-3xl font-bold mt-1 text-slate-900">{countsData.totalAttributes as number}</div>
                <div className="text-xs text-slate-500 mt-1">global attribute library</div>
              </a>
              <a href="/masters/brands" className="group rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm hover:border-brand-300 hover:shadow-md transition-all">
                <div className="text-xs font-medium text-slate-400 group-hover:text-brand-600">Brands</div>
                <div className="text-3xl font-bold mt-1 text-slate-900">{countsData.totalBrands as number}</div>
                <div className="text-xs text-slate-500 mt-1">{countsData.approvedBrands as number} approved · {countsData.branchBrands as number} at this branch</div>
              </a>
              <a href="/masters/programs" className="group rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm hover:border-brand-300 hover:shadow-md transition-all">
                <div className="text-xs font-medium text-slate-400 group-hover:text-brand-600">Programs</div>
                <div className="text-3xl font-bold mt-1 text-slate-900">{countsData.totalProducts as number}</div>
                <div className="text-xs text-slate-500 mt-1">{countsData.programs as number} programs active at branch</div>
              </a>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Branch Operations</span>
              <span className="text-[10px] bg-brand-50 text-brand-600 px-2 py-0.5 rounded-full font-medium">{branchName}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm">
                <div className="text-xs font-medium text-slate-400">Sellers</div>
                <div className="text-3xl font-bold mt-1 text-slate-900">{countsData.sellers as number}</div>
                <div className="text-xs text-slate-500 mt-1">{countsData.assignedSellers as number} assigned to execs</div>
              </div>
              <a href="/branch/warehouse" className="group rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm hover:border-brand-300 hover:shadow-md transition-all">
                <div className="text-xs font-medium text-slate-400 group-hover:text-brand-600">Location IDs</div>
                <div className="text-3xl font-bold mt-1 text-slate-900">{countsData.locations as number}</div>
                <div className="text-xs text-slate-500 mt-1">placement-eligible nodes</div>
              </a>
              <div className="rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm">
                <div className="text-xs font-medium text-slate-400">Copies on shelf</div>
                <div className="text-3xl font-bold mt-1 text-slate-900">{countsData.copies as number}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {countsData.labeledCopies as number} labeled · {countsData.pendingCopies as number} pending
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm">
                <div className="text-xs font-medium text-slate-400">Products onboarded</div>
                <div className="text-3xl font-bold mt-1 text-slate-900">{countsData.branchProducts as number}</div>
                <div className="text-xs text-slate-500 mt-1">of {countsData.totalProducts as number} total SKUs</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm">
                <div className="text-xs font-medium text-slate-400">Open consignments</div>
                <div className="text-3xl font-bold mt-1 text-slate-900">{countsData.openConsignments as number}</div>
                <div className="text-xs text-slate-500 mt-1">in progress</div>
              </div>
              <div className={`rounded-lg border p-5 shadow-sm ${(countsData.pendingApprovals as number) > 0 ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white/60 backdrop-blur-md"}`}>
                <div className={`text-xs font-medium ${(countsData.pendingApprovals as number) > 0 ? "text-amber-600" : "text-slate-400"}`}>HO Approvals pending</div>
                <div className={`text-3xl font-bold mt-1 ${(countsData.pendingApprovals as number) > 0 ? "text-amber-700" : "text-slate-900"}`}>{countsData.pendingApprovals as number}</div>
                <div className="text-xs text-slate-500 mt-1">change requests awaiting HO</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Ops Roles Dashboard
        <div className="space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] bg-brand-50 text-brand-600 px-2 py-0.5 rounded-full font-medium">{opsBranchName}</span>
          </div>

          {/* ONB_LEAD dashboard */}
          {isOnbLead && onbLeadData && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Onboarding Lead Overview</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <a href="/ops/sellers" className="group rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm hover:border-brand-300 hover:shadow-md transition-all">
                  <div className="text-xs font-medium text-slate-400 group-hover:text-brand-600">Total Sellers</div>
                  <div className="text-3xl font-bold mt-1 text-slate-900">{onbLeadData.sellersCount}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {onbLeadData.assignedCount} assigned · {onbLeadData.unassignedCount} unassigned
                  </div>
                </a>
                <a href="/ops/assignments" className="group rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm hover:border-brand-300 hover:shadow-md transition-all">
                  <div className="text-xs font-medium text-slate-400 group-hover:text-brand-600">Assignments</div>
                  <div className="text-3xl font-bold mt-1 text-slate-900">{onbLeadData.assignedCount}</div>
                  <div className={`text-xs mt-1 ${onbLeadData.unassignedCount > 0 ? "text-amber-600 font-medium" : "text-slate-500"}`}>
                    {onbLeadData.unassignedCount} sellers unassigned
                  </div>
                </a>
                <a href="/ops/consignments" className="group rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm hover:border-brand-300 hover:shadow-md transition-all">
                  <div className="text-xs font-medium text-slate-400 group-hover:text-brand-600">Open Consignments</div>
                  <div className="text-3xl font-bold mt-1 text-slate-900">{onbLeadData.openConsignments}</div>
                  <div className="text-xs text-slate-500 mt-1">not yet closed</div>
                </a>
                <a href="/ops/sample-sizes" className="group rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm hover:border-brand-300 hover:shadow-md transition-all">
                  <div className="text-xs font-medium text-slate-400 group-hover:text-brand-600">Sample Sizes</div>
                  <div className="text-3xl font-bold mt-1 text-slate-900">{onbLeadData.sampleSizes}</div>
                  <div className="text-xs text-slate-500 mt-1">defined at branch</div>
                </a>
                <div className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm">
                  <div className="text-xs font-medium text-slate-400">Active Programs</div>
                  <div className="text-3xl font-bold mt-1 text-slate-900">{onbLeadData.programs}</div>
                  <div className="text-xs text-slate-500 mt-1">approved at branch</div>
                </div>
              </div>

              {/* Task Assignments & Tracking for Lead */}
              <LeadAssignmentsTable assignments={onbLeadAssignmentsList} />
            </div>
          )}

          {/* OB_EXEC dashboard */}
          {isOBExec && obExecData && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Onboarding Exec Overview</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <a href="/ops/consignments" className="group rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm hover:border-brand-300 hover:shadow-md transition-all">
                  <div className="text-xs font-medium text-slate-400 group-hover:text-brand-600">Assigned Sellers</div>
                  <div className="text-3xl font-bold mt-1 text-slate-900">{obExecData.assignedSellersCount}</div>
                  <div className={`text-xs mt-1 ${obExecData.pendingConsignments > 0 ? "text-emerald-600 font-medium" : "text-slate-500"}`}>
                    {obExecData.pendingConsignments} consignments ready for you
                  </div>
                </a>
                <a href="/ops/onboarding" className="group rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm hover:border-brand-300 hover:shadow-md transition-all">
                  <div className="text-xs font-medium text-slate-400 group-hover:text-brand-600">Products Onboarded</div>
                  <div className="text-3xl font-bold mt-1 text-slate-900">{obExecData.productsOnboarded}</div>
                  <div className="text-xs text-slate-500 mt-1">local records</div>
                </a>
                <a href="/ops/placement" className="group rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm hover:border-brand-300 hover:shadow-md transition-all">
                  <div className="text-xs font-medium text-slate-400 group-hover:text-brand-600">Copies Placed</div>
                  <div className="text-3xl font-bold mt-1 text-slate-900">{obExecData.copiesPlaced}</div>
                  <div className={`text-xs mt-1 ${obExecData.copiesUnplaced > 0 ? "text-amber-600 font-medium" : "text-slate-500"}`}>
                    {obExecData.copiesUnplaced} unplaced
                  </div>
                </a>
                <div className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm">
                  <div className="text-xs font-medium text-slate-400">Placement Locations</div>
                  <div className="text-3xl font-bold mt-1 text-slate-900">{obExecData.placementLocations}</div>
                  <div className="text-xs text-slate-500 mt-1">eligible nodes at branch</div>
                </div>
              </div>
            </div>
          )}

          {/* CONSIGNMENT_USER dashboard */}
          {isConsignment && consignmentData && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Consignment Overview</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {(
                  [
                    { key: "initiated", label: "Initiated", color: "bg-blue-50 text-blue-700 border-blue-200" },
                    { key: "received", label: "Received", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
                    { key: "in_buffer", label: "In Buffer", color: "bg-amber-50 text-amber-700 border-amber-200" },
                    { key: "fabricating", label: "Fabricating", color: "bg-orange-50 text-orange-700 border-orange-200" },
                    { key: "qc", label: "In QC", color: "bg-purple-50 text-purple-700 border-purple-200" },
                    { key: "passed_back", label: "Passed Back", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                  ] as { key: string; label: string; color: string }[]
                ).map(({ key, label, color }) => (
                  <a
                    href={`/ops/consignments?tab=consignments&status=${key}`}
                    key={key}
                    className={`rounded-xl border p-5 shadow-sm hover:shadow-md transition-all hover:border-slate-300 block ${color}`}
                  >
                    <div className="text-xs font-medium opacity-80">{label}</div>
                    <div className="text-3xl font-bold mt-1">{(consignmentData!.statusBreakdown as Record<string, number>)[key] ?? 0}</div>
                  </a>
                ))}
                <a
                  href="/ops/consignments?tab=consignments&status=qc"
                  className="rounded-xl border border-purple-200 bg-purple-50 p-5 shadow-sm hover:shadow-md transition-all hover:border-purple-300 block"
                >
                  <div className="text-xs font-medium text-purple-700 opacity-80">Pending QC Items</div>
                  <div className="text-3xl font-bold mt-1 text-purple-700">{consignmentData.pendingQcItems}</div>
                  <div className="text-xs mt-1 text-purple-500 font-medium">awaiting inspection</div>
                </a>
                <a
                  href="/ops/consignments?tab=consignments&status=passed_back"
                  className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm hover:shadow-md transition-all hover:border-emerald-300 block"
                >
                  <div className="text-xs font-medium text-emerald-700 opacity-80">Passed QC Today</div>
                  <div className="text-3xl font-bold mt-1 text-emerald-700">{consignmentData.passedToday}</div>
                  <div className="text-xs mt-1 text-emerald-500 font-medium">items cleared</div>
                </a>
              </div>
              <div className="mt-4">
                <a href="/ops/consignments?tab=consignments" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors">
                  View all consignments →
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {isHo && (countsData.categories as number) === 0 && (
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
          <strong>Getting started:</strong> Start by creating your{" "}
          <a className="underline" href="/masters/categories">
            Categories
          </a>{" "}
          (e.g. Glass, Wood, Stone...), then add Attributes and bind them to each
          category. Everything downstream selects from these masters.
        </div>
      )}

      {occupancyData && (
        <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Warehouse Location Occupancy</h2>
              <p className="text-xs text-slate-500 mt-0.5">Real-time status of eligible nodes in {displayBranchName}</p>
            </div>
            <a
              href="/branch/warehouse"
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline animate-pulse"
            >
              View Warehouse Tree -&gt;
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Occupancy Rate */}
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-semibold text-slate-600">Occupancy Rate</span>
                <span className="text-2xl font-extrabold text-slate-950">{occupancyData.occupancyRate}%</span>
              </div>
              <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-brand-600 rounded-full transition-all duration-500"
                  style={{ width: `${occupancyData.occupancyRate}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-400 font-medium">
                <span>{occupancyData.occupied} Occupied</span>
                <span>{occupancyData.empty} Empty</span>
              </div>
            </div>

            {/* Counts Grid */}
            <div className="grid grid-cols-2 gap-4 col-span-2">
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 flex flex-col justify-between hover:bg-slate-100/50 transition-colors">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Placement Eligible Nodes</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl font-bold text-slate-900">{occupancyData.total}</span>
                  <span className="text-xs font-medium text-slate-500">total locations</span>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 flex flex-col justify-between hover:bg-slate-100/50 transition-colors">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Available (Empty)</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl font-bold text-emerald-600">{occupancyData.empty}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse">Free</span>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 flex flex-col justify-between hover:bg-slate-100/50 transition-colors">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Master Copy Locations</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl font-bold text-amber-700">{occupancyData.masterLocations}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200"> Master</span>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 flex flex-col justify-between hover:bg-slate-100/50 transition-colors">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Slave Copy Only Locations</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl font-bold text-indigo-700">{occupancyData.slaveOnlyLocations}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200"> Slave Only</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Recent Activity</h2>
        <div className="rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md divide-y divide-slate-100">
          {activity.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-400">
              No activity yet.{" "}
              {isOnbLead
                ? "Actions you take (registering sellers, assigning execs, adding sample sizes) will appear here."
                : isOBExec
                  ? "Actions you take (onboarding products, physical placements, generating labels) will appear here."
                  : isConsignment
                    ? "Actions you take (receiving consignments, updating status, running QC) will appear here."
                    : "Actions you take (create, edit, retire...) will appear here."}
            </div>
          ) : (
            activity.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                <span className={`w-2 h-2 rounded-full shrink-0 ${a.tone}`} />
                <div className="text-sm min-w-0">
                  <span className="font-medium text-slate-800">{a.label}</span>
                  {a.target && <span className="text-slate-600"> {a.target}</span>}
                </div>
                <span className="ml-auto text-xs text-slate-400 whitespace-nowrap">
                  {a.actor} · {a.when}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

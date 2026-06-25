import { getSession } from "@/lib/auth";
import { ROLE_LABELS, RoleCode, hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";
import { timeAgo, actionLabel, actionTone, auditTarget } from "@/lib/format";
import LeadAssignmentsTable from "@/components/ops/LeadAssignmentsTable";
import RecentActivityClient from "@/components/dashboard/RecentActivityClient";
import DashboardTicketsList from "@/components/ops/DashboardTicketsList";
import {
  FolderTree,
  Tag,
  Milestone,
  GraduationCap,
  Users,
  Package,
  Layers,
  CheckSquare,
  Warehouse,
  FileCheck,
  Clock,
  Printer,
  MapPin
} from "lucide-react";

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
    actorUserIds = matchingRoles.map((ur: any) => ur.userId);
    whereClause = { actorUserId: { in: actorUserIds } };
  } else if (branchId) {
    const userRoles = await prisma.userRole.findMany({
      where: { branchId },
      select: { userId: true },
    });
    actorUserIds = userRoles.map((ur: any) => ur.userId);
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

  return logs.map((l: any) => ({
    id: l.id.toString(),
    label: actionLabel(l.action),
    tone: actionTone(l.action),
    target: auditTarget(l.afterJson as never, l.beforeJson as never) ?? undefined,
    actor: l.actorUserId ? nameById.get(l.actorUserId.toString()) ?? "Someone" : "System",
    when: timeAgo(l.createdAt),
  }));
}

async function countCategories(status?: string) {
  const whereClause: any = {};
  if (status) whereClause.status = status;
  return prisma.category.count({ where: whereClause });
}

async function globalCounts() {
  const [categories, attributes, brands, programs, sellers, branches, pendingApprovals] =
    await Promise.all([
      countCategories(),
      prisma.attribute.count(),
      prisma.brand.count(),
      prisma.program.count(),
      prisma.seller.count(),
      prisma.branch.count({ where: { status: "active" } }),
      prisma.changeRequest.count({ where: { status: "pending" } }),
    ]);
  return { categories, attributes, brands, programs, sellers, branches, pendingApprovals };
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
    consignmentsCount,
    pipelinesCount,
    pendingApprovalsCount,
    programsCount,
  ] = await Promise.all([
    countCategories("active"),
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
    prisma.onboardingPipeline.count({
      where: {
        assignment: { seller: { branchId } },
        status: { in: ["TICKET_RAISED", "CONSIGNMENT_RECEIVED"] },
      },
    }),
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
    openConsignments: consignmentsCount + pipelinesCount,
    pendingApprovals: pendingApprovalsCount,
    programs: programsCount,
  };
}

async function onbLeadCounts(branchId: bigint) {
  const [
    sellersCount,
    unassignedCount,
    consignmentsCount,
    pipelinesCount,
    sampleSizes,
    programs,
    warehousesCount,
  ] = await Promise.all([
    prisma.seller.count({ where: { branchId } }),
    prisma.seller.count({ where: { branchId, assignments: { none: {} } } }),
    prisma.consignment.count({ where: { seller: { branchId }, status: { not: "closed" } } }),
    prisma.onboardingPipeline.count({
      where: {
        assignment: { seller: { branchId } },
        status: { in: ["TICKET_RAISED", "CONSIGNMENT_RECEIVED"] },
      },
    }),
    prisma.sampleSize.count({ where: { branchId } }),
    prisma.branchProgram.count({ where: { branchId, approvalStatus: "approved" } }),
    prisma.locationNode.count({ where: { branchId, nodeType: "WAREHOUSE", status: "active" } }),
  ]);
  const assignedCount = sellersCount - unassignedCount;
  const openConsignments = consignmentsCount + pipelinesCount;

  // Branch-wide onboarding progress
  const sellerBrands = await prisma.sellerBrand.findMany({
    where: { seller: { branchId } },
    select: { brandId: true },
  });
  const brandIds = [...new Set(sellerBrands.map((sb: any) => sb.brandId))];
  const totalRecords = brandIds.length > 0
    ? await prisma.brandProduct.count({
        where: { brandId: { in: brandIds }, status: "active" },
      })
    : 0;
  const productsOnboarded = await prisma.localOnboardingRecord.count({
    where: { branchId },
  });
  const notOnboardedRecords = Math.max(0, totalRecords - productsOnboarded);

  return {
    sellersCount,
    unassignedCount,
    assignedCount,
    openConsignments,
    sampleSizes,
    programs,
    warehousesCount,
    totalRecords,
    productsOnboarded,
    notOnboardedRecords,
  };
}

async function obExecCounts(branchId: bigint, userId: string) {
  const uid = BigInt(userId);
  const assignedSellers = await prisma.sellerAssignment.findMany({
    where: { obExecUserId: uid },
    select: { sellerId: true },
  });
  const sellerIds = assignedSellers.map((a: any) => a.sellerId);
  const assignedSellersCount = sellerIds.length;

  const [
    pendingConsignments,
    productsOnboarded,
    copiesPlaced,
    copiesUnplaced,
    placementLocations,
    sellerBrands,
  ] = await Promise.all([
    Promise.all([
      sellerIds.length > 0
        ? prisma.consignment.count({ where: { sellerId: { in: sellerIds }, status: "passed_back" } })
        : Promise.resolve(0),
      prisma.onboardingPipeline.count({
        where: {
          assignment: { obExecUserId: uid, seller: { branchId } },
          status: "CONSIGNMENT_RECEIVED",
        },
      }),
    ]).then(([c1, c2]) => c1 + c2),
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
    sellerIds.length > 0
      ? prisma.sellerBrand.findMany({
          where: { sellerId: { in: sellerIds } },
          select: { brandId: true },
        })
      : Promise.resolve([]),
  ]);

  const brandIds = [...new Set(sellerBrands.map((sb: any) => sb.brandId))];
  const totalRecords = brandIds.length > 0
    ? await prisma.brandProduct.count({
        where: { brandId: { in: brandIds }, status: "active" },
      })
    : 0;

  const notOnboardedRecords = Math.max(0, totalRecords - productsOnboarded);

  return {
    assignedSellersCount,
    pendingConsignments,
    productsOnboarded,
    copiesPlaced,
    copiesUnplaced,
    placementLocations,
    totalRecords,
    notOnboardedRecords,
  };
}

async function consignmentUserCounts(branchId: bigint) {
  const statuses = ["initiated", "received", "in_buffer", "fabricating", "qc", "passed_back"];
  const [counts, initiatedPipelines, passedBackPipelines] = await Promise.all([
    Promise.all(
      statuses.map((status) =>
        prisma.consignment.count({ where: { seller: { branchId }, status } })
      )
    ),
    prisma.onboardingPipeline.count({
      where: {
        assignment: { seller: { branchId } },
        status: "TICKET_RAISED",
      },
    }),
    prisma.onboardingPipeline.count({
      where: {
        assignment: { seller: { branchId } },
        status: "CONSIGNMENT_RECEIVED",
      },
    }),
  ]);

  const statusBreakdown = Object.fromEntries(statuses.map((s, i) => [s, counts[i]]));
  statusBreakdown.initiated = (statusBreakdown.initiated || 0) + initiatedPipelines;
  statusBreakdown.passed_back = (statusBreakdown.passed_back || 0) + passedBackPipelines;

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
      const hasMaster = node.copies.some((c) => c.copyRole === "UNIQUE");
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
  const isProjectUser = hasRole(session.roles, "PROJECT_USER");
  const isConciergeManager = hasRole(session.roles, "CONCIERGE_MANAGER");

  // Get branchId for ops roles
  const opsRole = session.roles.find(
    (r) => ["ONB_LEAD", "OB_EXEC", "CONSIGNMENT_USER", "PROJECT_USER", "CONCIERGE_MANAGER"].includes(r.code) && r.branchId
  );
  const opsBranchId = opsRole?.branchId ? BigInt(opsRole.branchId) : null;

  // --- Screen Manager: dedicated RMS-only dashboard (blocks / screens / programs of their branch) ---
  const isScreenManager = hasRole(session.roles, "SCREEN_MANAGER");
  if (isScreenManager && !isHo && !branchId) {
    const smRole = session.roles.find((r) => r.code === "SCREEN_MANAGER" && r.branchId);
    const smBranchId = smRole?.branchId ? BigInt(smRole.branchId) : null;
    const [smBranch, blockCount, screenCount, programCount] = await Promise.all([
      smBranchId ? prisma.branch.findUnique({ where: { id: smBranchId }, select: { name: true } }) : Promise.resolve(null),
      smBranchId ? prisma.locationNode.count({ where: { branchId: smBranchId, nodeType: "BLOCK" } }) : Promise.resolve(0),
      smBranchId ? prisma.screen.count({ where: { branchId: smBranchId } }) : Promise.resolve(0),
      smBranchId ? prisma.branchProgram.count({ where: { branchId: smBranchId, approvalStatus: "approved" } }) : Promise.resolve(0),
    ]);
    const smCards = [
      { label: "Blocks", value: blockCount },
      { label: "Screens", value: screenCount },
      { label: "Programs", value: programCount },
    ];
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome, {session.name}</h1>
          <p className="text-sm text-slate-500 mt-1">
            Signed in as RMS Manager · {smBranch?.name ?? "your branch"}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {smCards.map((c) => (
            <div key={c.label} className="rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-md p-6 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{c.label}</div>
              <div className="mt-2 text-4xl font-bold text-slate-900">{c.value}</div>
            </div>
          ))}
        </div>
        <a
          href="/rms-screens"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Manage RMS Screens
        </a>
      </div>
    );
  }

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
      if (isOnbLead) {
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
            const brandIds = a.seller.sellerBrands.map((sb: any) => sb.brandId);
            const totalSKUs = brandIds.length > 0
              ? await prisma.brandProduct.count({
                  where: { brandId: { in: brandIds }, status: "active" },
                })
              : 0;
            return {
              ...a,
              onboardedCount,
              totalSKUs,
            };
          })
        );
        onbLeadAssignmentsList = serialize(detailed);
      }
    }
    if (isOBExec) {
      obExecData = await obExecCounts(opsBranchId, session.uid);
    }
    if (isConsignment) {
      consignmentData = await consignmentUserCounts(opsBranchId);
    }
  }

  const targetBranchId = branchId ?? opsBranchId;
  let occupancyData = null;
  if (targetBranchId) {
    occupancyData = await getBranchWarehouseOccupancy(targetBranchId);
  }

  // Fetch tickets for Project User, Concierge Manager, OB Exec, and Onboarding Lead
  let dashboardTickets: any[] = [];
  if (targetBranchId) {
    if (isProjectUser) {
      dashboardTickets = await prisma.ticket.findMany({
        where: {
          branchId: targetBranchId,
          currentRole: "PROJECT_USER",
        },
        orderBy: { updatedAt: "desc" },
        include: {
          seller: { select: { name: true, sellerCode: true } },
          brand: { select: { name: true } },
          events: { orderBy: { createdAt: "asc" } },
        },
      });
    } else if (isConciergeManager) {
      dashboardTickets = await prisma.ticket.findMany({
        where: {
          branchId: targetBranchId,
          currentRole: "CONCIERGE_MANAGER",
        },
        orderBy: { updatedAt: "desc" },
        include: {
          seller: { select: { name: true, sellerCode: true } },
          brand: { select: { name: true } },
          events: { orderBy: { createdAt: "asc" } },
        },
      });
    } else if (isOBExec) {
      dashboardTickets = await prisma.ticket.findMany({
        where: {
          branchId: targetBranchId,
          raisedBy: BigInt(session.uid),
        },
        orderBy: { updatedAt: "desc" },
        include: {
          seller: { select: { name: true, sellerCode: true } },
          brand: { select: { name: true } },
          events: { orderBy: { createdAt: "asc" } },
        },
      });
    } else if (isOnbLead) {
      dashboardTickets = await prisma.ticket.findMany({
        where: {
          branchId: targetBranchId,
          type: { in: ["SAMPLE_REQUEST", "SPACE_RACK", "KT_REQUEST"] },
        },
        orderBy: { updatedAt: "desc" },
        include: {
          seller: { select: { name: true, sellerCode: true } },
          brand: { select: { name: true } },
          events: { orderBy: { createdAt: "asc" } },
        },
      });
    }
  }
  const serializedDashboardTickets = serialize(dashboardTickets) as any[];

  // Active flags count for warning banner
  let activeFlagsCount = 0;
  if (!isHo && targetBranchId) {
    activeFlagsCount = await prisma.flag.count({
      where: {
        isResolved: false,
        pipeline: {
          assignment: {
            seller: {
              branchId: targetBranchId,
            },
          },
        },
      },
    });
  }

  // Recent-activity visibility:
  //  - HO Admin       → everything (all branches, all roles)
  //  - Branch Admin   → their branch's Onboarding Lead / Onboarding Exec / Consignment activity
  //  - Onboarding Lead / Project User / Concierge Manager → their branch's operational activity
  //  - OB Exec / Consignment → their own branch-role activity
  let activity;
  if (isHo) {
    activity = await recentActivity(null, []);
  } else if (branchId) {
    activity = await recentActivity(branchId, ["ONB_LEAD", "OB_EXEC", "CONSIGNMENT_USER", "PROJECT_USER", "CONCIERGE_MANAGER"]);
  } else if (isOnbLead || isProjectUser || isConciergeManager) {
    activity = await recentActivity(opsBranchId, ["ONB_LEAD", "OB_EXEC", "CONSIGNMENT_USER", "PROJECT_USER", "CONCIERGE_MANAGER"]);
  } else {
    const ownRoles = session.roles.map((r) => r.code).filter((c) => ["OB_EXEC", "CONSIGNMENT_USER"].includes(c));
    activity = await recentActivity(targetBranchId, ownRoles);
  }
  const roleLabels = session.roles.map((r) => ROLE_LABELS[r.code as RoleCode] ?? r.code);

  const displayBranchName = branchName || opsBranchName;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome, {session.name}</h1>
          <p className="text-sm text-slate-500 mt-1">
            Signed in as {roleLabels.join(", ")} {displayBranchName && `· ${displayBranchName}`}
          </p>
        </div>
      </div>

      {activeFlagsCount > 0 && (
        <div className="rounded-xl border border-amber-250 bg-amber-50/60 backdrop-blur-md p-4 shadow-sm flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600 shrink-0">
              <svg className="w-5 h-5 text-amber-650" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
            <div>
              <h4 className="text-sm font-bold text-amber-900">Active Pipeline Flags</h4>
              <p className="text-xs text-amber-805 mt-0.5 font-medium">
                There {activeFlagsCount === 1 ? "is 1 active flag" : `are ${activeFlagsCount} active flags`} requiring attention in your branch.
              </p>
            </div>
          </div>
          <a
            href="/ops/flags"
            className="px-3.5 py-2 rounded-lg bg-amber-800 hover:bg-amber-900 text-white text-xs font-semibold shadow-sm transition shrink-0"
          >
            Review Flags
          </a>
        </div>
      )}

      {/* Status colour legend — single line */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500">
        <span className="font-semibold uppercase tracking-wider text-slate-400">Status:</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Green — Active / Approved / Passed QC</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Yellow — Pending / In progress</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Red — Rejected / Needs attention</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Blue — New / Informational</span>
      </div>

      {isHo || (!branchId && !opsBranchId) ? (
        // HO Admin Global Dashboard
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-white/60 backdrop-blur-md p-5 shadow-sm hover:shadow-md hover:border-indigo-400 transition-all duration-200 group">
            <div className="absolute top-4 right-4 text-slate-400 group-hover:text-indigo-500 transition-colors">
              <FolderTree className="w-5 h-5" />
            </div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">{countsData.categories as number}</div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1.5">Categories</div>
          </div>
          <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-white/60 backdrop-blur-md p-5 shadow-sm hover:shadow-md hover:border-emerald-400 transition-all duration-200 group">
            <div className="absolute top-4 right-4 text-slate-400 group-hover:text-emerald-500 transition-colors">
              <Tag className="w-5 h-5" />
            </div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">{countsData.attributes as number}</div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1.5">Attributes</div>
          </div>
          <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-white/60 backdrop-blur-md p-5 shadow-sm hover:shadow-md hover:border-blue-400 transition-all duration-200 group">
            <div className="absolute top-4 right-4 text-slate-400 group-hover:text-blue-500 transition-colors">
              <Milestone className="w-5 h-5" />
            </div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">{countsData.brands as number}</div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1.5">Brands</div>
          </div>
          <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-white/60 backdrop-blur-md p-5 shadow-sm hover:shadow-md hover:border-purple-400 transition-all duration-200 group">
            <div className="absolute top-4 right-4 text-slate-400 group-hover:text-purple-500 transition-colors">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">{countsData.programs as number}</div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1.5">Programs</div>
          </div>
          <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-white/60 backdrop-blur-md p-5 shadow-sm hover:shadow-md hover:border-amber-400 transition-all duration-200 group">
            <div className="absolute top-4 right-4 text-slate-400 group-hover:text-amber-500 transition-colors">
              <Users className="w-5 h-5" />
            </div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">{countsData.sellers as number}</div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1.5">Sellers</div>
          </div>
          <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-white/60 backdrop-blur-md p-5 shadow-sm hover:shadow-md hover:border-emerald-450 transition-all duration-200 group">
            <div className="absolute top-4 right-4 text-slate-400 group-hover:text-emerald-500 transition-colors">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">{countsData.branches as number}</div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1.5">Active Branches</div>
          </div>
          <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-white/60 backdrop-blur-md p-5 shadow-sm hover:shadow-md hover:border-rose-400 transition-all duration-200 group">
            <div className="absolute top-4 right-4 text-slate-400 group-hover:text-rose-500 transition-colors">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">{countsData.pendingApprovals as number}</div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1.5">Pending Approvals</div>
          </div>
        </div>
      ) : branchId ? (
        // Branch Admin Dashboard
        <div className="space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Branch Operations</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm hover:border-indigo-400 transition-all duration-200 group">
                <div className="absolute top-4 right-4 text-slate-400 group-hover:text-indigo-500 transition-colors">
                  <Users className="w-5 h-5" />
                </div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Sellers</div>
                <div className="text-3xl font-black mt-1.5 text-slate-900 leading-none">{countsData.sellers as number}</div>
                <div className="text-xs text-slate-400 mt-2 font-medium">{countsData.assignedSellers as number} assigned to execs</div>
              </div>
              <a href="/branch/warehouse" className="relative overflow-hidden group block rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm hover:border-brand-500 hover:shadow-md transition-all duration-200">
                <div className="absolute top-4 right-4 text-slate-400 group-hover:text-brand-500 transition-colors">
                  <Warehouse className="w-5 h-5" />
                </div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider group-hover:text-brand-600">Location IDs</div>
                <div className="text-3xl font-black mt-1.5 text-slate-900 leading-none">{countsData.locations as number}</div>
                <div className="text-xs text-slate-400 mt-2 font-medium">placement-eligible nodes</div>
              </a>
              <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm hover:border-emerald-400 transition-all duration-200 group">
                <div className="absolute top-4 right-4 text-slate-400 group-hover:text-emerald-500 transition-colors">
                  <Layers className="w-5 h-5" />
                </div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Copies on shelf</div>
                <div className="text-3xl font-black mt-1.5 text-slate-900 leading-none">{countsData.copies as number}</div>
                <div className="text-xs text-slate-400 mt-2 font-medium">
                  {countsData.labeledCopies as number} labeled · {countsData.pendingCopies as number} pending
                </div>
              </div>
              <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm hover:border-indigo-400 transition-all duration-200 group">
                <div className="absolute top-4 right-4 text-slate-400 group-hover:text-indigo-500 transition-colors">
                  <Package className="w-5 h-5" />
                </div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Products onboarded</div>
                <div className="text-3xl font-black mt-1.5 text-slate-900 leading-none">{countsData.branchProducts as number}</div>
                <div className="text-xs text-slate-400 mt-2 font-medium">of {countsData.totalProducts as number} total SKUs</div>
              </div>
              <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm hover:border-blue-400 transition-all duration-200 group">
                <div className="absolute top-4 right-4 text-slate-400 group-hover:text-blue-500 transition-colors">
                  <Milestone className="w-5 h-5" />
                </div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Open consignments</div>
                <div className="text-3xl font-black mt-1.5 text-slate-900 leading-none">{countsData.openConsignments as number}</div>
                <div className="text-xs text-slate-400 mt-2 font-medium">in progress</div>
              </div>
              <div className={`relative overflow-hidden rounded-xl border p-5 shadow-sm transition-all duration-200 group ${(countsData.pendingApprovals as number) > 0 ? "border-amber-300 bg-amber-50/50 hover:border-amber-400" : "border-slate-200 bg-white/60 backdrop-blur-md hover:border-rose-400"}`}>
                <div className="absolute top-4 right-4 text-slate-400 group-hover:text-amber-500 transition-colors">
                  <CheckSquare className="w-5 h-5" />
                </div>
                <div className={`text-xs font-medium uppercase tracking-wider ${(countsData.pendingApprovals as number) > 0 ? "text-amber-600" : "text-slate-500"}`}>HO Approvals pending</div>
                <div className={`text-3xl font-black mt-1.5 leading-none ${(countsData.pendingApprovals as number) > 0 ? "text-amber-700" : "text-slate-900"}`}>{countsData.pendingApprovals as number}</div>
                <div className="text-xs text-slate-400 mt-2 font-medium">change requests awaiting HO</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Ops Roles Dashboard
        <div className="space-y-5">
          {/* ONB_LEAD dashboard */}
          {isOnbLead && onbLeadData && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Onboarding Lead Overview</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <a href="/ops/sellers" className="relative overflow-hidden group block rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm hover:border-brand-500 hover:shadow-md transition-all duration-200">
                  <div className="absolute top-4 right-4 text-slate-400 group-hover:text-brand-500 transition-colors">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wider group-hover:text-brand-600">Total Sellers</div>
                  <div className="text-3xl font-black mt-1.5 text-slate-900 leading-none">{onbLeadData.sellersCount}</div>
                  <div className="text-xs text-slate-400 mt-2 font-medium">
                    {onbLeadData.assignedCount} assigned · {onbLeadData.unassignedCount} unassigned
                  </div>
                </a>
                <a href="/ops/assignments" className="relative overflow-hidden group block rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm hover:border-indigo-400 hover:shadow-md transition-all duration-200">
                  <div className="absolute top-4 right-4 text-slate-400 group-hover:text-indigo-500 transition-colors">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wider group-hover:text-indigo-650">Assignments</div>
                  <div className="text-3xl font-black mt-1.5 text-slate-900 leading-none">{onbLeadData.assignedCount}</div>
                  <div className={`text-xs mt-2 font-medium ${onbLeadData.unassignedCount > 0 ? "text-amber-600" : "text-slate-400"}`}>
                    {onbLeadData.unassignedCount} sellers unassigned
                  </div>
                </a>
                <a href="/ops/consignments" className="relative overflow-hidden group block rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm hover:border-blue-400 hover:shadow-md transition-all duration-200">
                  <div className="absolute top-4 right-4 text-slate-400 group-hover:text-blue-500 transition-colors">
                    <Milestone className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wider group-hover:text-blue-600">Open Consignments</div>
                  <div className="text-3xl font-black mt-1.5 text-slate-900 leading-none">{onbLeadData.openConsignments}</div>
                  <div className="text-xs text-slate-400 mt-2 font-medium">not yet closed</div>
                </a>
                <a href="/branch/warehouse" className="relative overflow-hidden group block rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm hover:border-purple-400 hover:shadow-md transition-all duration-200">
                  <div className="absolute top-4 right-4 text-slate-400 group-hover:text-purple-500 transition-colors">
                    <Warehouse className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wider group-hover:text-purple-650">Total Warehouses</div>
                  <div className="text-3xl font-black mt-1.5 text-slate-900 leading-none">{onbLeadData.warehousesCount}</div>
                  <div className="text-xs text-slate-400 mt-2 font-medium">active at branch</div>
                </a>
              </div>

              {/* Branch Onboarding Progress */}
              <div className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Branch Onboarding Progress</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm hover:border-slate-350 transition-all duration-200 group">
                    <div className="absolute top-4 right-4 text-slate-400">
                      <Package className="w-5 h-5" />
                    </div>
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total SKU Records</div>
                    <div className="text-3xl font-black mt-1.5 text-slate-900 leading-none">{onbLeadData.totalRecords}</div>
                    <div className="text-xs text-slate-400 mt-2 font-medium">active products in branch sellers' brands</div>
                  </div>
                  <a href="/ops/onboarding" className="relative overflow-hidden group block rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm hover:border-emerald-400 hover:shadow-md transition-all duration-200">
                     <div className="absolute top-4 right-4 text-emerald-400 group-hover:text-emerald-500 transition-colors">
                       <Layers className="w-5 h-5" />
                     </div>
                     <div className="text-xs font-medium text-slate-500 uppercase tracking-wider group-hover:text-emerald-600">Onboarded SKUs</div>
                     <div className="text-3xl font-black mt-1.5 text-emerald-600 leading-none">{onbLeadData.productsOnboarded}</div>
                     <div className="text-xs text-slate-400 mt-2 font-medium">onboarding records created branch-wide</div>
                  </a>
                  <a href="/ops/onboarding" className="relative overflow-hidden group block rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm hover:border-amber-400 hover:shadow-md transition-all duration-200">
                     <div className="absolute top-4 right-4 text-amber-400 group-hover:text-amber-500 transition-colors">
                       <Clock className="w-5 h-5" />
                     </div>
                     <div className="text-xs font-medium text-slate-500 uppercase tracking-wider group-hover:text-amber-600">Pending Onboarding</div>
                     <div className="text-3xl font-black mt-1.5 text-amber-600 leading-none">{onbLeadData.notOnboardedRecords}</div>
                     <div className="text-xs text-slate-400 mt-2 font-medium">remaining products to onboard</div>
                  </a>
                </div>
              </div>

              {/* Onboarding Request Tickets */}
              <div className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Onboarding Request Tickets</div>
                <DashboardTicketsList tickets={serializedDashboardTickets} userRoles={session.roles.map(r => r.code)} />
              </div>
            </div>
          )}

          {/* OB_EXEC dashboard */}
          {isOBExec && obExecData && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Onboarding Exec Overview</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <a href="/ops/onboarding" className="relative overflow-hidden group block rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm hover:border-brand-500 hover:shadow-md transition-all duration-200">
                  <div className="absolute top-4 right-4 text-slate-400 group-hover:text-brand-500 transition-colors">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wider group-hover:text-brand-600">Assigned Sellers</div>
                  <div className="text-3xl font-black mt-1.5 text-slate-900 leading-none">{obExecData.assignedSellersCount}</div>
                  <div className="text-xs text-slate-400 mt-2 font-medium">sellers assigned to you</div>
                </a>
                <a href="/ops/consignments" className={`relative overflow-hidden group block rounded-xl border p-5 shadow-sm hover:shadow-md transition-all duration-200 ${obExecData.pendingConsignments > 0 ? "border-amber-300 bg-amber-50/50 hover:border-amber-400" : "border-slate-200 bg-white/60 backdrop-blur-md hover:border-blue-400"}`}>
                  <div className="absolute top-4 right-4 text-slate-400 group-hover:text-amber-500 transition-colors">
                    <Milestone className="w-5 h-5" />
                  </div>
                  <div className={`text-xs font-medium uppercase tracking-wider ${obExecData.pendingConsignments > 0 ? "text-amber-600" : "text-slate-500 group-hover:text-blue-600"}`}>Pending Consignments</div>
                  <div className={`text-3xl font-black mt-1.5 leading-none ${obExecData.pendingConsignments > 0 ? "text-amber-700" : "text-slate-900"}`}>{obExecData.pendingConsignments}</div>
                  <div className="text-xs text-slate-400 mt-2 font-medium">awaiting executive verification</div>
                </a>
                <a href="/ops/onboarding" className="relative overflow-hidden group block rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm hover:border-indigo-400 hover:shadow-md transition-all duration-200">
                  <div className="absolute top-4 right-4 text-slate-400 group-hover:text-indigo-500 transition-colors">
                    <Package className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wider group-hover:text-indigo-605">Onboarding Progress</div>
                  <div className="text-3xl font-black mt-1.5 text-slate-900 leading-none">{obExecData.productsOnboarded} / {obExecData.totalRecords}</div>
                  <div className="text-xs text-slate-400 mt-2 font-medium">{obExecData.notOnboardedRecords} SKUs pending</div>
                </a>
                <a href="/ops/placement" className="relative overflow-hidden group block rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm hover:border-emerald-400 hover:shadow-md transition-all duration-200">
                  <div className="absolute top-4 right-4 text-slate-400 group-hover:text-emerald-500 transition-colors">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wider group-hover:text-emerald-600">Physical Copies</div>
                  <div className="text-3xl font-black mt-1.5 text-slate-900 leading-none">{obExecData.copiesPlaced + obExecData.copiesUnplaced}</div>
                  <div className="text-xs text-slate-400 mt-2 font-medium">
                    {obExecData.copiesPlaced} placed · {obExecData.copiesUnplaced} unplaced
                  </div>
                </a>
              </div>
            </div>
          )}

          {/* CONSIGNMENT_USER dashboard */}
          {isConsignment && consignmentData && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Consignment Overview</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {(
                  [
                    { key: "initiated", label: "Initiated", className: "overview-card overview-card-initiated" },
                    { key: "received", label: "Received", className: "overview-card overview-card-received" },
                    { key: "in_buffer", label: "In Buffer", className: "overview-card overview-card-buffer" },
                    { key: "fabricating", label: "Fabricating", className: "overview-card overview-card-fabricating" },
                    { key: "qc", label: "In QC", className: "overview-card overview-card-qc" },
                    { key: "passed_back", label: "Passed Back", className: "overview-card overview-card-passed" },
                  ] as { key: string; label: string; className: string }[]
                ).map(({ key, label, className }) => (
                  <a
                    href={`/ops/consignments?tab=consignments&status=${key}`}
                    key={key}
                    className={`block ${className}`}
                  >
                    <div className="text-xs font-semibold uppercase tracking-wider opacity-75">{label}</div>
                    <div className="text-3xl font-black mt-1.5">{(consignmentData!.statusBreakdown as Record<string, number>)[key] ?? 0}</div>
                  </a>
                ))}
                <a
                  href="/ops/consignments?tab=consignments&status=qc"
                  className="overview-card overview-card-qc block"
                >
                  <div className="text-xs font-semibold uppercase tracking-wider opacity-75">Pending QC Items</div>
                  <div className="text-3xl font-black mt-1.5">{consignmentData.pendingQcItems}</div>
                  <div className="text-xs mt-2 opacity-80 font-semibold">awaiting inspection</div>
                </a>
                <a
                  href="/ops/consignments?tab=consignments&status=passed_back"
                  className="overview-card overview-card-passed block"
                >
                  <div className="text-xs font-semibold uppercase tracking-wider opacity-75">Passed QC Today</div>
                  <div className="text-3xl font-black mt-1.5">{consignmentData.passedToday}</div>
                  <div className="text-xs mt-2 opacity-80 font-semibold">items cleared</div>
                </a>
              </div>
              <div className="mt-4">
                <a href="/ops/consignments?tab=consignments" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors">
                  View all consignments →
                </a>
              </div>
            </div>
          )}

          {/* PROJECT_USER dashboard */}
          {isProjectUser && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Project Overview</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm">
                  <div className="text-xs font-medium text-slate-400">Active Space &amp; Rack Tickets</div>
                  <div className="text-3xl font-bold mt-1 text-amber-600">
                    {serializedDashboardTickets.filter(t => t.status !== "RESOLVED" && t.status !== "CLOSED").length}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">requiring space/rack allocation</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm">
                  <div className="text-xs font-medium text-slate-400">Resolved Space &amp; Rack Tickets</div>
                  <div className="text-3xl font-bold mt-1 text-emerald-600">
                    {serializedDashboardTickets.filter(t => t.status === "RESOLVED" || t.status === "CLOSED").length}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">allocation completed</div>
                </div>
              </div>
            </div>
          )}

          {/* CONCIERGE_MANAGER dashboard */}
          {isConciergeManager && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Concierge Coordination Overview</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm">
                  <div className="text-xs font-medium text-slate-400">Active Knowledge Transfer Tickets</div>
                  <div className="text-3xl font-bold mt-1 text-amber-600">
                    {serializedDashboardTickets.filter(t => t.status !== "RESOLVED" && t.status !== "CLOSED").length}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">requiring coordination</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm">
                  <div className="text-xs font-medium text-slate-400">Resolved Knowledge Transfer Tickets</div>
                  <div className="text-3xl font-bold mt-1 text-emerald-600">
                    {serializedDashboardTickets.filter(t => t.status === "RESOLVED" || t.status === "CLOSED").length}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">session completed</div>
                </div>
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

      {occupancyData && !isConciergeManager && (
        isOBExec && !isOnbLead ? (
          <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Warehouse Tree</h2>
              <p className="text-xs text-slate-500 mt-0.5">Navigate and view the warehouse location layout for {displayBranchName}.</p>
            </div>
            <a
              href="/branch/warehouse"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors shrink-0"
            >
              View Warehouse Tree
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
            </a>
          </div>
        ) : (
          <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Warehouse Location Occupancy</h2>
                <p className="text-xs text-slate-500 mt-0.5">Real-time status of eligible nodes in {displayBranchName}</p>
              </div>
              <a
                href="/branch/warehouse"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white hover:text-slate-200"
              >
                View Warehouse Tree
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              {/* Occupancy Rate */}
              <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-semibold text-slate-600">Occupancy Rate</span>
                  <span className="text-2xl font-extrabold text-brand-600">{occupancyData.occupancyRate}%</span>
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

                <div className="rounded-xl bg-slate-55 border border-slate-100 p-4 flex flex-col justify-between hover:bg-slate-100/50 transition-colors">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Unique Copy Locations</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-2xl font-bold text-amber-700">{occupancyData.masterLocations}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">Unique</span>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-55 border border-slate-100 p-4 flex flex-col justify-between hover:bg-slate-100/50 transition-colors">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Copy Only Locations</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-2xl font-bold text-indigo-700">{occupancyData.slaveOnlyLocations}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">Copy Only</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {isOnbLead && onbLeadAssignmentsList.length > 0 && (
        <LeadAssignmentsTable assignments={onbLeadAssignmentsList} />
      )}

      <RecentActivityClient
        items={activity}
        emptyHint={
          isOnbLead
            ? "Actions you take (registering sellers, assigning execs, adding sample sizes) will appear here."
            : isOBExec
            ? "Actions you take (onboarding products, physical placements, generating labels) will appear here."
            : isConsignment
            ? "Actions you take (receiving consignments, updating status, running QC) will appear here."
            : "Actions you take (create, edit, retire...) will appear here."
        }
      />
    </div>
  );
}

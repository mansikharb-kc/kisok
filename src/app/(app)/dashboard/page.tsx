import { getSession } from "@/lib/auth";
import { ROLE_LABELS, RoleCode, hasRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { timeAgo, actionLabel, actionTone, auditTarget } from "@/lib/format";

async function recentActivity(branchId: bigint | null) {
  // If branch-scoped, fetch activities initiated by users belonging to this branch,
  // or actions matching this branch ID.
  let whereClause = {};

  if (branchId) {
    const userRoles = await prisma.userRole.findMany({
      where: { branchId },
      select: { userId: true },
    });
    const actorUserIds = userRoles.map((ur) => ur.userId);

    whereClause = {
      actorUserId: { in: actorUserIds },
    };
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

async function globalCounts() {
  const [categories, attributes, brands, programs, sellers, products, copies, pendingApprovals] =
    await Promise.all([
      prisma.category.count(),
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
    // HO Global masters — branch admin needs visibility into the full catalogue
    totalCategories,
    totalAttributes,
    totalAttributeBindings,
    totalBrands,
    approvedBrands,
    totalProducts,

    // Branch-scoped counts
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
    // Global — all categories HO has defined
    prisma.category.count({ where: { status: "active" } }),
    // Global — all attributes
    prisma.attribute.count({ where: { status: "active" } }),
    // Global — total category-attribute bindings (shows richness of catalogue)
    prisma.categoryAttribute.count(),
    // Global — all approved brands in the system
    prisma.brand.count({ where: { status: "active" } }),
    prisma.brand.count({ where: { status: "active", approvalStatus: "approved" } }),
    // Global — all product SKUs defined across all brands
    prisma.brandProduct.count({ where: { status: "active" } }),

    // Branch-scoped — brands linked to this branch
    prisma.branchBrand.count({ where: { branchId } }),
    // Branch-scoped — products onboarded at this branch
    prisma.brandProduct.count({ where: { copies: { some: { branchId } } } }),
    // Branch-scoped
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
    // HO master visibility
    totalCategories,
    totalAttributes,
    totalAttributeBindings,
    totalBrands,
    approvedBrands,
    totalProducts,
    // Branch scoped
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

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const isHo = hasRole(session.roles, "HO_ADMIN");
  const branchRole = session.roles.find((r) => r.code === "BRANCH_ADMIN");
  const branchId = branchRole?.branchId ? BigInt(branchRole.branchId) : null;

  let countsData: any;
  let branchName = "";

  if (isHo || !branchId) {
    countsData = await globalCounts();
  } else {
    countsData = await branchCounts(branchId);
    const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } });
    branchName = branch?.name || "Managed Branch";
  }

  const activity = await recentActivity(isHo ? null : branchId);
  const roleLabels = session.roles.map((r) => ROLE_LABELS[r.code as RoleCode] ?? r.code);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome, {session.name}</h1>
        <p className="text-sm text-slate-500 mt-1">
          Signed in as {roleLabels.join(", ")} {branchName && `· ${branchName}`}
        </p>
      </div>

      {isHo || !branchId ? (
        // HO Admin Global Dashboard
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-2xl font-bold">{countsData.categories}</div>
            <div className="text-xs text-slate-500 mt-1">Categories</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-2xl font-bold">{countsData.attributes}</div>
            <div className="text-xs text-slate-500 mt-1">Attributes</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-2xl font-bold">{countsData.brands}</div>
            <div className="text-xs text-slate-500 mt-1">Brands</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-2xl font-bold">{countsData.programs}</div>
            <div className="text-xs text-slate-500 mt-1">Programs</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-2xl font-bold">{countsData.sellers}</div>
            <div className="text-xs text-slate-500 mt-1">Sellers</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-2xl font-bold">{(countsData as any).products}</div>
            <div className="text-xs text-slate-500 mt-1">Products (SKUs)</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-2xl font-bold">{countsData.copies}</div>
            <div className="text-xs text-slate-500 mt-1">Physical Copies</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-2xl font-bold">{countsData.pendingApprovals}</div>
            <div className="text-xs text-slate-500 mt-1">Pending Approvals</div>
          </div>
        </div>
      ) : (
        // Branch Admin Dashboard — HO masters visibility + branch-scoped ops
        <div className="space-y-5">

          {/* HO Masters — read-only visibility for branch admin */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">HO Masters</span>
              <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Global catalogue · view only</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

              <a href="/masters/categories" className="group rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-brand-300 hover:shadow-md transition-all">
                <div className="text-xs font-medium text-slate-400 group-hover:text-brand-600">Categories</div>
                <div className="text-3xl font-bold mt-1 text-slate-900">{countsData.totalCategories}</div>
                <div className="text-xs text-slate-500 mt-1">{countsData.totalAttributeBindings} attribute bindings</div>
              </a>

              <a href="/masters/attributes" className="group rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-brand-300 hover:shadow-md transition-all">
                <div className="text-xs font-medium text-slate-400 group-hover:text-brand-600">Attributes</div>
                <div className="text-3xl font-bold mt-1 text-slate-900">{countsData.totalAttributes}</div>
                <div className="text-xs text-slate-500 mt-1">global attribute library</div>
              </a>

              <a href="/masters/brands" className="group rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-brand-300 hover:shadow-md transition-all">
                <div className="text-xs font-medium text-slate-400 group-hover:text-brand-600">Brands</div>
                <div className="text-3xl font-bold mt-1 text-slate-900">{countsData.totalBrands}</div>
                <div className="text-xs text-slate-500 mt-1">{countsData.approvedBrands} approved · {countsData.branchBrands} at this branch</div>
              </a>

              <a href="/masters/programs" className="group rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-brand-300 hover:shadow-md transition-all">
                <div className="text-xs font-medium text-slate-400 group-hover:text-brand-600">Programs</div>
                <div className="text-3xl font-bold mt-1 text-slate-900">{countsData.totalProducts}</div>
                <div className="text-xs text-slate-500 mt-1">{countsData.programs} programs active at branch</div>
              </a>

            </div>
          </div>

          {/* Branch Operations */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Branch Operations</span>
              <span className="text-[10px] bg-brand-50 text-brand-600 px-2 py-0.5 rounded-full font-medium">{branchName}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">

              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs font-medium text-slate-400">Sellers</div>
                <div className="text-3xl font-bold mt-1 text-slate-900">{countsData.sellers}</div>
                <div className="text-xs text-slate-500 mt-1">{countsData.assignedSellers} assigned to execs</div>
              </div>

              <a href="/branch/warehouse" className="group rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-brand-300 hover:shadow-md transition-all">
                <div className="text-xs font-medium text-slate-400 group-hover:text-brand-600">Location IDs</div>
                <div className="text-3xl font-bold mt-1 text-slate-900">{countsData.locations}</div>
                <div className="text-xs text-slate-500 mt-1">placement-eligible nodes</div>
              </a>

              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs font-medium text-slate-400">Copies on shelf</div>
                <div className="text-3xl font-bold mt-1 text-slate-900">{countsData.copies}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {countsData.labeledCopies} labeled · {countsData.pendingCopies} pending
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs font-medium text-slate-400">Products onboarded</div>
                <div className="text-3xl font-bold mt-1 text-slate-900">{countsData.branchProducts}</div>
                <div className="text-xs text-slate-500 mt-1">of {countsData.totalProducts} total SKUs</div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs font-medium text-slate-400">Open consignments</div>
                <div className="text-3xl font-bold mt-1 text-slate-900">{countsData.openConsignments}</div>
                <div className="text-xs text-slate-500 mt-1">in progress</div>
              </div>

              <div className={`rounded-lg border p-5 shadow-sm ${countsData.pendingApprovals > 0 ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}>
                <div className={`text-xs font-medium ${countsData.pendingApprovals > 0 ? "text-amber-600" : "text-slate-400"}`}>HO Approvals pending</div>
                <div className={`text-3xl font-bold mt-1 ${countsData.pendingApprovals > 0 ? "text-amber-700" : "text-slate-900"}`}>{countsData.pendingApprovals}</div>
                <div className="text-xs text-slate-500 mt-1">change requests awaiting HO</div>
              </div>

            </div>
          </div>
        </div>
      )}

      {isHo && countsData.categories === 0 && (
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
          <strong>Getting started:</strong> Start by creating your{" "}
          <a className="underline" href="/masters/categories">
            Categories
          </a>{" "}
          (e.g. Glass, Wood, Stone…), then add Attributes and bind them to each
          category. Everything downstream selects from these masters.
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Recent Activity</h2>
        <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
          {activity.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-400">
              No activity yet. Actions you take (create, edit, retire…) will appear here.
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

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
  // Find all category IDs associated with brands that are active in this branch
  const activeCategoryMappings = await prisma.brandCategory.findMany({
    where: {
      brand: {
        branchBrands: {
          some: { branchId }
        }
      }
    },
    select: { categoryId: true }
  });

  const categoryIds = [...new Set(activeCategoryMappings.map((ac) => ac.categoryId))];
  const categoriesCount = categoryIds.length;

  const [
    attributesCount,
    brandsCount,
    productsCount,
    sellersCount,
    assignedSellersCount,
    locationsCount,
    copiesCount,
    labeledCopiesCount,
    openConsignmentsCount,
    pendingApprovalsCount,
  ] = await Promise.all([
    prisma.categoryAttribute.count({
      where: {
        categoryId: { in: categoryIds }
      }
    }),
    prisma.branchBrand.count({ where: { branchId } }),
    prisma.brandProduct.count({ where: { copies: { some: { branchId } } } }),
    prisma.seller.count({ where: { branchId } }),
    prisma.sellerAssignment.count({ where: { seller: { branchId } } }),
    prisma.locationNode.count({ where: { branchId, isPlacementEligible: true } }),
    prisma.productCopy.count({ where: { branchId } }),
    prisma.sticker.count({ where: { copy: { branchId }, status: "printed" } }),
    prisma.consignment.count({ where: { seller: { branchId }, status: { not: "closed" } } }),
    prisma.changeRequest.count({ where: { branchId, status: "pending" } }),
  ]);

  return {
    categories: categoriesCount,
    attributes: attributesCount,
    brands: brandsCount,
    products: productsCount,
    sellers: sellersCount,
    assignedSellers: assignedSellersCount,
    locations: locationsCount,
    copies: copiesCount,
    labeledCopies: labeledCopiesCount,
    pendingCopies: copiesCount - labeledCopiesCount,
    openConsignments: openConsignmentsCount,
    pendingApprovals: pendingApprovalsCount,
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
        // Branch Admin Custom Scoped Dashboard (Matches Reference Image 5)
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-medium text-slate-400">Categories</div>
            <div className="text-3xl font-bold mt-1 text-slate-900">{countsData.categories}</div>
            <div className="text-xs text-slate-500 mt-1">{countsData.attributes} attributes bound</div>
          </div>
          
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-medium text-slate-400">Brands</div>
            <div className="text-3xl font-bold mt-1 text-slate-900">{countsData.brands}</div>
            <div className="text-xs text-slate-500 mt-1">{countsData.products} product masters</div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-medium text-slate-400">Sellers</div>
            <div className="text-3xl font-bold mt-1 text-slate-900">{countsData.sellers}</div>
            <div className="text-xs text-slate-500 mt-1">{countsData.assignedSellers} assigned to execs</div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-medium text-slate-400">Location IDs</div>
            <div className="text-3xl font-bold mt-1 text-slate-900">{countsData.locations}</div>
            <div className="text-xs text-slate-500 mt-1">branch {branchName}</div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-medium text-slate-400">Copies on shelf</div>
            <div className="text-3xl font-bold mt-1 text-slate-900">{countsData.copies}</div>
            <div className="text-xs text-slate-500 mt-1">
              {countsData.labeledCopies} labeled · {countsData.pendingCopies} pending
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-medium text-slate-400">Open consignments</div>
            <div className="text-3xl font-bold mt-1 text-slate-900">{countsData.openConsignments}</div>
            <div className="text-xs text-slate-500 mt-1">
              {countsData.pendingApprovals} HO approvals pending
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

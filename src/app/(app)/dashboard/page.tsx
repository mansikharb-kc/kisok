import { getSession } from "@/lib/auth";
import { ROLE_LABELS, RoleCode, hasRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { timeAgo, actionLabel, actionTone, auditTarget } from "@/lib/format";

async function recentActivity() {
  const logs = await prisma.auditLog.findMany({
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

async function counts() {
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const [c, activity] = await Promise.all([counts(), recentActivity()]);
  const roleLabels = session.roles.map((r) => ROLE_LABELS[r.code as RoleCode] ?? r.code);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome, {session.name}</h1>
        <p className="text-sm text-slate-500 mt-1">
          Signed in as {roleLabels.join(", ")}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Categories" value={c.categories} />
        <Stat label="Attributes" value={c.attributes} />
        <Stat label="Brands" value={c.brands} />
        <Stat label="Programs" value={c.programs} />
        <Stat label="Sellers" value={c.sellers} />
        <Stat label="Products (SKUs)" value={c.products} />
        <Stat label="Physical Copies" value={c.copies} />
        <Stat label="Pending Approvals" value={c.pendingApprovals} />
      </div>

      {hasRole(session.roles, "HO_ADMIN") && c.categories === 0 && (
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

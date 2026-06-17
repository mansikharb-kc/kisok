import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma, serialize } from "@/lib/prisma";
import PlacementForm from "@/components/ops/PlacementForm";
import PlacementList from "@/components/ops/PlacementList";

export const dynamic = "force-dynamic";

export default async function PlacementPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const allowedRoles = ["OB_EXEC", "ONB_LEAD"];
  const hasAccess = session.roles.some((r) => allowedRoles.includes(r.code));
  if (!hasAccess) redirect("/dashboard");

  const opsRole = session.roles.find((r) => allowedRoles.includes(r.code) && r.branchId);
  const branchId = opsRole?.branchId ? BigInt(opsRole.branchId) : null;
  if (!branchId) redirect("/dashboard");

  const isExec = session.roles.some((r) => r.code === "OB_EXEC");
  const uid = BigInt(session.uid);

  // OB_EXEC operates on assigned sellers only; ONB_LEAD gets a read-only branch view.
  const recordFilter = isExec
    ? { branchId, seller: { assignments: { some: { obExecUserId: uid } } } }
    : { branchId };

  const [copies, branch, records, locations, sizes] = await Promise.all([
    prisma.productCopy.findMany({
      where: { branchId, record: recordFilter },
      orderBy: { createdAt: "desc" },
      include: {
        product: { select: { name: true, sku: true, brand: { select: { name: true } } } },
        location: { select: { name: true, locationId: true, path: true } },
        size: { select: { label: true } },
        qr: { select: { url: true } },
        record: { include: { seller: { select: { name: true } } } },
      },
    }),
    prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } }),
    prisma.localOnboardingRecord.findMany({
      where: recordFilter,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        product: { select: { name: true, sku: true, category: { select: { name: true } } } },
        seller: { select: { name: true, sellerCode: true } },
        programId: true,
      },
    }),
    prisma.locationNode.findMany({
      where: { branchId, isPlacementEligible: true, status: "active" },
      orderBy: [{ path: "asc" }, { name: "asc" }],
      select: { id: true, name: true, locationId: true, path: true, programId: true },
    }),
    prisma.sampleSize.findMany({
      where: { branchId, status: "active" },
      orderBy: { label: "asc" },
      select: { id: true, label: true },
    }),
  ]);

  const rows = serialize(copies) as any[];

  const total = rows.length;
  const masterCount = rows.filter((c) => c.copyRole === "MASTER").length;
  const slaveCount = total - masterCount;
  const unplacedCount = rows.filter((c) => !c.locationNodeId).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Physical Placement & QR Stickers</h1>
          <p className="text-sm text-slate-500 mt-1">
            Map physical samples/copies to location nodes, audit copy roles, and manage QR tags for{" "}
            {branch?.name ?? "your branch"}.
          </p>
        </div>
        {isExec && (
          <PlacementForm
            records={serialize(records) as any[]}
            locations={serialize(locations) as any[]}
            sizes={serialize(sizes) as any[]}
          />
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Copies on shelf</div>
          <div className="text-3xl font-bold mt-1 text-slate-900">{total}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Master Copies</div>
          <div className="text-3xl font-bold mt-1 text-indigo-700">{masterCount}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Slave Copies</div>
          <div className="text-3xl font-bold mt-1 text-slate-700">{slaveCount}</div>
        </div>
        <div className={`rounded-xl border p-5 shadow-sm ${unplacedCount > 0 ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white/60 backdrop-blur-md"}`}>
          <div className={`text-xs font-semibold uppercase tracking-wider ${unplacedCount > 0 ? "text-amber-600" : "text-slate-400"}`}>Unplaced Copies</div>
          <div className={`text-3xl font-bold mt-1 ${unplacedCount > 0 ? "text-amber-700" : "text-slate-900"}`}>{unplacedCount}</div>
        </div>
      </div>

      {/* Main List */}
      <PlacementList rows={rows} />
    </div>
  );
}

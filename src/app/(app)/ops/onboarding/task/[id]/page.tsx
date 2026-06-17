import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";
import { subtractDays, formatDMY, formatDaysToYMD } from "@/lib/brandMeta";
import { formatDate } from "@/lib/format";
import ExtendFitoutForm from "@/components/ops/ExtendFitoutForm";

export const dynamic = "force-dynamic";

interface TaskPageProps {
  params: {
    id: string;
  };
}

export default async function TaskPage({ params }: TaskPageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const isExec = hasRole(session.roles, "OB_EXEC");
  const isLead = hasRole(session.roles, "ONB_LEAD");
  if (!isExec && !isLead) redirect("/dashboard");

  // Get user's branch
  const roleEntry =
    session.roles.find((r) => r.code === "OB_EXEC" && r.branchId) ??
    session.roles.find((r) => r.code === "ONB_LEAD" && r.branchId);
  const branchId = roleEntry?.branchId ? BigInt(roleEntry.branchId) : null;
  if (!branchId) redirect("/dashboard");

  // Parse assignment ID
  let assignmentId: bigint;
  try {
    assignmentId = BigInt(params.id);
  } catch {
    notFound();
  }

  // Fetch assignment details
  const assignment = await prisma.sellerAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      seller: {
        include: {
          sellerBrands: {
            include: {
              brand: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
          branch: {
            select: {
              name: true,
            },
          },
        },
      },
      program: true,
      exec: {
        select: {
          fullName: true,
          email: true,
        },
      },
    },
  });

  if (!assignment) notFound();

  // Access check
  if (assignment.seller.branchId !== branchId) {
    redirect("/dashboard");
  }
  if (isExec && assignment.obExecUserId !== BigInt(session.uid)) {
    redirect("/dashboard");
  }

  // Fetch program contract
  const contract = await prisma.sellerContract.findFirst({
    where: {
      sellerId: assignment.sellerId,
      programId: assignment.programId,
    },
  });

  // Get brands associated with the seller
  const sellerBrands = assignment.seller.sellerBrands;
  const brandIds = sellerBrands.map((sb) => sb.brandId);

  // Fetch all active products under these brands
  const products = await prisma.brandProduct.findMany({
    where: {
      brandId: { in: brandIds },
      status: "active",
    },
    include: {
      brand: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  // Fetch local onboarding records for status check
  const onboardingRecords = await prisma.localOnboardingRecord.findMany({
    where: {
      sellerId: assignment.sellerId,
      programId: assignment.programId,
      branchId: branchId,
      brandProductId: { in: products.map((p) => p.id) },
    },
    select: {
      brandProductId: true,
      status: true,
    },
  });

  // Create lookup dictionary for status and presence
  const onboardingMap = new Map<string, string>();
  onboardingRecords.forEach((rec) => {
    onboardingMap.set(rec.brandProductId.toString(), rec.status);
  });

  // Serialize objects for safer server component rendering (converting BigInts to string)
  const a = serialize(assignment) as any;
  const c = contract ? (serialize(contract) as any) : null;
  const pList = serialize(products) as any[];

  // Group products by brand ID for easier rendering
  const productsByBrandId: Record<string, any[]> = {};
  pList.forEach((prod) => {
    if (!productsByBrandId[prod.brandId]) {
      productsByBrandId[prod.brandId] = [];
    }
    productsByBrandId[prod.brandId].push(prod);
  });

  // Date parsing and calculations
  let fitoutStr = "";
  let startStr = "";
  let endStr = "";
  let baseStartDate = "";
  let fitoutEnd = "";
  let isTodayInFitout = false;
  let isTodayInCollaboration = false;

  if (c) {
    fitoutStr = c.fitoutPeriod ? c.fitoutPeriod.replace(/\D/g, "") : "";
    startStr = c.contractStart ? c.contractStart.slice(0, 10) : "";
    endStr = c.contractEnd ? c.contractEnd.slice(0, 10) : "";
    baseStartDate = startStr && fitoutStr ? subtractDays(startStr, fitoutStr) : "";
    fitoutEnd = baseStartDate && fitoutStr ? subtractDays(startStr, "1") : "";

    const todayStr = new Date().toISOString().slice(0, 10);
    isTodayInFitout = !!(baseStartDate && fitoutEnd && todayStr >= baseStartDate && todayStr <= fitoutEnd);
    isTodayInCollaboration = !!(startStr && endStr && todayStr >= startStr && todayStr <= endStr);
  }

  const cardStyle = "bg-white/60 backdrop-blur-md rounded-2xl border border-slate-200 p-6 shadow-sm";

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back button and Header */}
      <div>
        <Link
          href="/ops/onboarding"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          ‹ Back to Product Onboarding
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Onboarding Workspace</h1>
            <p className="text-sm text-slate-500">
              Manage timeline extensions and SKU checklists for {a.seller.name}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
              Seller Code: <span className="font-mono text-[11px] font-bold">{a.seller.sellerCode}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-3 py-1 text-xs font-semibold text-brand-700">
              Program: <span className="font-bold">{a.program.name}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Warning if contract is missing */}
      {!c && (
        <div className="rounded-2xl border border-dashed border-red-350 bg-red-50/50 p-6 text-center shadow-sm">
          <h3 className="text-sm font-bold text-red-800">Program Contract Missing</h3>
          <p className="text-xs text-red-650 mt-1 max-w-md mx-auto">
            No program contract was found establishing the collaboration details for this seller under "{a.program.name}".
            Please create a contract first to display timelines and enable extensions.
          </p>
        </div>
      )}

      {/* Grid of timelines and extension form */}
      {c && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Timeline & Schedule details */}
          <div className="md:col-span-2 space-y-6">
            <div className={cardStyle}>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-105">
                <h3 className="font-bold text-slate-950 text-sm">Contract Schedules &amp; Timelines</h3>
                <div className="flex gap-2">
                  {isTodayInFitout && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200">
                      <span className="h-1 w-1 rounded-full bg-sky-500 animate-pulse" />
                      In Fitout
                    </span>
                  )}
                  {isTodayInCollaboration && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                      Active Collaboration
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Fitout Timeline Section */}
                <div className="rounded-xl bg-slate-50/80 border border-slate-150 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <span className="font-bold text-slate-700 text-xs uppercase tracking-wider">Fitout Period</span>
                    <span className="font-mono text-xs font-bold text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded">
                      {fitoutStr ? `${fitoutStr} Days` : "Not Set"}
                    </span>
                  </div>
                  <div className="space-y-2.5 text-xs">
                    <div>
                      <div className="text-slate-400 font-semibold uppercase tracking-wider">Start Date</div>
                      <div className="text-slate-800 font-bold mt-0.5">
                        {baseStartDate ? formatDMY(baseStartDate) : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400 font-semibold uppercase tracking-wider">End Date</div>
                      <div className="text-slate-800 font-bold mt-0.5">
                        {fitoutEnd ? formatDMY(fitoutEnd) : "—"}
                      </div>
                    </div>
                    {fitoutStr && formatDaysToYMD(fitoutStr) && (
                      <div className="text-[11px] text-slate-500 font-semibold italic mt-1">
                        ({formatDaysToYMD(fitoutStr)} equivalent)
                      </div>
                    )}
                  </div>
                </div>

                {/* Collaboration Timeline Section */}
                <div className="rounded-xl bg-slate-50/80 border border-slate-150 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <span className="font-bold text-slate-700 text-xs uppercase tracking-wider">Collaboration Tenure</span>
                    <span className="font-mono text-xs font-bold text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded">
                      {c.collaborationTenure ? `${c.collaborationTenure.replace(/\D/g, "")} Days` : "Not Set"}
                    </span>
                  </div>
                  <div className="space-y-2.5 text-xs">
                    <div>
                      <div className="text-slate-400 font-semibold uppercase tracking-wider">Start Date</div>
                      <div className="text-slate-800 font-bold mt-0.5">
                        {startStr ? formatDMY(startStr) : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400 font-semibold uppercase tracking-wider">End Date</div>
                      <div className="text-slate-800 font-bold mt-0.5">
                        {endStr ? formatDMY(endStr) : "—"}
                      </div>
                    </div>
                    {c.collaborationTenure && formatDaysToYMD(c.collaborationTenure) && (
                      <div className="text-[11px] text-slate-500 font-semibold italic mt-1">
                        ({formatDaysToYMD(c.collaborationTenure)} equivalent)
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {c.remarks && (
                <div className="mt-5 pt-4 border-t border-slate-150 text-xs">
                  <span className="text-slate-400 font-bold uppercase tracking-wider block mb-1">
                    Timeline Notes / Extension History
                  </span>
                  <div className="bg-slate-50/50 rounded-lg border border-slate-100 p-3 text-slate-600 font-mono leading-relaxed whitespace-pre-line max-h-[150px] overflow-y-auto">
                    {c.remarks}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Extend Fitout Form Card */}
          <div className="md:col-span-1">
            <ExtendFitoutForm
              assignmentId={a.id}
              currentFitoutDays={fitoutStr ? Number(fitoutStr) : 0}
            />
          </div>
        </div>
      )}

      {/* SKU Onboarding Checklist Card */}
      <div className={cardStyle}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-2 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-950 text-sm">SKU Onboarding Checklist</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Verify which products under the seller's brands are onboarded in the "{a.program.name}" program.
            </p>
          </div>
          <div className="flex gap-2">
            <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
              Total SKUs: {products.length}
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-emerald-50 text-emerald-700 font-semibold px-2.5 py-1 text-xs border border-emerald-200">
              Onboarded: {onboardingRecords.length}
            </span>
          </div>
        </div>

        {sellerBrands.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-350 bg-slate-50/50 p-8 text-center text-sm text-slate-400">
            No brands are currently associated with this seller.
          </div>
        ) : (
          <div className="space-y-6">
            {sellerBrands.map((sb) => {
              const brandProducts = productsByBrandId[sb.brand.id.toString()] ?? [];

              return (
                <div key={sb.brand.id.toString()} className="border border-slate-150 rounded-xl overflow-hidden bg-white/40 shadow-xs">
                  <div className="bg-slate-55 border-b border-slate-150 px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 text-sm">{sb.brand.name}</span>
                      <span className="text-[10px] font-mono text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                        {sb.brand.code}
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500">
                      {brandProducts.length} SKU{brandProducts.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {brandProducts.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 italic">
                      No active products found under this brand.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {brandProducts.map((p) => {
                        const status = onboardingMap.get(p.id.toString());
                        const isOnboarded = !!status;

                        return (
                          <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/30 transition-colors">
                            <div className="space-y-0.5 max-w-lg">
                              <div className="font-semibold text-slate-800 text-sm">{p.name}</div>
                              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                <span className="font-mono text-slate-400 font-medium">SKU: {p.sku}</span>
                                <span className="text-slate-350">•</span>
                                <span className="text-slate-500 font-medium bg-slate-100 px-1.5 py-0.5 rounded">
                                  Category: {p.category.name}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                              {isOnboarded ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                  Onboarded ({status})
                                </span>
                              ) : (
                                <>
                                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                    Pending
                                  </span>
                                  {isExec && (
                                    <Link
                                      href={`/ops/onboarding/new?sellerId=${a.sellerId}&programId=${a.programId}&brandId=${sb.brand.id}`}
                                      className="inline-flex items-center gap-1 rounded bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition shadow-sm"
                                    >
                                      + Onboard Product
                                    </Link>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

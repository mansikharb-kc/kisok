import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";
import { subtractDays, formatDMY, formatDaysToYMD } from "@/lib/brandMeta";
import { formatDate } from "@/lib/format";
import ExtendFitoutForm from "@/components/ops/ExtendFitoutForm";
import OnboardingPipelineForm from "@/components/ops/OnboardingPipelineForm";
import SkuOnboardingChecklist from "@/components/ops/SkuOnboardingChecklist";

export const dynamic = "force-dynamic";

interface TaskPageProps {
  params: {
    id: string;
  };
  searchParams: {
    brandId?: string;
  };
}

export default async function TaskPage({ params, searchParams }: TaskPageProps) {
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

  // Fetch assignment details (without pipeline relation first)
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
                  contactPerson: true,
                  phone: true,
                  email: true,
                  brandCategories: {
                    include: {
                      category: {
                        select: {
                          id: true,
                          name: true,
                          code: true,
                        },
                      },
                    },
                  },
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

  // Get brands associated with the seller
  const sellerBrands = assignment.seller.sellerBrands;
  const brandIds = sellerBrands.map((sb) => sb.brandId);

  // Determine active brand
  let activeBrandId: bigint | null = null;
  if (searchParams.brandId) {
    try {
      activeBrandId = BigInt(searchParams.brandId);
    } catch {}
  }
  if (!activeBrandId && brandIds.length > 0) {
    activeBrandId = brandIds[0];
  }

  const activeBrand = sellerBrands.find((sb) => sb.brand.id.toString() === activeBrandId?.toString())?.brand;

  // Fetch or create pipeline for the active brand
  let pipeline = null;
  if (activeBrandId) {
    pipeline = await prisma.onboardingPipeline.findUnique({
      where: {
        assignmentId_brandId: {
          assignmentId,
          brandId: activeBrandId,
        },
      },
      include: {
        ticket: true,
        reminders: {
          where: {
            userId: BigInt(session.uid),
            status: "pending",
          },
        },
        flags: true,
      },
    });

    if (!pipeline) {
      pipeline = await prisma.onboardingPipeline.create({
        data: {
          assignmentId,
          brandId: activeBrandId,
          status: "INITIATION",
        },
        include: {
          ticket: true,
          reminders: {
            where: {
              userId: BigInt(session.uid),
              status: "pending",
            },
          },
          flags: true,
        },
      });
    }
  }

  // Fetch program contract
  const contract = await prisma.sellerContract.findFirst({
    where: {
      sellerId: assignment.sellerId,
      programId: assignment.programId,
    },
  });

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

  // Fetch local onboarding records for status check, plus locations and sizes for placement
  const [onboardingRecords, locations, sizes] = await Promise.all([
    prisma.localOnboardingRecord.findMany({
      where: {
        sellerId: assignment.sellerId,
        programId: assignment.programId,
        branchId: branchId,
        brandProductId: { in: products.map((p) => p.id) },
      },
      select: {
        id: true,
        brandProductId: true,
        status: true,
        copies: {
          select: {
            id: true,
            copyRole: true,
            sampleSizeId: true,
            locationNodeId: true,
            location: {
              select: {
                name: true,
                locationId: true,
              },
            },
          },
        },
      },
    }),
    prisma.locationNode.findMany({
      where: { branchId, status: "active" },
      orderBy: [{ path: "asc" }, { name: "asc" }],
      select: { id: true, name: true, locationId: true, path: true, programId: true, parentId: true, nodeType: true, isPlacementEligible: true, depth: true },
    }),
    prisma.sampleSize.findMany({
      where: { branchId, status: "active" },
      orderBy: { label: "asc" },
      select: { id: true, label: true },
    }),
  ]);

  // Create lookup dictionary mapping product ID to the onboarding record details
  const onboardingMap = new Map<string, any>();
  onboardingRecords.forEach((rec) => {
    onboardingMap.set(rec.brandProductId.toString(), rec);
  });
  const onboardingObj = serialize(Object.fromEntries(onboardingMap.entries())) as any;
  const serializedLocations = serialize(locations) as any[];
  const serializedSizes = serialize(sizes) as any[];

  // Serialize objects for safer server component rendering (converting BigInts to string)
  const a = serialize(assignment) as any;
  const c = contract ? (serialize(contract) as any) : null;
  const pList = serialize(products) as any[];
  const pLine = serialize(pipeline) as any;

  // Group products by brand ID for easier rendering
  const productsByBrandId: Record<string, any[]> = {};
  pList.forEach((prod) => {
    if (!productsByBrandId[prod.brandId]) {
      productsByBrandId[prod.brandId] = [];
    }
    productsByBrandId[prod.brandId].push(prod);
  });

  // Filter active brand specific metrics
  const activeBrandProducts = activeBrand
    ? pList.filter((p) => p.brandId.toString() === activeBrand.id.toString())
    : [];
  const activeBrandOnboardedCount = activeBrand
    ? onboardingRecords.filter((rec) =>
        activeBrandProducts.some((p) => p.id.toString() === rec.brandProductId.toString())
      ).length
    : 0;

  // Date parsing and calculations
  let fitoutStr = "";
  let startStr = "";
  let endStr = "";
  let baseStartDate = "";
  let fitoutEnd = "";
  let isTodayInFitout = false;
  let isTodayInCollaboration = false;
  let fitoutDaysRemaining = 0;

  if (c) {
    fitoutStr = c.fitoutPeriod ? c.fitoutPeriod.replace(/\D/g, "") : "";
    startStr = c.contractStart ? c.contractStart.slice(0, 10) : "";
    endStr = c.contractEnd ? c.contractEnd.slice(0, 10) : "";
    baseStartDate = startStr && fitoutStr ? subtractDays(startStr, fitoutStr) : "";
    fitoutEnd = baseStartDate && fitoutStr ? subtractDays(startStr, "1") : "";

    const todayStr = new Date().toISOString().slice(0, 10);
    isTodayInFitout = !!(baseStartDate && fitoutEnd && todayStr >= baseStartDate && todayStr <= fitoutEnd);
    isTodayInCollaboration = !!(startStr && endStr && todayStr >= startStr && todayStr <= endStr);

    if (baseStartDate && fitoutEnd) {
      if (todayStr <= fitoutEnd) {
        const startCompare = todayStr < baseStartDate ? baseStartDate : todayStr;
        const date1 = new Date(startCompare + "T00:00:00Z");
        const date2 = new Date(fitoutEnd + "T00:00:00Z");
        const diffTime = date2.getTime() - date1.getTime();
        fitoutDaysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
      } else {
        fitoutDaysRemaining = 0;
      }
    }
  }

  const cardStyle = "bg-white/60 backdrop-blur-md rounded-2xl border border-slate-200 p-6 shadow-sm";

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
            {activeBrand && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs font-semibold text-indigo-700">
                Active Brand: <span className="font-bold">{activeBrand.name}</span>
              </span>
            )}
            {activeBrand && (activeBrand as any).brandCategories && (activeBrand as any).brandCategories.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700">
                Brand Categories: <span className="font-bold">{(activeBrand as any).brandCategories.map((bc: any) => bc.category.name).join(", ")}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Brand Tabs at the Top */}
      {sellerBrands.length > 1 && (
        <div className="flex flex-wrap border-b border-slate-200 gap-1 pb-1">
          {sellerBrands.map((sb) => {
            const active = sb.brand.id.toString() === activeBrandId?.toString();
            const cats = (sb.brand as any).brandCategories?.map((bc: any) => bc.category.name).join(", ");
            return (
              <Link
                key={sb.brand.id.toString()}
                href={`/ops/onboarding/task/${params.id}?brandId=${sb.brand.id.toString()}`}
                className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex flex-col items-start gap-1.5 ${
                  active
                    ? "border-slate-900 text-slate-900 bg-slate-50 font-bold scale-[1.01]"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{sb.brand.name}</span>
                  <span className="text-[10px] font-mono text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded font-bold">
                    {sb.brand.code}
                  </span>
                </div>
                {cats && (
                  <span className="text-[9px] text-slate-400 font-medium leading-none">
                    {cats}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}

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
        <details className="group space-y-3">
          <summary className="flex items-center justify-between cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden hover:opacity-85 transition-opacity py-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-base font-bold text-slate-800">Contract Schedules &amp; Timelines</h2>
              <div className="flex gap-2">
                {isTodayInFitout && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
                    In Fitout
                  </span>
                )}
                {isTodayInCollaboration && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active Collaboration
                  </span>
                )}
              </div>
              <div className="group-open:hidden flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-500 sm:border-l sm:border-slate-200 sm:pl-3">
                {baseStartDate && fitoutEnd && (
                  <span className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">Fitout Remaining:</span>
                    <span className="text-slate-700 font-mono text-[11px] bg-slate-100/80 px-1.5 py-0.5 rounded">
                      {fitoutDaysRemaining > 0 ? `${fitoutDaysRemaining} ${fitoutDaysRemaining === 1 ? "Day" : "Days"}` : "Ended"}
                    </span>
                  </span>
                )}
                {startStr && endStr && (
                  <span className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">Collab:</span>
                    <span className="text-slate-700 font-mono text-[11px] bg-slate-100/80 px-1.5 py-0.5 rounded">
                      {formatDMY(startStr)} to {formatDMY(endStr)}
                    </span>
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-800 transition-colors">
              <span className="group-open:hidden">Expand</span>
              <span className="hidden group-open:inline">Collapse</span>
              <svg className="w-4 h-4 transform group-open:rotate-180 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </summary>
          <div className="pt-1">
            <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-slate-200 shadow-sm p-0 overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
                {/* Left Part: Schedule details */}
                <div className="lg:col-span-8 p-6 space-y-6">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800 text-sm">Schedule Details</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Fitout Timeline Section */}
                    <div className="rounded border border-slate-200 p-4 space-y-4 bg-slate-50/30 flex flex-col justify-between">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="font-bold text-slate-700 text-xs uppercase tracking-wider">Fitout Period</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded">
                            {fitoutStr ? `${fitoutStr} Days` : "Not Set"}
                          </span>
                          {baseStartDate && fitoutEnd && (
                            <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${
                              fitoutDaysRemaining > 0
                                ? "text-sky-700 bg-sky-50 border-sky-200"
                                : "text-rose-700 bg-rose-50 border-rose-200"
                            }`}>
                              {fitoutDaysRemaining > 0 ? `${fitoutDaysRemaining} Days Left` : "Ended"}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Start Date</div>
                          <div className="text-slate-900 font-bold mt-1 text-sm">{baseStartDate ? formatDMY(baseStartDate) : "—"}</div>
                        </div>
                        
                        <div className="flex items-center justify-center text-slate-300">
                          <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </div>
                        
                        <div className="flex-1 text-right">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">End Date</div>
                          <div className="text-slate-900 font-bold mt-1 text-sm">{fitoutEnd ? formatDMY(fitoutEnd) : "—"}</div>
                        </div>
                      </div>
                      
                      {fitoutStr && formatDaysToYMD(fitoutStr) && (
                        <div className="text-[10px] text-slate-500 font-medium italic pt-1 border-t border-slate-100/60">
                          ({formatDaysToYMD(fitoutStr)} equivalent)
                        </div>
                      )}
                    </div>

                    {/* Collaboration Timeline Section */}
                    <div className="rounded border border-slate-200 p-4 space-y-4 bg-slate-50/30 flex flex-col justify-between">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="font-bold text-slate-700 text-xs uppercase tracking-wider">Collaboration Tenure</span>
                        <span className="font-mono text-xs font-bold text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded">
                          {c.collaborationTenure ? `${c.collaborationTenure.replace(/\D/g, "")} Days` : "Not Set"}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Start Date</div>
                          <div className="text-slate-900 font-bold mt-1 text-sm">{startStr ? formatDMY(startStr) : "—"}</div>
                        </div>
                        
                        <div className="flex items-center justify-center text-slate-300">
                          <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </div>
                        
                        <div className="flex-1 text-right">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">End Date</div>
                          <div className="text-slate-900 font-bold mt-1 text-sm">{endStr ? formatDMY(endStr) : "—"}</div>
                        </div>
                      </div>
                      
                      {c.collaborationTenure && formatDaysToYMD(c.collaborationTenure) && (
                        <div className="text-[10px] text-slate-500 font-medium italic pt-1 border-t border-slate-100/60">
                          ({formatDaysToYMD(c.collaborationTenure)} equivalent)
                        </div>
                      )}
                    </div>
                  </div>

                  {c.remarks && (
                    <div className="mt-5 pt-4 border-t border-slate-200 text-xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                        Timeline Notes &amp; History
                      </span>
                      <div className="bg-slate-50/50 rounded border border-slate-200 p-3 text-slate-650 font-mono leading-relaxed whitespace-pre-line max-h-[150px] overflow-y-auto">
                        {c.remarks}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Part: Extend Fitout Form */}
                <div className="lg:col-span-4 p-6 bg-slate-50/30 flex flex-col justify-between">
                  <ExtendFitoutForm
                    assignmentId={a.id}
                    currentFitoutDays={fitoutStr ? Number(fitoutStr) : 0}
                  />
                </div>
              </div>
            </div>
          </div>
        </details>
      )}

      {/* Onboarding Pipeline Tracker & Interactive forms */}
      {activeBrand && (
        <OnboardingPipelineForm
          key={activeBrand.id.toString()}
          assignmentId={a.id}
          pipeline={pLine}
          brands={[serialize(activeBrand) as any]}
        />
      )}

      {/* SKU Onboarding Checklist Card */}
      <SkuOnboardingChecklist
        assignmentId={a.id.toString()}
        sellerId={a.sellerId}
        programId={a.programId}
        programName={a.program.name}
        brands={activeBrand ? [serialize(activeBrand) as any] : []}
        productsByBrandId={productsByBrandId}
        onboardingMap={onboardingObj}
        isExec={isExec}
        totalProductsCount={activeBrandProducts.length}
        onboardedCount={activeBrandOnboardedCount}
        locations={serializedLocations}
        sizes={serializedSizes}
      />
    </div>
  );
}

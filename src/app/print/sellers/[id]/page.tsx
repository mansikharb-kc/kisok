import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";
import PrintButton from "@/components/ops/PrintButton";

export const dynamic = "force-dynamic";

export default async function PrintSellerPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasRole(session.roles, "ONB_LEAD")) redirect("/dashboard");

  const roleEntry = session.roles.find((r) => r.code === "ONB_LEAD" && r.branchId);
  const branchId = roleEntry?.branchId ? BigInt(roleEntry.branchId) : null;
  if (!branchId) redirect("/dashboard");

  const sellerId = BigInt(params.id);

  const seller = await prisma.seller.findUnique({
    where: { id: sellerId },
    include: {
      sellerBrands: { include: { brand: { select: { name: true, code: true } } } },
      contracts: { include: { program: { select: { name: true } } } },
      assignments: { include: { exec: { select: { fullName: true, email: true } } } },
      branch: { select: { name: true } },
    },
  });

  if (!seller) notFound();
  if (seller.branchId !== branchId) redirect("/dashboard");

  const s = serialize(seller) as any;

  return (
    <div className="min-h-screen bg-white/60 backdrop-blur-md text-slate-900 p-8 max-w-4xl mx-auto">
      {/* Control bar: Hidden when printing */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-8 print:hidden">
        <Link
          href={`/ops/sellers/${s.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          ‹ Back to Seller Profile
        </Link>
        <PrintButton />
      </div>

      {/* Contract / Profile Document */}
      <div className="space-y-8">
        {/* Document Header */}
        <div className="flex justify-between items-start border-b-2 border-slate-950 pb-6">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Governance Record</div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">SELLER CONTRACT PROFILE</h1>
            <p className="text-sm text-slate-500 mt-1">KC IMS — Inventory Management System</p>
          </div>
          <div className="text-right">
            <div className="font-mono text-sm font-semibold text-slate-700 bg-slate-100 px-3 py-1 rounded">
              CODE: {s.sellerCode}
            </div>
            <div className="text-xs text-slate-400 mt-1">Generated: {new Date().toLocaleDateString()}</div>
          </div>
        </div>

        {/* Section 1: Basic Profile Details */}
        <div>
          <h2 className="text-lg font-bold text-slate-950 uppercase border-b border-slate-200 pb-2 mb-4">
            1. General Information
          </h2>
          <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Seller Name</div>
              <div className="font-medium text-slate-800 mt-1">{s.name}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Membership ID</div>
              <div className="font-medium text-slate-800 mt-1">{s.membershipId ?? "Not Assigned"}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Branch Location</div>
              <div className="font-medium text-slate-800 mt-1">{s.branch.name}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Status</div>
              <div className="mt-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                  {s.status.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Associated Brands */}
        <div>
          <h2 className="text-lg font-bold text-slate-950 uppercase border-b border-slate-200 pb-2 mb-4">
            2. Associated Brands
          </h2>
          {s.sellerBrands.length === 0 ? (
            <p className="text-sm text-slate-400">No brands associated with this seller.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {s.sellerBrands.map((sb: any) => (
                <span
                  key={sb.brand.code}
                  className="text-xs px-3 py-1 rounded bg-slate-100 border border-slate-200 text-slate-800 font-semibold"
                >
                  {sb.brand.name} ({sb.brand.code})
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Section 3: Program Contracts */}
        <div>
          <h2 className="text-lg font-bold text-slate-950 uppercase border-b border-slate-200 pb-2 mb-4">
            3. Program Contracts
          </h2>
          {s.contracts.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No active program contracts established.</p>
          ) : (
            <div className="space-y-4">
              {s.contracts.map((c: any) => (
                <div key={c.id} className="border border-slate-200 rounded p-4 space-y-3 bg-slate-50/50">
                  <div className="flex items-center justify-between border-b border-slate-150 pb-2">
                    <div className="font-bold text-slate-800">{c.program.name}</div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded border border-slate-300 bg-slate-100">
                      {c.verified ? "VERIFIED" : "VERIFICATION PENDING"}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-xs">
                    <div>
                      <div className="text-slate-400 font-semibold uppercase tracking-wider">Tenure</div>
                      <div className="text-slate-800 font-medium mt-0.5">{c.collaborationTenure ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 font-semibold uppercase tracking-wider">Fitout Period</div>
                      <div className="text-slate-800 font-medium mt-0.5">{c.fitoutPeriod ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 font-semibold uppercase tracking-wider">Start Date</div>
                      <div className="text-slate-800 font-medium mt-0.5">{c.contractStart ? c.contractStart.slice(0, 10) : "—"}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 font-semibold uppercase tracking-wider">End Date</div>
                      <div className="text-slate-800 font-medium mt-0.5">{c.contractEnd ? c.contractEnd.slice(0, 10) : "—"}</div>
                    </div>
                  </div>
                  {c.remarks && (
                    <div className="text-xs pt-2 border-t border-slate-100">
                      <div className="text-slate-400 font-semibold uppercase tracking-wider mb-0.5">Remarks</div>
                      <p className="text-slate-700">{c.remarks}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 4: Assigned Onboarding Executives */}
        <div>
          <h2 className="text-lg font-bold text-slate-950 uppercase border-b border-slate-200 pb-2 mb-4">
            4. Assigned Onboarding Executives
          </h2>
          {s.assignments.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No executives assigned to this seller.</p>
          ) : (
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-300 text-slate-500 font-semibold text-xs uppercase">
                  <th className="py-2">Name</th>
                  <th className="py-2">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {s.assignments.map((a: any) => (
                  <tr key={a.exec.email} className="text-slate-800">
                    <td className="py-2 font-medium">{a.exec.fullName}</td>
                    <td className="py-2 font-mono text-xs">{a.exec.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Signature Blocks */}
        <div className="pt-16 grid grid-cols-2 gap-12 text-center text-sm print:mt-24">
          <div>
            <div className="border-t border-slate-400 pt-2 font-medium text-slate-700">Onboarding Lead Signature</div>
            <div className="text-xs text-slate-400 mt-1">{session.name}</div>
          </div>
          <div>
            <div className="border-t border-slate-400 pt-2 font-medium text-slate-700">Seller Representative Signature</div>
            <div className="text-xs text-slate-400 mt-1">Authorized Signatory</div>
          </div>
        </div>
      </div>
    </div>
  );
}

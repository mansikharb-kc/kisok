import { prisma, serialize } from "@/lib/prisma";
import BrandsClient, { BrandRow } from "@/components/brands/BrandsClient";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  const session = await getSession();
  const readOnly = session ? !hasRole(session.roles, "HO_ADMIN") : true;
  const rows = await prisma.brand.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: {
      logo: { select: { url: true } },
      brandCategories: { include: { category: { select: { name: true } } } },
      _count: { select: { brandProducts: true, branchBrands: true, sellerBrands: true } },
    },
  });

  const brands: BrandRow[] = serialize(rows).map((b: any) => ({
    id: b.id,
    brandNo: b.brandNo,
    name: b.name,
    code: b.code,
    brandType: b.brandType,
    logoUrl: b.logo?.url ?? null,
    categories: b.brandCategories.map((bc: any) => bc.category.name),
    approvalStatus: b.approvalStatus,
    status: b.status,
    productCount: b._count.brandProducts,
    sellerCount: b._count.sellerBrands,
    branchCount: b._count.branchBrands,
    contactPerson: b.contactPerson,
    contactPersonDesignation: b.contactPersonDesignation,
    phoneCc: b.phoneCc,
    phone: b.phone,
    email: b.email,
    website: b.website,
    socialLinkedin: b.socialLinkedin,
    socialTwitter: b.socialTwitter,
    socialInstagram: b.socialInstagram,
    socialYoutube: b.socialYoutube,
    address: b.address,
    pincode: b.pincode,
    city: b.city,
    state: b.state,
    country: b.country,
    gstNumber: b.gstNumber,
    agreementDuration: b.agreementDuration,
    contractStart: b.contractStart ? String(b.contractStart).slice(0, 10) : null,
    contractEnd: b.contractEnd ? String(b.contractEnd).slice(0, 10) : null,
    description: b.description,
    contacts: b.contacts || null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Brands</h1>
        <p className="text-sm text-slate-500 mt-1">
          HO master. Each brand owns a SKU-keyed product catalog shared across sellers & branches. New brands need HO approval.
        </p>
      </div>
      <BrandsClient initial={brands} readOnly={readOnly} />
    </div>
  );
}

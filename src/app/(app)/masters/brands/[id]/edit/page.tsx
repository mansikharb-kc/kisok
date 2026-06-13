import { notFound } from "next/navigation";
import { prisma, serialize } from "@/lib/prisma";
import { FlatCat } from "@/lib/categoryTree";
import BrandForm, { BrandEdit } from "@/components/brands/BrandForm";

export const dynamic = "force-dynamic";

export default async function EditBrandPage({ params }: { params: { id: string } }) {
  let id: bigint;
  try {
    id = BigInt(params.id);
  } catch {
    notFound();
  }

  const [b, catRows] = await Promise.all([
    prisma.brand.findUnique({
      where: { id: id! },
      include: { logo: { select: { url: true } }, brandCategories: { select: { categoryId: true } } },
    }),
    prisma.category.findMany({ where: { status: "active" }, select: { id: true, name: true, parentId: true } }),
  ]);
  if (!b) notFound();

  const flat: FlatCat[] = serialize(catRows).map((c: any) => ({
    id: String(c.id),
    name: c.name,
    parentId: c.parentId ? String(c.parentId) : null,
  }));
  const s = serialize(b) as any;

  const brand: BrandEdit = {
    id: s.id,
    name: s.name,
    code: s.code,
    brandType: s.brandType,
    logoMediaId: s.logoMediaId,
    logoUrl: s.logo?.url ?? null,
    contactPerson: s.contactPerson,
    phoneCc: s.phoneCc,
    phone: s.phone,
    email: s.email,
    website: s.website,
    address: s.address,
    pincode: s.pincode,
    city: s.city,
    state: s.state,
    gstNumber: s.gstNumber,
    agreementDuration: s.agreementDuration,
    contractStart: s.contractStart ? String(s.contractStart).slice(0, 10) : null,
    description: s.description,
    categoryIds: s.brandCategories.map((bc: any) => String(bc.categoryId)),
  };

  return <BrandForm flat={flat} brand={brand} />;
}

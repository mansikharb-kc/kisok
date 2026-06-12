import { prisma, serialize } from "@/lib/prisma";
import { FlatCat } from "@/lib/categoryTree";
import BrandForm from "@/components/brands/BrandForm";

export const dynamic = "force-dynamic";

export default async function NewBrandPage() {
  const rows = await prisma.category.findMany({
    where: { status: "active" },
    select: { id: true, name: true, parentId: true },
  });
  const flat: FlatCat[] = serialize(rows);
  return <BrandForm flat={flat} />;
}

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { prisma, serialize } from "@/lib/prisma";
import { FlatCat } from "@/lib/categoryTree";
import BrandForm from "@/components/brands/BrandForm";

export const dynamic = "force-dynamic";

export default async function NewBrandPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasRole(session.roles, "HO_ADMIN", "ONB_LEAD")) redirect("/dashboard");

  const rows = await prisma.category.findMany({
    where: { status: "active" },
    select: { id: true, name: true, parentId: true },
  });
  const flat: FlatCat[] = serialize(rows);
  return <BrandForm flat={flat} />;
}

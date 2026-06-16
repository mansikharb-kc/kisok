import { redirect } from "next/navigation";
import { prisma, serialize } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import ArchivedClient, { ArchivedGroup } from "@/components/archived/ArchivedClient";

export const dynamic = "force-dynamic";

export default async function ArchivedPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasRole(session.roles, "HO_ADMIN")) redirect("/dashboard");

  const w = { status: "archived" };
  const [brands, attributes, categories, programs, sellers, sampleSizes] = await Promise.all([
    prisma.brand.findMany({ where: w, select: { id: true, name: true, code: true } }),
    prisma.attribute.findMany({ where: w, select: { id: true, name: true, code: true } }),
    prisma.category.findMany({ where: w, select: { id: true, name: true, code: true } }),
    prisma.program.findMany({ where: w, select: { id: true, name: true, code: true } }),
    prisma.seller.findMany({ where: w, select: { id: true, name: true, sellerCode: true } }),
    prisma.sampleSize.findMany({ where: w, select: { id: true, label: true } }),
  ]);

  const s = serialize;
  const groups: ArchivedGroup[] = [
    { entity: "brand", label: "Brands", items: s(brands).map((b: any) => ({ id: b.id, name: b.name, sub: b.code })) },
    { entity: "attribute", label: "Attributes", items: s(attributes).map((a: any) => ({ id: a.id, name: a.name, sub: a.code })) },
    { entity: "category", label: "Categories", items: s(categories).map((c: any) => ({ id: c.id, name: c.name, sub: c.code })) },
    { entity: "program", label: "Programs", items: s(programs).map((p: any) => ({ id: p.id, name: p.name, sub: p.code })) },
    { entity: "seller", label: "Sellers", items: s(sellers).map((x: any) => ({ id: x.id, name: x.name, sub: x.sellerCode })) },
    { entity: "sampleSize", label: "Sample Sizes", items: s(sampleSizes).map((x: any) => ({ id: x.id, name: x.label })) },
  ];

  return <ArchivedClient groups={groups} />;
}

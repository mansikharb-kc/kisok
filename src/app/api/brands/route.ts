import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { GSTIN_REGEX, brandPrefix, brandCodeBase } from "@/lib/brandMeta";

// Generate the next readable Brand ID for a type prefix, e.g. NAT-0001.
async function nextBrandNo(brandType?: string | null): Promise<string> {
  const prefix = brandPrefix(brandType);
  const existing = await prisma.brand.findMany({
    where: { brandNo: { startsWith: `${prefix}-` } },
    select: { brandNo: true },
  });
  let max = 0;
  for (const e of existing) {
    const n = parseInt((e.brandNo ?? "").split("-")[1] ?? "0", 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}

// Generate the next Brand Code from the name, e.g. Century -> CNRY-10 (number starts at 10, per base).
async function nextBrandCode(name: string): Promise<string> {
  const base = brandCodeBase(name);
  const existing = await prisma.brand.findMany({
    where: { code: { startsWith: `${base}-` } },
    select: { code: true },
  });
  let max = 9; // first one becomes 10
  for (const e of existing) {
    const n = parseInt(e.code.split("-")[1] ?? "0", 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `${base}-${max + 1}`;
}

const dateish = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable();

const createSchema = z.object({
  name: z.string().trim().min(1).max(150),
  // code is auto-generated from the name (CNRY-10 style); any client value is ignored.
  code: z.string().optional().nullable(),
  brandType: z.string().trim().max(40).optional().nullable(),
  logoMediaId: z.coerce.bigint().optional().nullable(),
  contactPerson: z.string().trim().max(150).optional().nullable(),
  contactPersonDesignation: z.string().trim().max(150).optional().nullable(),
  phoneCc: z.string().trim().max(8).optional().nullable(),
  phone: z.string().trim().max(20).optional().nullable(),
  email: z.string().trim().max(190).optional().nullable(),
  contacts: z.array(z.object({
    name: z.string().trim().max(150).optional().nullable(),
    designation: z.string().trim().max(150).optional().nullable(),
    phoneCc: z.string().trim().max(8).optional().nullable(),
    phone: z.string().trim().max(20).optional().nullable(),
    email: z.string().trim().max(190).optional().nullable()
  })).optional().nullable(),
  website: z.string().trim().max(255).optional().nullable(),
  socialLinkedin: z.string().trim().max(255).optional().nullable(),
  socialTwitter: z.string().trim().max(255).optional().nullable(),
  socialInstagram: z.string().trim().max(255).optional().nullable(),
  socialYoutube: z.string().trim().max(255).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  pincode: z.string().trim().max(20).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  state: z.string().trim().max(120).optional().nullable(),
  country: z.string().trim().max(120).optional().nullable(),
  gstNumber: z
    .string()
    .trim()
    .max(20)
    .optional()
    .nullable()
    .refine((v) => !v || GSTIN_REGEX.test(v.toUpperCase()), "Invalid GSTIN (must be a valid 15-char Indian GST number)"),
  agreementDuration: z.string().trim().max(40).optional().nullable(),
  contractStart: dateish,
  contractEnd: dateish,
  description: z.string().trim().max(2000).optional().nullable(),
  categoryIds: z.array(z.coerce.bigint()).optional(),
});

export const GET = handler(async () => {
  await requireRole("HO_ADMIN");
  const brands = await prisma.brand.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: { _count: { select: { brandProducts: true, branchBrands: true, sellerBrands: true, brandCategories: true } } },
  });
  return ok({ brands });
});

export const POST = handler(async (req: Request) => {
  const session = await requireRole("HO_ADMIN", "ONB_LEAD");
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  const { categoryIds, contractStart, contractEnd, code: _ignored, ...d } = parsed.data;

  // Sync contacts and root fields
  let syncedContacts = d.contacts;
  let rootContactPerson = d.contactPerson;
  let rootContactPersonDesignation = d.contactPersonDesignation;
  let rootPhoneCc = d.phoneCc;
  let rootPhone = d.phone;
  let rootEmail = d.email;

  if (syncedContacts && syncedContacts.length > 0) {
    const first = syncedContacts[0];
    rootContactPerson = first.name || null;
    rootContactPersonDesignation = first.designation || null;
    rootPhoneCc = first.phoneCc || null;
    rootPhone = first.phone || null;
    rootEmail = first.email || null;
  } else if (rootContactPerson || rootContactPersonDesignation || rootPhone || rootEmail) {
    syncedContacts = [
      {
        name: rootContactPerson || null,
        designation: rootContactPersonDesignation || null,
        phoneCc: rootPhoneCc || null,
        phone: rootPhone || null,
        email: rootEmail || null,
      },
    ];
  }

  const brandNo = await nextBrandNo(d.brandType);
  const code = await nextBrandCode(d.name);
  const brand = await prisma.$transaction(async (tx) => {
    const created = await tx.brand.create({
      data: {
        ...d,
        contactPerson: rootContactPerson,
        contactPersonDesignation: rootContactPersonDesignation,
        phoneCc: rootPhoneCc,
        phone: rootPhone,
        email: rootEmail,
        contacts: syncedContacts ? (syncedContacts as any) : null,
        brandNo,
        name: d.name,
        code,
        contractStart: contractStart ? new Date(contractStart) : null,
        contractEnd: contractEnd ? new Date(contractEnd) : null,
        approvalStatus: "approved",
        status: "active",
        createdByUserId: BigInt(session.uid),
        brandCategories: categoryIds?.length
          ? { create: [...new Set(categoryIds.map(String))].map((id) => ({ categoryId: BigInt(id) })) }
          : undefined,
      },
    });

    return created;
  });

  await writeAudit({
    actorUserId: session.uid,
    action: "brand.create",
    entityType: "Brand",
    entityId: brand.id,
    after: { name: brand.name, code: brand.code },
  });
  return ok({ brand }, { status: 201 });
});

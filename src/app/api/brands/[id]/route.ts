import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { GSTIN_REGEX } from "@/lib/brandMeta";

const dateish = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable();

const updateSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  code: z.string().trim().min(1).max(60).regex(/^[A-Za-z0-9_-]+$/).optional(),
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
  gstNumber: z.string().trim().max(20).optional().nullable().refine((v) => !v || GSTIN_REGEX.test(v.toUpperCase()), "Invalid GSTIN"),
  agreementDuration: z.string().trim().max(40).optional().nullable(),
  contractStart: dateish,
  contractEnd: dateish,
  description: z.string().trim().max(2000).optional().nullable(),
  categoryIds: z.array(z.coerce.bigint()).optional(),
  approvalStatus: z.enum(["draft", "approved", "rejected"]).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

function parseId(id: string): bigint | null {
  try {
    return BigInt(id);
  } catch {
    return null;
  }
}

export const GET = handler(async (_req: Request, ctx: { params: { id: string } }) => {
  await requireRole("HO_ADMIN", "BRANCH_ADMIN", "ONB_LEAD", "OB_EXEC", "CONSIGNMENT_USER");
  const id = parseId(ctx.params.id);
  if (id === null) return fail("Invalid id", 400);

  const b = await prisma.brand.findUnique({
    where: { id },
    include: {
      logo: { select: { url: true } },
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
  });
  if (!b) return fail("Brand not found", 404);
  return ok({ brand: b });
});

export const PATCH = handler(async (req: Request, ctx: { params: { id: string } }) => {
  const session = await requireRole("HO_ADMIN", "BRANCH_ADMIN", "ONB_LEAD");
  const id = parseId(ctx.params.id);
  if (id === null) return fail("Invalid id", 400);

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const isHO = session.roles.some((r) => r.code === "HO_ADMIN");
  if (!isHO) {
    // approval status is HO-only
    if (parsed.data.approvalStatus !== undefined) {
      return fail("Only HO Admins can change approval status", 403);
    }
    // The brand's creator (e.g. the Onboarding Lead who added it during seller
    // onboarding) may edit all detail fields of their own brand. Others may edit
    // only the category mapping.
    const existing = await prisma.brand.findUnique({ where: { id }, select: { createdByUserId: true } });
    if (!existing) return fail("Brand not found", 404);
    const isCreator = existing.createdByUserId != null && String(existing.createdByUserId) === String(session.uid);
    if (!isCreator) {
      const keys = Object.keys(parsed.data).filter(
        (k) => parsed.data[k as keyof typeof parsed.data] !== undefined
      );
      const nonCategoryKeys = keys.filter((k) => k !== "categoryIds");
      if (nonCategoryKeys.length > 0) {
        return fail("Only HO Admins or the brand's creator can edit brand details", 403);
      }
    }
  }

  const { categoryIds, contractStart, contractEnd, ...data } = parsed.data;

  // Sync contacts and root fields during patch
  if (data.contacts !== undefined) {
    if (data.contacts && data.contacts.length > 0) {
      const first = data.contacts[0];
      data.contactPerson = first.name || null;
      data.contactPersonDesignation = first.designation || null;
      data.phoneCc = first.phoneCc || null;
      data.phone = first.phone || null;
      data.email = first.email || null;
    } else {
      data.contactPerson = null;
      data.contactPersonDesignation = null;
      data.phoneCc = null;
      data.phone = null;
      data.email = null;
    }
  } else {
    const hasAnyRootContactField = 
      data.contactPerson !== undefined ||
      data.contactPersonDesignation !== undefined ||
      data.phoneCc !== undefined ||
      data.phone !== undefined ||
      data.email !== undefined;

    if (hasAnyRootContactField) {
      const existingBrand = await prisma.brand.findUnique({
        where: { id },
        select: {
          contactPerson: true,
          contactPersonDesignation: true,
          phoneCc: true,
          phone: true,
          email: true,
          contacts: true,
        }
      });
      if (existingBrand) {
        const mergedPerson = data.contactPerson !== undefined ? data.contactPerson : existingBrand.contactPerson;
        const mergedDesignation = data.contactPersonDesignation !== undefined ? data.contactPersonDesignation : existingBrand.contactPersonDesignation;
        const mergedPhoneCc = data.phoneCc !== undefined ? data.phoneCc : existingBrand.phoneCc;
        const mergedPhone = data.phone !== undefined ? data.phone : existingBrand.phone;
        const mergedEmail = data.email !== undefined ? data.email : existingBrand.email;

        let existingContacts = Array.isArray(existingBrand.contacts) ? (existingBrand.contacts as any[]) : [];
        if (existingContacts.length === 0) {
          existingContacts = [
            {
              name: mergedPerson || null,
              designation: mergedDesignation || null,
              phoneCc: mergedPhoneCc || null,
              phone: mergedPhone || null,
              email: mergedEmail || null,
            }
          ];
        } else {
          existingContacts[0] = {
            ...existingContacts[0],
            name: mergedPerson || null,
            designation: mergedDesignation || null,
            phoneCc: mergedPhoneCc || null,
            phone: mergedPhone || null,
            email: mergedEmail || null,
          };
        }
        data.contacts = existingContacts;
      }
    }
  }

  const brand = await prisma.$transaction(async (tx) => {
    const updated = await tx.brand.update({
      where: { id },
      data: {
        ...data,
        contacts: data.contacts !== undefined ? (data.contacts as any) : undefined,
        // Approving a brand also makes it active (e.g. an Onboarding Lead's brand
        // created as pending_approval becomes usable once HO approves).
        ...(data.approvalStatus === "approved" && data.status === undefined ? { status: "active" } : {}),
        ...(contractStart !== undefined ? { contractStart: contractStart ? new Date(contractStart) : null } : {}),
        ...(contractEnd !== undefined ? { contractEnd: contractEnd ? new Date(contractEnd) : null } : {}),
      },
    });
    if (categoryIds) {
      await tx.brandCategory.deleteMany({ where: { brandId: id } });
      const uniq = [...new Set(categoryIds.map(String))];
      if (uniq.length) {
        await tx.brandCategory.createMany({ data: uniq.map((cid) => ({ brandId: id, categoryId: BigInt(cid) })) });
      }
    }
    return updated;
  });

  const action = data.approvalStatus
    ? `brand.${data.approvalStatus === "approved" ? "approve" : data.approvalStatus === "rejected" ? "reject" : "update"}`
    : "brand.update";
  await writeAudit({
    actorUserId: session.uid,
    action,
    entityType: "Brand",
    entityId: brand.id,
    after: { name: brand.name, approvalStatus: brand.approvalStatus, status: brand.status },
  });
  return ok({ brand });
});

export const DELETE = handler(async (_req: Request, ctx: { params: { id: string } }) => {
  const session = await requireRole("HO_ADMIN");
  const id = parseId(ctx.params.id);
  if (id === null) return fail("Invalid id", 400);

  const target = await prisma.brand.findUnique({ where: { id } });
  if (!target) return fail("Brand not found", 404);

  const [products, sellers, branches] = await Promise.all([
    prisma.brandProduct.count({ where: { brandId: id } }),
    prisma.sellerBrand.count({ where: { brandId: id } }),
    prisma.branchBrand.count({ where: { brandId: id } }),
  ]);

  if (products > 0 || sellers > 0 || branches > 0) {
    const brand = await prisma.brand.update({ where: { id }, data: { status: "inactive" } });
    await writeAudit({ actorUserId: session.uid, action: "brand.deactivate", entityType: "Brand", entityId: id });
    return ok({ brand, deactivated: true, reason: "in use — deactivated instead of deleted" });
  }

  await prisma.brand.delete({ where: { id } });
  await writeAudit({ actorUserId: session.uid, action: "brand.delete", entityType: "Brand", entityId: id });
  return ok({ deleted: true });
});

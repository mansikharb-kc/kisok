const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sellerId = 2n;
  const seller = await prisma.seller.findUnique({
    where: { id: sellerId },
    include: {
      sellerBrands: true,
      sellerCategories: true,
      contracts: true,
      assignments: true,
    }
  });

  console.log('Seller:', JSON.stringify(seller, (k, v) => typeof v === 'bigint' ? String(v) : v, 2));

  // Prepare payload like SellerForm.tsx does
  const payload = {
    name: seller.name,
    sellerCode: seller.sellerCode,
    membershipId: seller.membershipId,
    status: seller.status,
    memberType: seller.memberType,
    salesperson: seller.salesperson,
    spocName: seller.spocName,
    spocPhone: seller.spocPhone,
    spocEmail: seller.spocEmail,
    customFields: seller.customFields || {},
    brandIds: seller.sellerBrands.map(b => String(b.brandId)),
    categoryIds: seller.sellerCategories.map(c => String(c.categoryId)),
    contracts: seller.contracts.map(c => ({
      programId: String(c.programId),
      collaborationTenure: c.collaborationTenure,
      fitoutPeriod: c.fitoutPeriod,
      contractStart: c.contractStart ? c.contractStart.toISOString().slice(0, 10) : null,
      contractEnd: c.contractEnd ? c.contractEnd.toISOString().slice(0, 10) : null,
      verified: c.verified,
      remarks: c.remarks,
      obExecUserId: null, // or appropriate
      contractMediaId: c.contractMediaId ? String(c.contractMediaId) : null,
      customFields: c.customFields || {},
    }))
  };

  console.log('Sending payload:', JSON.stringify(payload, null, 2));

  // Perform the same validation schemas
  const { z } = require('zod');
  const dateish = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable();
  const updateSchema = z.object({
    name: z.string().trim().min(1).max(150).optional(),
    sellerCode: z.string().trim().min(1).max(60).regex(/^[A-Za-z0-9_-]+$/).optional(),
    membershipId: z.string().trim().max(60).optional().nullable(),
    memberType: z.string().trim().max(40).optional().nullable(),
    salesperson: z.string().trim().max(120).optional().nullable(),
    spocName: z.string().trim().max(120).optional().nullable(),
    spocPhone: z.string().trim().max(30).optional().nullable(),
    spocEmail: z.string().trim().max(150).optional().nullable(),
    customFields: z.record(z.string(), z.any()).optional().nullable(),
    status: z.enum(["active", "retired", "archived"]).optional(),
    brandIds: z.array(z.coerce.bigint()).optional(),
    categoryIds: z.array(z.coerce.bigint()).optional(),
    contracts: z.array(z.object({
      programId: z.coerce.bigint(),
      collaborationTenure: z.string().trim().max(60).optional().nullable(),
      fitoutPeriod: z.string().trim().max(60).optional().nullable(),
      contractStart: dateish,
      contractEnd: dateish,
      verified: z.boolean().optional().default(false),
      remarks: z.string().trim().max(500).optional().nullable(),
      obExecUserId: z.coerce.bigint().optional().nullable(),
      contractMediaId: z.coerce.bigint().optional().nullable(),
      customFields: z.record(z.string(), z.any()).optional().nullable(),
    })).optional(),
  });

  const parsed = updateSchema.safeParse(payload);
  console.log('Validation parsed success:', parsed.success);
  if (!parsed.success) {
    console.error('Validation Error details:', parsed.error.format());
  }

  // Also simulate db update transaction
  if (parsed.success) {
    try {
      await prisma.$transaction(async (tx) => {
        const { brandIds, categoryIds, contracts, customFields, ...data } = parsed.data;
        const updated = await tx.seller.update({
          where: { id: sellerId },
          data: {
            ...data,
            customFields: customFields ?? undefined,
          }
        });
        console.log('DB Update Success:', updated.id);
      });
    } catch (e) {
      console.error('DB Update Error:', e);
    }
  }

  process.exit(0);
}

main().then(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

const s = (v) => JSON.stringify(v, (_, val) => typeof val === 'bigint' ? val.toString() : val, 2);

async function main() {
  console.log('=== Seeding Rack B2 in Block B ===');

  // 1. Get Block B
  const blockB = await db.locationNode.findFirst({ where: { name: 'Block B' } });
  if (!blockB) throw new Error('Block B not found');
  console.log('Found Block B:', blockB.id.toString());

  // 2. Get existing branch/program/sellers for reference
  const branch = await db.branch.findFirst();
  const program = await db.program.findFirst();
  const sellers = await db.seller.findMany({ take: 2 });
  console.log('Branch:', branch?.id?.toString(), '| Program:', program?.id?.toString());
  console.log('Sellers:', s(sellers.map(s => ({ id: s.id, name: s.name }))));

  // 3. Get brands
  const brands = await db.brand.findMany({ take: 5 });
  console.log('Brands:', s(brands.map(b => ({ id: b.id, name: b.name }))));

  // 4. Create Rack B2 under Block B
  const existingRackB2 = await db.locationNode.findFirst({ where: { name: 'Rack B2', parentId: blockB.id } });
  let rackB2 = existingRackB2;
  if (!existingRackB2) {
    rackB2 = await db.locationNode.create({
      data: {
        branchId: blockB.branchId,
        parentId: blockB.id,
        nodeType: 'RACK',
        name: 'Rack B2',
        code: 'WH-MAIN-BLK-B-RCK-2',
        depth: 2,
        isPlacementEligible: true,
        quantity: 4,
        isScreenMountable: true,
        status: 'active',
      },
    });
    console.log('Created Rack B2:', rackB2.id.toString());
  } else {
    console.log('Rack B2 already exists:', rackB2.id.toString());
  }

  // 5. Define 4 new products for Rack B2
  const newProducts = [
    {
      brandId: brands[0]?.id, // Nike
      sku: 'NIKE-JKT-004',
      name: 'Nike Windrunner Track Jacket',
      categoryId: 2n, // Men's Wear
      sellerIndex: 0,
      copyCode: 'COP-NIKE-004',
    },
    {
      brandId: brands[1]?.id, // Adidas
      sku: 'ADI-SWE-005',
      name: 'Adidas Classic Crew Sweatshirt',
      categoryId: 3n, // Tops
      sellerIndex: 1,
      copyCode: 'COP-ADI-005',
    },
    {
      brandId: brands[0]?.id, // Nike
      sku: 'NIKE-POL-006',
      name: 'Nike Dri-FIT Polo Shirt',
      categoryId: 4n, // Shirts
      sellerIndex: 0,
      copyCode: 'COP-NIKE-006',
    },
    {
      brandId: brands[1]?.id, // Adidas
      sku: 'ADI-VES-007',
      name: 'Adidas Sport Mesh Vest',
      categoryId: 5n, // Casual Shirts
      sellerIndex: 1,
      copyCode: 'COP-ADI-007',
    },
  ];

  for (const p of newProducts) {
    // Check if product already exists
    let product = await db.brandProduct.findFirst({ where: { sku: p.sku } });
    if (!product) {
      product = await db.brandProduct.create({
        data: {
          brandId: p.brandId,
          sku: p.sku,
          name: p.name,
          categoryId: p.categoryId,
          status: 'active',
        },
      });
      console.log('Created product:', product.name, '(id:', product.id.toString() + ')');
    } else {
      console.log('Product already exists:', product.name);
    }

    // Create local onboarding record
    let record = await db.localOnboardingRecord.findFirst({ where: { brandProductId: product.id } });
    if (!record) {
      const seller = sellers[p.sellerIndex] || sellers[0];
      record = await db.localOnboardingRecord.create({
        data: {
          brandProductId: product.id,
          sellerId: seller.id,
          branchId: branch.id,
          programId: program.id,
          status: 'completed',
        },
      });
      console.log('Created onboarding record:', record.id.toString());
    } else {
      console.log('Record already exists for product:', product.name);
    }

    // Create product copy placed in Rack B2
    const existingCopy = await db.productCopy.findFirst({ where: { instanceCode: p.copyCode } });
    if (!existingCopy) {
      const copy = await db.productCopy.create({
        data: {
          localRecordId: record.id,
          brandProductId: product.id,
          branchId: branch.id,
          sequenceNo: 1,
          instanceCode: p.copyCode,
          copyRole: 'COPY',
          locationNodeId: rackB2.id,
          availability: 'IN',
          status: 'active',
        },
      });
      console.log('Created copy:', copy.instanceCode, '→ Rack B2');
    } else {
      // Update copy to be in Rack B2 if needed
      if (existingCopy.locationNodeId?.toString() !== rackB2.id?.toString()) {
        await db.productCopy.update({ where: { id: existingCopy.id }, data: { locationNodeId: rackB2.id } });
      }
      console.log('Copy already exists:', p.copyCode);
    }
  }

  console.log('\n=== Done! Rack B2 seeded with 4 products ===');
  console.log('Rack B2 id:', rackB2.id.toString());

  // Verify
  const allRacks = await db.locationNode.findMany({ where: { parentId: blockB.id } });
  console.log('All racks in Block B:', s(allRacks.map(r => ({ id: r.id, name: r.name }))));

  const b2Copies = await db.productCopy.findMany({
    where: { locationNodeId: rackB2.id },
    include: { product: { select: { name: true, categoryId: true } } }
  });
  console.log('Copies in Rack B2:', s(b2Copies.map(c => ({ code: c.instanceCode, product: c.product?.name }))));
}

main().catch(console.error).finally(() => db.$disconnect());

const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

const s = (v) => JSON.stringify(v, (_, val) => typeof val === 'bigint' ? val.toString() : val, 2);

async function main() {
  console.log('=== Updating Rack B4 Categories ===');

  // 1. Create the new categories if they don't exist
  const newCats = [
    { id: 7n, name: 'Jeans', code: 'jeans', parentId: 4n, status: 'active' },
    { id: 8n, name: 'Shoes', code: 'shoes', parentId: 4n, status: 'active' },
    { id: 9n, name: 'Activewear', code: 'activewear', parentId: 4n, status: 'active' },
    { id: 10n, name: 'Accessories', code: 'accessories', parentId: 4n, status: 'active' }
  ];

  for (const cat of newCats) {
    const existing = await db.category.findUnique({ where: { id: cat.id } });
    if (!existing) {
      await db.category.create({ data: cat });
      console.log(`Created Category: ${cat.name}`);
    } else {
      console.log(`Category already exists: ${existing.name}`);
    }
  }

  // 2. Map of SKUs to category IDs in Rack B4
  const skuCategoryMap = {
    'B4-ITEM-001': 1n, // Apparel
    'B4-ITEM-002': 2n, // Men's Wear
    'B4-ITEM-003': 3n, // Tops
    'B4-ITEM-004': 4n, // Shirts
    'B4-ITEM-005': 5n, // Casual Shirts
    'B4-ITEM-006': 6n, // Formal Wear
    'B4-ITEM-007': 7n, // Jeans
    'B4-ITEM-008': 8n, // Shoes
    'B4-ITEM-009': 9n, // Activewear
    'B4-ITEM-010': 10n // Accessories
  };

  // 3. Update the products
  for (const [sku, catId] of Object.entries(skuCategoryMap)) {
    const product = await db.brandProduct.findFirst({ where: { sku } });
    if (product) {
      await db.brandProduct.update({
        where: { id: product.id },
        data: { 
          categoryId: catId,
          name: sku === 'B4-ITEM-007' ? 'Nike Jeans Spec 007'
              : sku === 'B4-ITEM-008' ? 'Adidas Shoes Spec 008'
              : sku === 'B4-ITEM-009' ? 'Nike Activewear Spec 009'
              : sku === 'B4-ITEM-010' ? 'Adidas Accessories Spec 010'
              : product.name
        }
      });
      console.log(`Updated product SKU: ${sku} to categoryId: ${catId}`);
    } else {
      console.log(`Product with SKU: ${sku} not found`);
    }
  }

  console.log('=== Update Done ===');
}

main().catch(console.error).finally(() => db.$disconnect());

const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const fs = require('fs');

async function main() {
  const s = await db.screen.findFirst({
    where: { token: 'scr-b' },
    include: { branch: { select: { name: true } }, racks: { select: { locationNodeId: true } } }
  });
  if (!s) {
    console.log('Screen not found');
    return;
  }
  const rackIds = s.racks.map(r => r.locationNodeId);
  const prods = await db.brandProduct.findMany({
    where: {
      status: 'active',
      copies: {
        some: {
          branchId: s.branchId,
          status: 'active'
        }
      }
    },
    include: {
      brand: { select: { id: true, name: true, code: true } },
      category: { select: { id: true, name: true } },
      copies: {
        where: {
          branchId: s.branchId,
          status: 'active'
        },
        include: {
          location: {
            include: {
              parent: {
                include: {
                  parent: {
                    include: {
                      parent: true
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  const products = prods.map(p => {
    const locations = p.copies.map(c => {
      const parts = [];
      let curr = c.location;
      while (curr) {
        if (curr.name) parts.unshift(curr.name);
        curr = curr.parent;
      }
      return parts.join(' › ');
    });
    return {
      id: p.id.toString(),
      name: p.name,
      sku: p.sku || '',
      brandId: p.brandId.toString(),
      brandName: p.brand.name,
      brandCode: p.brand.code || '',
      categoryId: p.categoryId ? p.categoryId.toString() : null,
      categoryName: p.category ? p.category.name : null,
      locations: [...new Set(locations)]
    };
  });

  fs.writeFileSync('c:/Users/LT13/Documents/antigravity-apps/Ims/prisma/scr_b_data.json', JSON.stringify({
    branchName: s.branch.name,
    products
  }, null, 2));
  console.log('Dumped products:', products.length);
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});

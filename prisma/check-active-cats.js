const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  const cats = await db.category.findMany({
    where: { status: 'active' },
    select: { id: true, name: true, parentId: true }
  });

  console.log('Total active categories in DB:', cats.length);

  // Group by parentId
  const childrenMap = {};
  for (const c of cats) {
    if (c.parentId) {
      const pid = c.parentId.toString();
      if (!childrenMap[pid]) childrenMap[pid] = [];
      childrenMap[pid].push(c);
    }
  }

  // Find all categories that actually have products directly assigned
  const prods = await db.brandProduct.findMany({
    where: { status: 'active' },
    select: { categoryId: true }
  });
  const directCatIds = new Set(prods.map(p => p.categoryId.toString()));
  console.log('Categories directly assigned to products:', directCatIds.size);

  // Let's see: for each category, count its total direct products
  const directProductCounts = {};
  for (const p of prods) {
    if (p.categoryId) {
      const cid = p.categoryId.toString();
      directProductCounts[cid] = (directProductCounts[cid] || 0) + 1;
    }
  }

  // Now, calculate recursively how many products are under each category
  const recursiveProductCounts = {};
  const memo = {};

  function getRecCount(catId) {
    if (memo[catId] !== undefined) return memo[catId];
    let count = directProductCounts[catId] || 0;
    const children = childrenMap[catId] || [];
    for (const child of children) {
      count += getRecCount(child.id.toString());
    }
    memo[catId] = count;
    return count;
  }

  for (const c of cats) {
    const cid = c.id.toString();
    recursiveProductCounts[cid] = getRecCount(cid);
  }

  // Let's filter categories that have recursive products > 0
  const activeCats = cats.filter(c => recursiveProductCounts[c.id.toString()] > 0);
  console.log('Categories with recursive productCount > 0:', activeCats.length);

  // Let's see if any active category has children that are also active categories!
  let activeCatsWithActiveChildren = 0;
  for (const c of activeCats) {
    const cid = c.id.toString();
    const children = childrenMap[cid] || [];
    const activeChildren = children.filter(child => recursiveProductCounts[child.id.toString()] > 0);
    if (activeChildren.length > 0) {
      activeCatsWithActiveChildren++;
      console.log(`Parent: "${c.name}" (id: ${cid}, recursive prods: ${recursiveProductCounts[cid]}) has active children:`, activeChildren.map(x => `"${x.name}" (id: ${x.id}, recursive prods: ${recursiveProductCounts[x.id.toString()]})`));
    }
  }
  console.log('Active categories with active children:', activeCatsWithActiveChildren);
}

main().catch(console.error).finally(() => db.$disconnect());

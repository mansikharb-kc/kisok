const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  console.log('=== Building category tree from slashed names ===');

  const categories = await db.category.findMany({
    where: { status: 'active' }
  });

  const catMap = new Map(); // name_lower -> cat
  for (const c of categories) {
    catMap.set(c.name.trim().toLowerCase(), c);
  }

  let updatedCount = 0;

  for (const c of categories) {
    const name = c.name.trim();
    if (name.includes('/')) {
      const parts = name.split('/').map(p => p.trim());
      // The parent name is everything except the last part
      const parentName = parts.slice(0, -1).join(' / ');
      
      let parentCat = catMap.get(parentName.toLowerCase());
      
      if (!parentCat) {
        // Create parent category if it doesn't exist
        const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        let code = slugify(parentName);
        const conflict = await db.category.findFirst({ where: { code } });
        if (conflict) code = code + '-' + Math.random().toString(36).slice(2, 6);

        parentCat = await db.category.create({
          data: {
            name: parentName,
            code,
            parentId: null,
            status: 'active'
          }
        });
        console.log(`Created parent category: "${parentName}"`);
        catMap.set(parentName.toLowerCase(), parentCat);
      }

      // Update parentId of the child category
      if (c.parentId === null || c.parentId.toString() !== parentCat.id.toString()) {
        await db.category.update({
          where: { id: c.id },
          data: { parentId: parentCat.id }
        });
        updatedCount++;
      }
    }
  }

  console.log(`✓ Updated ${updatedCount} categories with parentIds.`);
}

main().catch(console.error).finally(() => db.$disconnect());

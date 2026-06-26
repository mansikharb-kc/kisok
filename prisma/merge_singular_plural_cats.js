const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  const cats = await db.category.findMany();
  console.log(`Loaded ${cats.length} categories from DB`);

  // Helper to parse parent name just like page.tsx does:
  // e.g. "Wallpapers & Films" -> parent: "Wallpapers"
  function getParentName(name) {
    const ampIdx = name.indexOf(" & ");
    if (ampIdx !== -1) {
      return name.slice(0, ampIdx).trim();
    }
    return name.trim();
  }

  // Find duplicates where parent names differ only by ending 's'
  // e.g. "Wallpapers" vs "Wallpaper"
  const parentMap = new Map(); // normalized_name -> categoryObject
  const toRename = []; // { id: bigint, oldName: string, newName: string }

  for (const cat of cats) {
    const parent = getParentName(cat.name);
    const parentLower = parent.toLowerCase();

    // Check if we have a singular version (without 's') or plural version (with 's')
    let base = parentLower;
    if (parentLower.endsWith('s')) {
      base = parentLower.slice(0, -1);
    }

    if (parentMap.has(base)) {
      const match = parentMap.get(base);
      const matchParent = getParentName(match.name);
      
      // Determine which one is singular and which one is plural
      let singularParent = matchParent;
      let pluralParent = parent;
      let pluralCat = cat;

      if (matchParent.toLowerCase().endsWith('s') && !parent.toLowerCase().endsWith('s')) {
        singularParent = parent;
        pluralParent = matchParent;
        pluralCat = match;
      }

      // Rename the plural parent in the category name to match singular parent
      // e.g. rename "Wallpapers & Films" to "Wallpaper & Films"
      const newName = pluralCat.name.replace(pluralParent, singularParent);
      toRename.push({
        id: pluralCat.id,
        oldName: pluralCat.name,
        newName: newName
      });
      console.log(`Found duplicate parent: "${singularParent}" and "${pluralParent}". Will rename "${pluralCat.name}" -> "${newName}"`);
    } else {
      parentMap.set(base, cat);
    }
  }

  console.log(`\nRenaming ${toRename.length} categories...`);
  for (const item of toRename) {
    await db.category.update({
      where: { id: item.id },
      data: { name: item.newName }
    });
    console.log(`✓ Updated category ID ${item.id.toString()}: "${item.oldName}" -> "${item.newName}"`);
  }

  console.log('Done!');
}

main().catch(console.error).finally(() => db.$disconnect());

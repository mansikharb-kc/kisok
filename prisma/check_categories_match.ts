import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
const db = new PrismaClient();

const filePath = 'c:\\Users\\LT13\\Documents\\antigravity-apps\\Ims\\Master Odoo Data.xlsx';
const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data: any[] = XLSX.utils.sheet_to_json(sheet);

async function main() {
  const xlsxCats = new Set<string>();
  for (const row of data) {
    if (row['Product Category']) {
      xlsxCats.add(row['Product Category'].trim());
    }
  }

  console.log(`Total unique categories in Excel: ${xlsxCats.size}`);
  
  let foundCount = 0;
  let missingCats: string[] = [];
  
  for (const catName of xlsxCats) {
    const dbCat = await db.category.findFirst({
      where: { name: { equals: catName } }
    });
    if (dbCat) {
      foundCount++;
    } else {
      missingCats.push(catName);
    }
  }
  
  console.log(`Matching categories in DB: ${foundCount} / ${xlsxCats.size}`);
  console.log("Missing categories:", missingCats);
}

main().catch(console.error).finally(() => db.$disconnect());

import * as XLSX from 'xlsx';
import * as path from 'path';

const filePath = 'c:\\Users\\LT13\\Documents\\antigravity-apps\\Ims\\Master Odoo Data.xlsx';
const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data: any[] = XLSX.utils.sheet_to_json(sheet);

const blocks = new Set<string>();
for (const row of data) {
  const loc = String(row.Location || '').trim();
  if (!loc) continue;
  
  let block = '';
  if (loc.includes('.')) {
    block = loc.split('.')[0] || 'Unknown';
  } else if (loc.includes('/')) {
    block = loc.split('/')[0] || 'Unknown';
  } else {
    block = 'Other';
  }
  blocks.add(block);
}

console.log(`Total unique blocks: ${blocks.size}`);
console.log("Blocks:", Array.from(blocks));

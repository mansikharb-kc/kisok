import * as XLSX from 'xlsx';
import * as path from 'path';

const filePath = 'c:\\Users\\LT13\\Documents\\antigravity-apps\\Ims\\Master Odoo Data.xlsx';
const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data: any[] = XLSX.utils.sheet_to_json(sheet);

const formats = new Set<string>();
for (const row of data) {
  const loc = String(row.Location || '');
  if (!loc) continue;
  
  // Replace all digits with X
  const formatted = loc.replace(/\d+/g, 'X');
  formats.add(formatted);
}

console.log("Location formats found:");
console.log(Array.from(formats));

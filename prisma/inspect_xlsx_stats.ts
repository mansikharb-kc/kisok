import * as XLSX from 'xlsx';
import * as path from 'path';

const filePath = 'c:\\Users\\LT13\\Documents\\antigravity-apps\\Ims\\Master Odoo Data.xlsx';
const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data: any[] = XLSX.utils.sheet_to_json(sheet);

const brands = new Set<string>();
const categories = new Set<string>();
const locations = new Set<string>();

for (const row of data) {
  if (row.Brand) brands.add(row.Brand);
  if (row['Product Category']) categories.add(row['Product Category']);
  if (row.Location) locations.add(row.Location);
}

console.log(`Total Rows: ${data.length}`);
console.log(`Unique Brands (${brands.size}):`, Array.from(brands).slice(0, 30));
console.log(`Unique Categories (${categories.size}):`, Array.from(categories).slice(0, 30));
console.log(`Unique Locations (${locations.size}):`, Array.from(locations).slice(0, 30));

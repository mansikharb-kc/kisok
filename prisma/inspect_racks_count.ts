import * as XLSX from 'xlsx';
import * as path from 'path';

const filePath = 'c:\\Users\\LT13\\Documents\\antigravity-apps\\Ims\\Master Odoo Data.xlsx';
const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data: any[] = XLSX.utils.sheet_to_json(sheet);

const racks = new Set<string>();
for (const row of data) {
  const loc = String(row.Location || '').trim();
  if (!loc) continue;
  
  let block = '';
  let rack = '';
  
  if (loc.includes('.')) {
    const parts = loc.split('.');
    block = parts[0] || 'Unknown';
    rack = parts[1] || 'Unknown';
  } else if (loc.includes('/')) {
    const parts = loc.split('/');
    block = parts.slice(0, 2).join('/') || 'Unknown';
    rack = parts[2] || 'Unknown';
  } else {
    block = 'Other';
    rack = loc;
  }
  
  racks.add(`${block} -> ${rack}`);
}

console.log(`Total unique Block -> Rack combinations: ${racks.size}`);
console.log("Sample combinations:", Array.from(racks).slice(0, 30));

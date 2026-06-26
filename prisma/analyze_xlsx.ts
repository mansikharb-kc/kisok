import * as XLSX from 'xlsx';
import * as path from 'path';

const root = 'c:\\Users\\LT13\\Documents\\antigravity-apps\\Ims';

function analyzeFile(filename: string) {
  const filePath = path.join(root, filename);
  console.log(`\n=== Analyzing ${filename} ===`);
  const workbook = XLSX.readFile(filePath);
  console.log('Sheet Names:', workbook.SheetNames);
  
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`Sheet: ${sheetName}`);
    console.log(`Total rows: ${data.length}`);
    if (data.length > 0) {
      console.log('Headers:', data[0]);
    }
    if (data.length > 1) {
      console.log('Sample Row 1:', data[1]);
    }
    if (data.length > 2) {
      console.log('Sample Row 2:', data[2]);
    }
  }
}

analyzeFile('Catagory Wise Odoo Sheet .xlsx');
analyzeFile('Master Odoo Data.xlsx');

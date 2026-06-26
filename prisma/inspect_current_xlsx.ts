import * as XLSX from 'xlsx';

const filePath = 'C:\\Users\\LT13\\Downloads\\Product (product.template) (2).xlsx';
try {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data: any[] = XLSX.utils.sheet_to_json(sheet);

  const polymerRows = data.filter(row => {
    const cat = String(row['Product Category'] || '').toLowerCase();
    return cat.includes('polymer') || cat.includes('composite');
  });

  const carpetRows = data.filter(row => {
    const cat = String(row['Product Category'] || '').toLowerCase();
    return cat.includes('carpet');
  });

  console.log(`\n--- EXCEL CATEGORY COUNT ---`);
  console.log(`Polymer Composite (contains 'polymer' or 'composite'): ${polymerRows.length}`);
  if (polymerRows.length > 0) {
    console.log(`Sample categories found:`, [...new Set(polymerRows.map(r => r['Product Category']))]);
  }
  console.log(`Carpets (contains 'carpet'): ${carpetRows.length}`);
  if (carpetRows.length > 0) {
    console.log(`Sample categories found:`, [...new Set(carpetRows.map(r => r['Product Category']))]);
  }
} catch (e) {
  console.error("Error reading file:", e);
}

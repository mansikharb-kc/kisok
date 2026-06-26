const xlsx = require('xlsx');
const wb = xlsx.readFile('C:\\Users\\LT13\\Downloads\\Product (product.template) (2).xlsx');
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet);

const sampleRows = rows.filter(r => 
  (r.Name && r.Name.includes('Defining Future')) || 
  (r.Name && r.Name.includes('Into Your World')) ||
  (r.Name && r.Name.includes('Keep Your Loved Ones')) ||
  (r.Name && r.Name.includes('Vol 2.1'))
);

console.log(JSON.stringify(sampleRows, null, 2));

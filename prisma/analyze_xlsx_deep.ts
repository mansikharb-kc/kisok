import * as XLSX from 'xlsx';
import * as path from 'path';

const filePath = 'c:\\Users\\LT13\\Documents\\antigravity-apps\\Ims\\Catagory Wise Odoo Sheet .xlsx';
const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet);
console.log("Catagory Wise Odoo Sheet - First 20 items:");
console.log(data.slice(0, 20));

const filePathMaster = 'c:\\Users\\LT13\\Documents\\antigravity-apps\\Ims\\Master Odoo Data.xlsx';
const workbookMaster = XLSX.readFile(filePathMaster);
const sheetMaster = workbookMaster.Sheets[workbookMaster.SheetNames[0]];
const dataMaster = XLSX.utils.sheet_to_json(sheetMaster);
console.log("Master Odoo Data - First 20 items:");
console.log(dataMaster.slice(0, 20));

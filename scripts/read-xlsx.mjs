import xlsx from "xlsx";

const path = process.argv[2];
if (!path) {
  console.error("usage: node read-xlsx.mjs <path>");
  process.exit(1);
}

const wb = xlsx.readFile(path);
console.log("=== WORKBOOK ===");
console.log("Sheets:", wb.SheetNames.length);
console.log(wb.SheetNames.map((n, i) => `  ${i + 1}. ${n}`).join("\n"));

for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: "" });
  console.log(`\n\n========== SHEET: "${name}" ==========`);
  console.log(`Rows: ${rows.length}`);
  if (rows.length === 0) continue;
  console.log("Header:", JSON.stringify(rows[0]));
  const sample = rows.slice(1, 13);
  sample.forEach((r, i) => console.log(`  [${i + 1}]`, JSON.stringify(r)));
  if (rows.length > 13) console.log(`  … (${rows.length - 13} more rows)`);
}

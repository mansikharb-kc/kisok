import xlsx from "xlsx";

const path = process.argv[2];
const wb = xlsx.readFile(path);

// Accurate row counts for every sheet (non-empty rows)
console.log("=== ROW COUNTS (non-empty) ===");
for (const name of wb.SheetNames) {
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "" });
  const nonEmpty = rows.filter((r) => r.some((c) => c !== "" && c != null));
  console.log(`  ${name}: ${nonEmpty.length} rows`);
}

const focus = process.argv.slice(3);
for (const name of focus) {
  const ws = wb.Sheets[name];
  if (!ws) { console.log(`\n!! sheet not found: ${name}`); continue; }
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: "" }).filter((r) => r.some((c) => c !== "" && c != null));
  console.log(`\n\n========== ${name} (${rows.length}) ==========`);
  rows.slice(0, 30).forEach((r, i) => console.log(`  [${i}]`, JSON.stringify(r)));
}

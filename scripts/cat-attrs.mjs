import xlsx from "xlsx";
const wb = xlsx.readFile(process.argv[2]);

function rows(sheet) {
  return xlsx.utils.sheet_to_json(wb.Sheets[sheet], { defval: "" });
}

// Group attributes by category
const map = rows("Cat_Attribute_Map");
const byCat = new Map();
for (const r of map) {
  const cat = r["Category"];
  if (!cat) continue;
  if (!byCat.has(cat)) byCat.set(cat, { path: r["Category Path"], domain: r["Domain"], attrs: [] });
  byCat.get(cat).attrs.push({
    name: r["Attribute Display Name"] || r["Attribute"],
    type: r["Type"],
    section: r["Section"],
    required: r["Is Required"] ? "REQ" : "opt",
    searchable: r["Is Searchable"] ? "search" : "",
    unit: r["UoM Code"] || "",
  });
}

console.log(`Cat_Attribute_Map rows: ${map.length} | distinct categories: ${byCat.size}\n`);
for (const [cat, info] of byCat) {
  console.log(`\n### ${cat}  (${info.domain})  ${info.path}`);
  console.log(`   ${info.attrs.length} attributes:`);
  for (const a of info.attrs) {
    console.log(`   • ${a.name}  [${a.type}${a.unit ? ", " + a.unit : ""}]  (${a.section}) ${a.required}${a.searchable ? " · " + a.searchable : ""}`);
  }
}

// Section groups per category
const sg = rows("Cat_Section_Group_Map");
const sgByCat = new Map();
for (const r of sg) {
  const cat = r["Category"];
  if (!cat) continue;
  if (!sgByCat.has(cat)) sgByCat.set(cat, []);
  sgByCat.get(cat).push(`${r["Section Group"]}${r["Is Required"] ? "*" : ""}`);
}
console.log(`\n\n=== SECTION GROUPS per category (Cat_Section_Group_Map: ${sg.length} rows, ${sgByCat.size} cats) ===`);
let i = 0;
for (const [cat, groups] of sgByCat) {
  if (i++ >= 8) { console.log(`   … +${sgByCat.size - 8} more categories`); break; }
  console.log(`  ${cat}: ${groups.join(", ")}`);
}

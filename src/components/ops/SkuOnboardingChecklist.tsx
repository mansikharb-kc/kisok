"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";

interface Brand {
  id: string;
  name: string;
  code: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  brandId: string;
  category: {
    id: string;
    name: string;
  };
}

interface SkuOnboardingChecklistProps {
  sellerId: string;
  programId: string;
  programName: string;
  brands: Brand[];
  productsByBrandId: Record<string, Product[]>;
  onboardingMap: Record<string, string>;
  isExec: boolean;
  totalProductsCount: number;
  onboardedCount: number;
}

export default function SkuOnboardingChecklist({
  sellerId,
  programId,
  programName,
  brands,
  productsByBrandId,
  onboardingMap,
  isExec,
  totalProductsCount,
  onboardedCount,
}: SkuOnboardingChecklistProps) {
  const [activeBrandId, setActiveBrandId] = useState<string>(brands[0]?.id ?? "");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");

  const activeBrand = brands.find((b) => b.id === activeBrandId) ?? brands[0];
  const activeProducts = activeBrand ? (productsByBrandId[activeBrand.id] ?? []) : [];

  function handleExportTemplate() {
    if (!activeBrand) return;
    const headers = [["Product Name", "SKU", "Category Code"]];
    const sampleData = [
      ["Kohler Veil Faucet", "K-VEIL-101", "faucets"],
      ["Kohler Moxie Shower", "K-SHW-202", "faucets"],
    ];
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...sampleData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Onboarding Template");
    XLSX.writeFile(wb, `${activeBrand.name}_onboarding_template.xlsx`);
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportStatus("Reading file...");

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<any>(sheet);

        if (rows.length === 0) {
          alert("The uploaded file has no product rows.");
          setImporting(false);
          return;
        }

        setImportStatus(`Processing ${rows.length} rows...`);
        let successCount = 0;
        let skipCount = 0;
        let failCount = 0;

        for (const row of rows) {
          const name = row["Product Name"] || row["name"];
          const skuVal = row["SKU"] || row["sku"];
          const categoryCode = row["Category Code"] || row["category_code"] || row["category"];

          if (!name || !skuVal || !categoryCode) {
            failCount++;
            continue;
          }

          try {
            // 1. Fetch category by code from onboarding options Mode B
            const catRes = await fetch(`/api/onboarding/options?q=${encodeURIComponent(categoryCode.toString().trim())}`);
            const catData = await catRes.json();
            const matchingCat = catData.categories?.find(
              (c: any) => c.name.toLowerCase() === categoryCode.toString().trim().toLowerCase() ||
                          (c.code && c.code.toLowerCase() === categoryCode.toString().trim().toLowerCase())
            );

            if (!matchingCat) {
              console.error(`Category not found for code: ${categoryCode}`);
              failCount++;
              continue;
            }

            // 2. Check if product master already exists
            const existRes = await fetch(`/api/brand-products?brandId=${activeBrand.id}&sku=${encodeURIComponent(skuVal.toString().trim())}`);
            const existData = await existRes.json();
            
            let brandProductId = "";
            if (existData.exists) {
              brandProductId = existData.id;
              skipCount++;
            } else {
              // Create brand product master
              const createProdRes = await fetch("/api/brand-products", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  brandId: activeBrand.id,
                  sku: skuVal.toString().trim(),
                  name: name.toString().trim(),
                  categoryId: matchingCat.id,
                  attributeValues: [],
                }),
              });
              if (!createProdRes.ok) {
                failCount++;
                continue;
              }
              const createdProd = await createProdRes.json();
              brandProductId = createdProd.id;
            }

            // 3. Create local onboarding record
            const onboardRes = await fetch("/api/onboarding", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                brandProductId,
                sellerId,
                programId,
              }),
            });
            if (onboardRes.ok) {
              successCount++;
            } else {
              failCount++;
            }
          } catch (err) {
            console.error("Error onboarding row:", row, err);
            failCount++;
          }
        }

        alert(`Import complete!\nSuccess: ${successCount}\nMaster product reused: ${skipCount}\nFailed: ${failCount}`);
        window.location.reload();
      } catch (err) {
        alert("Failed to parse Excel file.");
      } finally {
        setImporting(false);
        setImportStatus("");
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
  }

  const cardStyle = "bg-white/60 backdrop-blur-md rounded-2xl border border-slate-200 p-6 shadow-sm";

  return (
    <details className="group space-y-3" open>
      <summary className="flex items-center justify-between cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden hover:opacity-85 transition-opacity py-1">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold text-slate-800">SKU Onboarding Checklist</h2>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
              Total SKUs: {totalProductsCount}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              Onboarded: {onboardedCount}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-800 transition-colors">
          <span className="group-open:hidden">Expand</span>
          <span className="hidden group-open:inline">Collapse</span>
          <svg className="w-4 h-4 transform group-open:rotate-180 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </summary>

      <div className={cardStyle}>
        <div className="mb-5 pb-3 border-b border-slate-100">
          <p className="text-xs text-slate-500">
            Verify which products under the seller's brands are onboarded in the "{programName}" program.
          </p>
        </div>

      {brands.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-350 bg-slate-50/50 p-8 text-center text-sm text-slate-400">
          No brands are currently associated with this seller.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Top Brand Tabs - Rendered only when there are multiple brands */}
          {brands.length > 1 && (
            <div className="flex flex-wrap border-b border-slate-200 gap-1 mb-2">
              {brands.map((b) => {
                const count = productsByBrandId[b.id]?.length ?? 0;
                const active = b.id === activeBrandId;

                return (
                  <button
                    key={b.id}
                    onClick={() => setActiveBrandId(b.id)}
                    className={`px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                      active
                        ? "border-brand-600 text-brand-650 bg-brand-50/10 font-bold scale-[1.01]"
                        : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span>{b.name}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                        active ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Active Brand Information (rendered for single brand or selected tab) */}
          {activeBrand && (
            <div className="border border-slate-150 rounded-xl overflow-hidden bg-white/40">
              <div className="bg-slate-50/70 border-b border-slate-150 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center gap-1.5 rounded bg-slate-200 border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-400 cursor-not-allowed"
                  >
                    Fetch ML
                  </button>
                  {isExec && (
                    <Link
                      href={`/ops/onboarding/new?sellerId=${sellerId}&programId=${programId}&brandId=${activeBrand.id}`}
                      className="inline-flex items-center gap-1.5 rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition shadow-sm"
                    >
                      Add
                    </Link>
                  )}
                  {isExec && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={importing}
                      className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm disabled:opacity-50"
                    >
                      {importing ? importStatus : "Import"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleExportTemplate}
                    className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
                  >
                    Export Template
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImportFile}
                    accept=".xlsx, .xls, .csv"
                    className="hidden"
                  />
                </div>
                <span className="text-[11px] font-semibold text-slate-500 font-mono bg-white border border-slate-200 px-2 py-0.5 rounded">
                  {activeProducts.length} SKU{activeProducts.length !== 1 ? "s" : ""}
                </span>
              </div>

              {activeProducts.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 italic">
                  No active products found under this brand.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-150 bg-slate-50/40 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="px-4 py-3 font-semibold">Product</th>
                        <th className="px-4 py-3 font-semibold">SKU</th>
                        <th className="px-4 py-3 font-semibold text-right">Available on KC</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeProducts.map((p) => {
                        const status = onboardingMap[p.id];
                        const isOnboarded = !!status;

                        return (
                          <tr
                            key={p.id}
                            className="hover:bg-slate-50/20 transition-colors"
                          >
                            <td className="px-4 py-3.5">
                              <div className="font-semibold text-slate-800 text-sm">{p.name}</div>
                              <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                                Category: <span className="text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded font-medium">{p.category.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 font-mono text-slate-500 font-medium">
                              {p.sku}
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <div className="inline-flex items-center justify-end gap-2">
                                {isOnboarded ? (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked
                                      readOnly
                                      className="rounded border-emerald-300 h-4 w-4 text-emerald-600 focus:ring-emerald-500 bg-emerald-50 cursor-default"
                                    />
                                    <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-150">
                                      Onboarded ({status})
                                    </span>
                                  </div>
                                ) : isExec ? (
                                  <Link
                                    href={`/ops/onboarding/new?sellerId=${sellerId}&programId=${programId}&brandId=${activeBrand.id}&categoryId=${p.category.id}&sku=${encodeURIComponent(p.sku)}`}
                                    className="flex items-center gap-2 group hover:opacity-85 transition-opacity"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={false}
                                      readOnly
                                      className="rounded border-slate-300 h-4 w-4 text-brand-600 focus:ring-brand-500 cursor-pointer group-hover:border-slate-400"
                                    />
                                    <span className="inline-flex items-center gap-1 rounded bg-slate-105 text-slate-500 px-2 py-0.5 text-xs font-semibold group-hover:bg-slate-200 transition-colors">
                                      Pending (Click to Onboard)
                                    </span>
                                  </Link>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={false}
                                      disabled
                                      className="rounded border-slate-200 h-4 w-4 text-slate-400 focus:ring-slate-300 bg-slate-50 cursor-not-allowed"
                                    />
                                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 text-slate-400 px-2 py-0.5 text-xs font-semibold">
                                      Pending
                                    </span>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      </div>
    </details>
  );
}

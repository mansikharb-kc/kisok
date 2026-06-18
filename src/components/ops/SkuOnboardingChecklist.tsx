"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { X, Printer, MapPin, CheckCircle2 } from "lucide-react";

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

interface LocationOption {
  id: string;
  name: string;
  locationId: string | null;
  path: string | null;
  programId: string | null;
}

interface SizeOption {
  id: string;
  label: string;
}

interface SkuOnboardingChecklistProps {
  sellerId: string;
  programId: string;
  programName: string;
  brands: Brand[];
  productsByBrandId: Record<string, Product[]>;
  onboardingMap: Record<
    string,
    {
      id: string;
      brandProductId: string;
      status: string;
      copies: {
        id: string;
        copyRole: string;
        sampleSizeId: string | null;
        locationNodeId: string | null;
        location: { name: string; locationId: string | null } | null;
      }[];
    }
  >;
  isExec: boolean;
  totalProductsCount: number;
  onboardedCount: number;
  locations: LocationOption[];
  sizes: SizeOption[];
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
  locations = [],
  sizes = [],
}: SkuOnboardingChecklistProps) {
  const [activeBrandId, setActiveBrandId] = useState<string>(brands[0]?.id ?? "");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");

  // Local state to track number of units typed in the quantity column
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // Placement modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [targetProduct, setTargetProduct] = useState<Product | null>(null);
  const [targetRecord, setTargetRecord] = useState<any | null>(null);
  const [modalQuantity, setModalQuantity] = useState<number>(1);
  const [modalLocationNodeId, setModalLocationNodeId] = useState<string>("");
  const [modalRows, setModalRows] = useState<{ sampleSizeId: string; isMaster: boolean }[]>([]);
  const [modalError, setModalError] = useState("");
  const [modalBusy, setModalBusy] = useState(false);

  // Local state to track which product is currently onboarding directly
  const [onboardingBusyMap, setOnboardingBusyMap] = useState<Record<string, boolean>>({});

  const handleOnboardDirectly = async (productId: string) => {
    setOnboardingBusyMap((prev) => ({ ...prev, [productId]: true }));
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandProductId: productId,
          sellerId,
          programId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Onboarding failed");
        return;
      }
      window.location.reload();
    } catch {
      alert("Network error occurred during onboarding.");
    } finally {
      setOnboardingBusyMap((prev) => ({ ...prev, [productId]: false }));
    }
  };

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

            const existRes = await fetch(`/api/brand-products?brandId=${activeBrand.id}&sku=${encodeURIComponent(skuVal.toString().trim())}`);
            const existData = await existRes.json();
            
            let brandProductId = "";
            if (existData.exists) {
              brandProductId = existData.id;
              skipCount++;
            } else {
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

  const openAssignModal = (product: Product, record: any, qty: number) => {
    setTargetProduct(product);
    setTargetRecord(record);
    setModalQuantity(qty);
    setModalError("");

    const existingCopies = record?.copies ?? [];
    const firstCopyLocId = existingCopies[0]?.locationNodeId ?? "";
    setModalLocationNodeId(firstCopyLocId);

    const initialRows = [];
    for (let i = 0; i < qty; i++) {
      const existing = existingCopies[i];
      initialRows.push({
        sampleSizeId: existing?.sampleSizeId ?? "",
        isMaster: existing ? existing.copyRole === "MASTER" : i === 0,
      });
    }
    setModalRows(initialRows);
    setModalOpen(true);
  };

  const handleModalQuantityChange = (newQty: number) => {
    const qty = Math.max(1, Math.min(100, newQty));
    setModalQuantity(qty);
    setModalRows((prev) => {
      const copy = [...prev];
      if (qty > copy.length) {
        while (copy.length < qty) {
          copy.push({ sampleSizeId: "", isMaster: copy.length === 0 });
        }
      } else {
        copy.length = qty;
      }
      if (copy.length > 0 && !copy.some((r) => r.isMaster)) {
        copy[0].isMaster = true;
      }
      return copy;
    });
  };

  const setMaster = (idx: number) => {
    setModalRows((prev) =>
      prev.map((r, i) => ({ ...r, isMaster: i === idx }))
    );
  };

  const setSize = (idx: number, val: string) => {
    setModalRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, sampleSizeId: val } : r))
    );
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");
    if (!targetRecord) return;
    if (!modalLocationNodeId) return setModalError("Please select a placement location.");

    const masterCount = modalRows.filter((r) => r.isMaster).length;
    if (masterCount !== 1) return setModalError("Exactly one copy must be marked MASTER.");

    const payload = {
      localRecordId: targetRecord.id,
      locationNodeId: modalLocationNodeId,
      copies: modalRows.map((r) => ({
        sampleSizeId: r.sampleSizeId || undefined,
        role: r.isMaster ? "MASTER" : "SLAVE",
      })),
    };

    setModalBusy(true);
    try {
      const res = await fetch("/api/product-copies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setModalError(data.error || "Placement failed");
        return;
      }
      setModalOpen(false);
      window.location.reload();
    } catch {
      setModalError("Network error");
    } finally {
      setModalBusy(false);
    }
  };

  const L = "block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1";
  const I = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white/60 backdrop-blur-md";
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
                        <tr className="border-b border-slate-150 bg-slate-50/40 text-[10px] font-bold uppercase tracking-wider text-slate-450">
                          <th className="px-4 py-3 font-semibold">Product</th>
                          <th className="px-4 py-3 font-semibold">SKU</th>
                          <th className="px-4 py-3 font-semibold">Availability</th>
                          <th className="px-4 py-3 font-semibold">Quantity (Units)</th>
                          <th className="px-4 py-3 font-semibold">Location</th>
                          <th className="px-4 py-3 font-semibold">Placed Units &amp; QR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activeProducts.map((p) => {
                          const record = onboardingMap[p.id];
                          const isOnboarded = !!record;
                          const currentQty = quantities[p.id] ?? record?.copies?.length ?? 1;

                          return (
                            <tr
                              key={p.id}
                              className="hover:bg-slate-50/20 transition-colors align-top"
                            >
                              {/* Product Info */}
                              <td className="px-4 py-3.5">
                                <div className="font-bold text-slate-800 text-sm leading-tight">{p.name}</div>
                                <div className="text-[10px] text-slate-400 font-medium mt-1">
                                  Category: <span className="text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-medium">{p.category.name}</span>
                                </div>
                              </td>

                              {/* SKU */}
                              <td className="px-4 py-3.5 font-mono text-slate-500 font-bold">
                                {p.sku}
                              </td>

                              {/* Onboarding Availability */}
                              <td className="px-4 py-3.5">
                                <div className="inline-flex items-center gap-1.5">
                                  {isOnboarded ? (
                                    <div className="flex items-center gap-1.5">
                                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                      <span className="inline-flex items-center gap-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-150 px-2 py-0.5 text-xs font-semibold">
                                        Onboarded
                                      </span>
                                    </div>
                                  ) : isExec ? (
                                    <button
                                      type="button"
                                      onClick={() => handleOnboardDirectly(p.id)}
                                      disabled={onboardingBusyMap[p.id]}
                                      className="inline-flex items-center gap-1.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-750 px-2.5 py-1 text-xs font-bold hover:bg-indigo-100 disabled:opacity-60 transition shadow-xs"
                                    >
                                      {onboardingBusyMap[p.id] ? "Onboarding…" : "Onboard Product"}
                                    </button>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 text-slate-400 px-2 py-0.5 text-xs font-semibold">
                                      Pending
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Quantity */}
                              <td className="px-4 py-3.5">
                                {isOnboarded ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      min={1}
                                      max={50}
                                      value={currentQty}
                                      onChange={(e) => {
                                        const val = Math.max(1, parseInt(e.target.value) || 1);
                                        setQuantities((prev) => ({ ...prev, [p.id]: val }));
                                      }}
                                      className="w-16 rounded-lg border border-slate-300 px-2.5 py-1 text-center font-bold text-slate-800 bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                                    />
                                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">pcs</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-350 font-bold">—</span>
                                )}
                              </td>

                              {/* Location Assigner */}
                              <td className="px-4 py-3.5">
                                {isOnboarded ? (
                                  <div className="space-y-1.5">
                                    <button
                                      type="button"
                                      onClick={() => openAssignModal(p, record, currentQty)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition shadow-xs"
                                    >
                                      <MapPin className="w-3.5 h-3.5" />
                                      <span>Assign Location</span>
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-slate-355 font-bold">—</span>
                                )}
                              </td>

                              {/* Placed Units & QR Info */}
                              <td className="px-4 py-3.5">
                                {isOnboarded ? (
                                  record.copies && record.copies.length > 0 ? (
                                    <div className="flex flex-col gap-1 max-w-[200px]">
                                      {record.copies.map((c) => (
                                        <div
                                          key={c.id}
                                          className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200/80 rounded-lg p-1.5 pl-2 shadow-2xs"
                                        >
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <span className={`px-1 rounded text-[8px] font-extrabold tracking-wide select-none ${
                                              c.copyRole === "MASTER" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"
                                            }`}>
                                              {c.copyRole}
                                            </span>
                                            <span className="text-[10px] text-slate-600 font-bold truncate" title={c.location?.name ?? "Stage Buffer"}>
                                              {c.location?.name ?? "Stage Buffer"}
                                            </span>
                                          </div>
                                          <a
                                            href={`/print/sticker/${c.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title="Print QR sticker & details"
                                            className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-250 text-slate-500 hover:text-slate-800 hover:bg-slate-100 bg-white shrink-0"
                                          >
                                            <Printer className="w-3 h-3" />
                                          </a>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 italic font-medium">No units placed yet</span>
                                  )
                                ) : (
                                  <span className="text-slate-350 font-bold">—</span>
                                )}
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

      {/* Assign Location Modal */}
      {modalOpen && targetProduct && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4">
          <form
            onSubmit={handleModalSubmit}
            className="mt-10 w-full max-w-2xl rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-md p-6 shadow-2xl space-y-6"
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">Assign Location &amp; Units</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Specify warehouse location and sample sizes for the units of {targetProduct.name}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {modalError && (
              <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 font-medium">
                {modalError}
              </div>
            )}

            <div className="space-y-4">
              {/* Product Info Block */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Product Name</span>
                  <span className="text-sm font-bold text-slate-800">{targetProduct.name}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">SKU</span>
                  <span className="text-sm font-mono font-bold text-slate-700">{targetProduct.sku}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Location Selection */}
                <div>
                  <label className={L}>Placement Location *</label>
                  <select
                    value={modalLocationNodeId}
                    onChange={(e) => setModalLocationNodeId(e.target.value)}
                    required
                    className={I}
                  >
                    <option value="">— Choose location —</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} {l.locationId ? `(${l.locationId})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quantity Sync */}
                <div>
                  <label className={L}>Number of Units</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={modalQuantity}
                    onChange={(e) => handleModalQuantityChange(parseInt(e.target.value || "1", 10))}
                    className={`${I} max-w-[140px] font-semibold text-slate-800`}
                  />
                </div>
              </div>

              {/* Per-unit configuration */}
              <div className="space-y-2">
                <span className={L}>Per-unit Configuration</span>
                <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100 bg-white">
                  <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <div className="col-span-1">#</div>
                    <div className="col-span-6">Sample Size</div>
                    <div className="col-span-5 text-right">Role</div>
                  </div>
                  {modalRows.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 px-4 py-3.5 items-center">
                      <div className="col-span-1 text-xs font-mono font-bold text-slate-500">{idx + 1}</div>
                      <div className="col-span-6">
                        <select
                          value={row.sampleSizeId}
                          onChange={(e) => setSize(idx, e.target.value)}
                          className="w-full rounded-lg border border-slate-350 px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                        >
                          <option value="">— No size —</option>
                          {sizes.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-5 flex items-center justify-end gap-3 select-none">
                        <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-650 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={row.isMaster}
                            onChange={() => setMaster(idx)}
                            className="rounded border-slate-350 text-brand-600 focus:ring-brand-500 h-4 w-4"
                          />
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-colors ${
                            row.isMaster ? "bg-brand-100 text-brand-800 font-extrabold" : "bg-slate-100 text-slate-400"
                          }`}>
                            MASTER
                          </span>
                        </label>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold select-none ${
                          !row.isMaster ? "bg-slate-200 text-slate-700 font-extrabold" : "bg-slate-50 text-slate-350"
                        }`}>
                          SLAVE
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-normal">
                Exactly one unit must be marked MASTER. If a master already exists for this product in your branch, saving will update role allocations accordingly.
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-150">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-slate-350 px-4 py-2 text-sm font-semibold hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={modalBusy}
                className="rounded-lg bg-brand-600 text-white px-5 py-2.5 text-sm font-bold hover:bg-brand-700 disabled:opacity-60 transition"
              >
                {modalBusy ? "Saving…" : "Save Placement"}
              </button>
            </div>
          </form>
        </div>
      )}
    </details>
  );
}

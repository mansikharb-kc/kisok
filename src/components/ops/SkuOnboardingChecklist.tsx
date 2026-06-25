"use client";

import { useState, useRef, useMemo } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { X, Printer, MapPin, CheckCircle2, Loader2, Image, Film, FileText, Download } from "lucide-react";

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
  parentId: string | null;
  nodeType: string;
  isPlacementEligible: boolean;
  depth: number;
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
  console.log("CHECKLIST PROPS: locations length:", locations.length, "programId:", programId);
  if (locations.length > 0) {
    console.log("first location node:", JSON.stringify(locations[0]));
    console.log("all locations:", JSON.stringify(locations.map(l => ({ id: l.id, name: l.name, nodeType: l.nodeType, depth: l.depth, parentId: l.parentId, programId: l.programId }))));
  }
  const [activeBrandId, setActiveBrandId] = useState<string>(brands[0]?.id ?? "");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");

  // Local state to track number of units typed in the quantity column
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // Toolbar filtering state
  const [filterEnabled, setFilterEnabled] = useState(false);
  const [filterType, setFilterType] = useState("onboarded");

  // Placement modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [targetProduct, setTargetProduct] = useState<Product | null>(null);
  const [targetRecord, setTargetRecord] = useState<any | null>(null);
  const [modalQuantity, setModalQuantity] = useState<number>(1);
  const [modalLocationNodeId, setModalLocationNodeId] = useState<string>("");
  const [selectedParentId, setSelectedParentId] = useState<string>("");
  const [selectedLevel2Id, setSelectedLevel2Id] = useState<string>("");
  const [selectedLevel3Id, setSelectedLevel3Id] = useState<string>("");
  const [modalRows, setModalRows] = useState<{ sampleSizeId: string; isMaster: boolean }[]>([]);
  const [modalError, setModalError] = useState("");
  const [modalBusy, setModalBusy] = useState(false);

  // Local state to track which product is currently onboarding directly
  const [onboardingBusyMap, setOnboardingBusyMap] = useState<Record<string, boolean>>({});

  // Export custom template modal state
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportCategoryQuery, setExportCategoryQuery] = useState("");
  const [exportCategories, setExportCategories] = useState<any[]>([]);
  const [selectedExportCategory, setSelectedExportCategory] = useState<any | null>(null);
  const [exportCategoryAttrs, setExportCategoryAttrs] = useState<any[]>([]);
  const [exportLoadingAttrs, setExportLoadingAttrs] = useState(false);
  const [dynamicBrandCategories, setDynamicBrandCategories] = useState<any[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  const loadDynamicCategories = async () => {
    if (!activeBrand) return;
    setLoadingCategories(true);
    try {
      const res = await fetch(`/api/onboarding/options?brandId=${activeBrand.id}&programId=${programId}&sellerId=${sellerId}`);
      if (!res.ok) throw new Error("Failed to load categories");
      const data = await res.json();
      setDynamicBrandCategories(data.categories ?? []);
      setExportCategories(data.categories ?? []);
    } catch (err) {
      console.error("Failed to load dynamic categories", err);
    } finally {
      setLoadingCategories(false);
    }
  };

  // Product details modal state
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsProductId, setDetailsProductId] = useState("");
  const [detailsProduct, setDetailsProduct] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Import result and error modal states
  const [importResult, setImportResult] = useState<{ success: number; reused: number; failed: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleSearchCategories = (q: string) => {
    setExportCategoryQuery(q);
    if (!q.trim()) {
      setExportCategories(dynamicBrandCategories);
      return;
    }
    const filtered = dynamicBrandCategories.filter((c: any) =>
      c.name.toLowerCase().includes(q.toLowerCase())
    );
    setExportCategories(filtered);
  };

  const handleSelectExportCategory = async (cat: any) => {
    // Categories are matched by NAME (no code). Just select it.
    setSelectedExportCategory(cat);
    setExportCategories([]);
    setExportCategoryQuery(cat.name);
    setExportLoadingAttrs(true);
    try {
      const res = await fetch(`/api/onboarding/options?categoryId=${cat.id}&programId=${programId}`);
      const data = await res.json();
      setExportCategoryAttrs(data.attributes ?? []);
    } catch (err) {
      console.error("Failed to load category attributes", err);
    } finally {
      setExportLoadingAttrs(false);
    }
  };

  function handleDownloadCustomTemplate() {
    if (!activeBrand || !selectedExportCategory) return;
    
    const headers = [
      "Product Name",
      "SKU",
      "Category Name",
      ...exportCategoryAttrs.map((a) => a.name),
      "Product Image URL",
      "Product Video URL",
      "Product PDF URL"
    ];
    
    const ws = XLSX.utils.aoa_to_sheet([[...headers]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Onboarding Template");
    XLSX.writeFile(wb, `${activeBrand.name}_${selectedExportCategory.name}_template.xlsx`);
    setExportModalOpen(false);
  }

  const openProductDetails = async (productId: string) => {
    setDetailsProductId(productId);
    setDetailsProduct(null);
    setDetailsModalOpen(true);
    setDetailsLoading(true);
    try {
      const res = await fetch(`/api/brand-products?id=${productId}`);
      if (!res.ok) throw new Error("Failed to load details");
      const data = await res.json();
      setDetailsProduct(data);
    } catch (err) {
      alert("Error loading product details.");
      setDetailsModalOpen(false);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleToggleOnboarding = async (productId: string, currentlyOnboarded: boolean) => {
    if (currentlyOnboarded) {
      const confirmOffboard = window.confirm(
        "Are you sure you want to offboard this product? This will delete all placed unit copies and locations."
      );
      if (!confirmOffboard) return;
    }

    setOnboardingBusyMap((prev) => ({ ...prev, [productId]: true }));
    try {
      const res = await fetch("/api/onboarding", {
        method: currentlyOnboarded ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandProductId: productId,
          sellerId,
          programId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || `${currentlyOnboarded ? "Offboarding" : "Onboarding"} failed`);
        return;
      }
      window.location.reload();
    } catch {
      alert(`Network error occurred during ${currentlyOnboarded ? "offboarding" : "onboarding"}.`);
    } finally {
      setOnboardingBusyMap((prev) => ({ ...prev, [productId]: false }));
    }
  };

  const activeBrand = brands.find((b) => b.id === activeBrandId) ?? brands[0];
  const activeProducts = activeBrand ? (productsByBrandId[activeBrand.id] ?? []) : [];

  const brandCategories = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    activeProducts.forEach((p) => {
      if (p.category) {
        map.set(p.category.id, p.category);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [activeProducts]);
  const onboardedCountForActiveBrand = activeProducts.filter((p) => onboardingMap[p.id]).length;

  const filteredProducts = activeProducts.filter((p) => {
    if (!filterEnabled) return true;
    const record = onboardingMap[p.id];
    const isOnboarded = !!record;
    const hasCopies = record?.copies && record.copies.length > 0;
    if (filterType === "onboarded") return isOnboarded;
    if (filterType === "not_onboarded") return !isOnboarded;
    if (filterType === "location_assigned") return isOnboarded && hasCopies;
    if (filterType === "location_pending") return isOnboarded && !hasCopies;
    if (filterType === "select_all") return true;
    return true;
  });

  // Helper to trace if a location node belongs to the current program (either directly or via ancestors)
  const isNodeInProgram = (n: LocationOption) => {
    if (n.programId?.toString() === programId.toString()) return true;
    if (n.path) {
      const parts = n.path.split("/").filter(Boolean);
      return parts.some((parentId) => {
        const parent = locations.find((loc) => loc.id === parentId);
        return parent?.programId?.toString() === programId.toString();
      });
    }
    return false;
  };

  // Level 1 parent options (Warehouses or Blocks) that belong to the active program.
  // We filter to get the top-most BLOCKs or WAREHOUSEs (depth 1 or depth 0 with no BLOCK children)
  const level1Options = locations
    .filter((n) => (n.nodeType === "BLOCK" || n.nodeType === "WAREHOUSE") && isNodeInProgram(n))
    .filter(
      (n) => n.depth === 1 || (n.depth === 0 && !locations.some((child) => child.parentId === n.id && child.nodeType === "BLOCK"))
    )
    .map((n) => {
      // Add warehouse prefix to Block names for clarity
      if (n.nodeType === "BLOCK" && n.parentId) {
        const grandparent = locations.find((p) => p.id === n.parentId);
        if (grandparent) {
          return { ...n, name: `${grandparent.name} › ${n.name}` };
        }
      }
      return n;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // Level 2 options: immediate children of selectedParentId
  const level2Options = [];
  if (selectedParentId) {
    const children = locations.filter((n) => n.parentId === selectedParentId && isNodeInProgram(n));
    level2Options.push(...children);
  }

  // Level 3 options: immediate children of selectedLevel2Id
  const level3Options = [];
  if (selectedLevel2Id) {
    const children = locations.filter((n) => n.parentId === selectedLevel2Id && isNodeInProgram(n));
    level3Options.push(...children);
  }

  function handleExportTemplate() {
    if (!activeBrand) return;
    const headers = [["Product Name", "SKU", "Category Name"]];
    const sampleData = [
      ["Kohler Veil Faucet", "K-VEIL-101", "Faucets"],
      ["Kohler Moxie Shower", "K-SHW-202", "Faucets"],
    ];
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...sampleData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Onboarding Template");
    XLSX.writeFile(wb, `${activeBrand.name}_onboarding_template.xlsx`);
  }

  function handleExportReviewList() {
    if (!activeBrand) return;
    const headers = [
      [
        "Product Name",
        "SKU",
        "Category",
        "Available in KC (Onboarded)",
        "Quantity (Units)",
        "Placement Status",
        "Locations Assigned"
      ]
    ];

    const dataRows = filteredProducts.map((p) => {
      const record = onboardingMap[p.id];
      const isOnboarded = !!record;
      const currentQty = quantities[p.id] ?? record?.copies?.length ?? 1;
      const hasCopies = record?.copies && record.copies.length > 0;
      
      let statusStr = "Not Onboarded";
      if (isOnboarded) {
        statusStr = hasCopies ? "Placed (Location Assigned)" : "Pending Placement";
      }

      const locationsStr = record?.copies
        ? record.copies.map((c: any) => c.location?.name ?? "Stage Buffer").join(", ")
        : "—";

      return [
        p.name,
        p.sku,
        p.category.name,
        isOnboarded ? "Yes" : "No",
        isOnboarded ? currentQty : 0,
        statusStr,
        locationsStr
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([...headers, ...dataRows]);
    
    // Auto-fit column widths
    const maxCols = headers[0].length;
    const wscols = [];
    for (let c = 0; c < maxCols; c++) {
      let maxLen = headers[0][c].length;
      for (let r = 0; r < dataRows.length; r++) {
        const val = String(dataRows[r][c] || "");
        if (val.length > maxLen) maxLen = val.length;
      }
      wscols.push({ wch: maxLen + 3 });
    }
    ws["!cols"] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Filtered Product List");
    XLSX.writeFile(wb, `${activeBrand.name}_filtered_product_list.xlsx`);
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
          setImportError("The uploaded file contains no product rows to import.");
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
          const categoryName = row["Category Name"] || row["Category Code"] || row["category_name"] || row["category"];

          if (!name || !skuVal || !categoryName) {
            failCount++;
            continue;
          }

          try {
            const catRes = await fetch(`/api/onboarding/options?q=${encodeURIComponent(categoryName.toString().trim())}`);
            const catData = await catRes.json();
            const matchingCat = catData.categories?.find(
              (c: any) => c.name.toLowerCase() === categoryName.toString().trim().toLowerCase()
            );

            if (!matchingCat) {
              console.error(`Category not found for name: ${categoryName}`);
              failCount++;
              continue;
            }

            // Load attributes to match columns
            const attrsRes = await fetch(`/api/onboarding/options?categoryId=${matchingCat.id}&programId=${programId}`);
            const attrsData = await attrsRes.json();
            const catAttrs: any[] = attrsData.attributes ?? [];

            const attributeValues = catAttrs.map((a) => {
              const excelValue = row[a.name] ?? row[a.code];
              if (excelValue === undefined || excelValue === null) return null;
              
              const rawStr = String(excelValue).trim();
              if (!rawStr) return null;
              
              if (a.dataType === "number") {
                return { attributeId: a.id, valueNumber: Number(rawStr) };
              } else if (a.dataType === "boolean") {
                return { attributeId: a.id, valueBool: rawStr.toLowerCase() === "true" || rawStr === "1" || rawStr.toLowerCase() === "yes" };
              } else if (a.dataType === "date") {
                return { attributeId: a.id, valueDate: rawStr };
              } else if (a.dataType === "enum") {
                const opt = a.options.find((o: any) => o.value.toLowerCase() === rawStr.toLowerCase());
                return { attributeId: a.id, optionId: opt ? opt.id : null };
              } else {
                return { attributeId: a.id, valueText: rawStr };
              }
            }).filter(Boolean);

            const imageUrlVal = row["Product Image URL"] || row["Image URL"] || row["Image"] || row["imageUrl"];
            const videoUrlVal = row["Product Video URL"] || row["Video URL"] || row["Video"] || row["videoUrl"];
            const pdfUrlVal = row["Product PDF URL"] || row["PDF URL"] || row["PDF"] || row["pdfUrl"];

            const mediaUrls = {
              image: imageUrlVal ? String(imageUrlVal).trim() : null,
              video: videoUrlVal ? String(videoUrlVal).trim() : null,
              pdf: pdfUrlVal ? String(pdfUrlVal).trim() : null,
            };

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
                  attributeValues,
                  mediaUrls,
                }),
              });
              if (!createProdRes.ok) {
                failCount++;
                continue;
              }
              const createdProd = await createProdRes.json();
              brandProductId = createdProd.id;
              successCount++;
            }
          } catch (err) {
            console.error("Error onboarding row:", row, err);
            failCount++;
          }
        }

        setImportResult({
          success: successCount,
          reused: skipCount,
          failed: failCount
        });
      } catch (err) {
        setImportError("Failed to parse the Excel file structure. Please check headers and data columns.");
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

    if (firstCopyLocId) {
      const node = locations.find((l) => l.id.toString() === firstCopyLocId.toString());
      if (node) {
        const ancestorIds = node.path ? node.path.split("/").filter(Boolean) : [];
        const ancestors = locations.filter((loc) => ancestorIds.includes(loc.id));
        const blockAncestor = ancestors.find((loc) => loc.nodeType === "BLOCK");
        const warehouseAncestor = ancestors.find((loc) => loc.nodeType === "WAREHOUSE");
        const zoneNode = blockAncestor || warehouseAncestor || ancestors[0];
        
        if (zoneNode) {
          setSelectedParentId(zoneNode.id);
          
          const descendants = [
            ...ancestors.filter((n) => Number(n.depth) > Number(zoneNode.depth)),
            node
          ].sort((a, b) => Number(a.depth) - Number(b.depth));
          
          const uniqueDescendants = descendants.filter(
            (n, index, self) => self.findIndex((t) => t.id === n.id) === index && n.id !== zoneNode.id
          );
          
          if (uniqueDescendants[0]) {
            setSelectedLevel2Id(uniqueDescendants[0].id);
          } else {
            setSelectedLevel2Id(node.id);
          }
          
          if (uniqueDescendants[1]) {
            setSelectedLevel3Id(uniqueDescendants[1].id);
          } else {
            setSelectedLevel3Id("");
          }
        } else {
          setSelectedParentId("direct");
          setSelectedLevel2Id("");
          setSelectedLevel3Id("");
        }
      } else {
        setSelectedParentId("direct");
        setSelectedLevel2Id("");
        setSelectedLevel3Id("");
      }
    } else {
      setSelectedParentId("");
      setSelectedLevel2Id("");
      setSelectedLevel3Id("");
    }

    const initialRows = [];
    for (let i = 0; i < qty; i++) {
      const existing = existingCopies[i];
      initialRows.push({
        sampleSizeId: existing?.sampleSizeId ?? "",
        isMaster: existing ? existing.copyRole === "UNIQUE" : i === 0,
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
    
    const finalLocationId = selectedLevel3Id || selectedLevel2Id || selectedParentId;
    if (!finalLocationId) return setModalError("Please select a placement location.");

    const masterCount = modalRows.filter((r) => r.isMaster).length;
    if (masterCount !== 1) return setModalError("Exactly one copy must be marked UNIQUE.");

    const payload = {
      localRecordId: targetRecord.id,
      locationNodeId: finalLocationId,
      copies: modalRows.map((r) => ({
        sampleSizeId: r.sampleSizeId || undefined,
        role: r.isMaster ? "UNIQUE" : "COPY",
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
                  {/* Left: Filter control */}
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="checkbox"
                      id="toolbarFilterCheckbox"
                      checked={filterEnabled}
                      onChange={(e) => setFilterEnabled(e.target.checked)}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-4 w-4 cursor-pointer accent-brand-600"
                    />
                    <label htmlFor="toolbarFilterCheckbox" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                      Select
                    </label>
                    {filterEnabled && (
                      <>
                        <select
                          value={filterType}
                          onChange={(e) => setFilterType(e.target.value)}
                          className="rounded-lg border border-slate-300 px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-semibold cursor-pointer"
                        >
                          <option value="onboarded">Onboarded</option>
                          <option value="not_onboarded">Not Onboarded</option>
                          <option value="location_assigned">Location Assigned</option>
                          <option value="location_pending">Location Pending</option>
                          <option value="select_all">Select All</option>
                        </select>
                        <span className="text-[11px] font-bold text-slate-500 ml-1 shrink-0">
                          ({filteredProducts.filter((p) => onboardingMap[p.id]).length} of {filteredProducts.length} selected)
                        </span>
                        <button
                          type="button"
                          onClick={handleExportReviewList}
                          className="inline-flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 transition shadow-sm"
                        >
                          Download Product List
                        </button>
                      </>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
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
                      onClick={() => {
                        setExportModalOpen(true);
                        loadDynamicCategories();
                      }}
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
                      style={{ display: "none" }}
                    />
                  </div>
                </div>

                {filteredProducts.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 italic">
                    {activeProducts.length === 0
                      ? "No active products found under this brand."
                      : "No products matching the selected filter under this brand."}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-150 bg-slate-50/40 text-[10px] font-bold uppercase tracking-wider text-slate-450">
                          <th className="px-4 py-3 font-semibold">Product</th>
                          <th className="px-4 py-3 font-semibold">SKU</th>
                          <th className="px-4 py-3 font-semibold">
                            <div className="flex items-center gap-1.5">
                              {isExec && (
                                <input
                                  type="checkbox"
                                  checked={filteredProducts.length > 0 && filteredProducts.every((p) => onboardingMap[p.id])}
                                  onChange={async (e) => {
                                    const checked = e.target.checked;
                                    const productsToToggle = filteredProducts.filter((p) => !!onboardingMap[p.id] !== checked);
                                    if (productsToToggle.length === 0) return;

                                    setOnboardingBusyMap((prev) => {
                                      const next = { ...prev };
                                      productsToToggle.forEach((p) => { next[p.id] = true; });
                                      return next;
                                    });

                                    try {
                                      await Promise.all(
                                        productsToToggle.map((p) =>
                                          fetch("/api/onboarding", {
                                            method: checked ? "POST" : "DELETE",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({
                                              brandProductId: p.id,
                                              sellerId,
                                              programId,
                                            }),
                                          })
                                        )
                                      );
                                      window.location.reload();
                                    } catch (err) {
                                      alert("Batch update failed");
                                    } finally {
                                      setOnboardingBusyMap((prev) => {
                                        const next = { ...prev };
                                        productsToToggle.forEach((p) => { next[p.id] = false; });
                                        return next;
                                      });
                                    }
                                  }}
                                  className="rounded border-slate-350 h-4 w-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                                />
                              )}
                              <span>Available in KC</span>
                            </div>
                          </th>
                          <th className="px-4 py-3 font-semibold">Quantity (Units)</th>
                          <th className="px-4 py-3 font-semibold">Location</th>
                          <th className="px-4 py-3 font-semibold">Placed Units &amp; QR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredProducts.map((p) => {
                          const record = onboardingMap[p.id];
                          const isOnboarded = !!record;
                          const currentQty = quantities[p.id] ?? record?.copies?.length ?? 1;

                          return (
                            <tr
                              key={p.id}
                              onClick={() => openProductDetails(p.id)}
                              className={`hover:bg-slate-50/45 transition-colors align-top cursor-pointer ${
                                isOnboarded ? "bg-emerald-50/15" : ""
                              }`}
                            >
                              {/* Product Info */}
                              <td className="px-4 py-3.5">
                                <div className="font-bold text-slate-800 text-sm leading-tight">
                                  {p.name}
                                </div>
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
                                <div className="inline-flex items-center gap-2">
                                  {isOnboarded ? (
                                    isExec ? (
                                      <>
                                        <input
                                          type="checkbox"
                                          checked={true}
                                          disabled={onboardingBusyMap[p.id]}
                                          onClick={(e) => e.stopPropagation()}
                                          onChange={() => handleToggleOnboarding(p.id, true)}
                                          className="rounded border-slate-350 h-5 w-5 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                                        />
                                        {onboardingBusyMap[p.id] && (
                                          <span className="text-[10px] text-slate-400 font-medium animate-pulse">
                                            Offboarding...
                                          </span>
                                        )}
                                      </>
                                    ) : (
                                      <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                                    )
                                  ) : isExec ? (
                                    <>
                                      <input
                                        type="checkbox"
                                        checked={false}
                                        disabled={onboardingBusyMap[p.id]}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={() => handleToggleOnboarding(p.id, false)}
                                        className="rounded border-slate-350 h-5 w-5 text-brand-600 focus:ring-brand-500 cursor-pointer"
                                      />
                                      {onboardingBusyMap[p.id] && (
                                        <span className="text-[10px] text-slate-400 font-medium animate-pulse">
                                          Onboarding...
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    <span className="inline-block w-5 h-5 rounded border border-slate-200 bg-slate-50/50 shrink-0" />
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
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={(e) => {
                                        const val = Math.max(1, parseInt(e.target.value) || 1);
                                        setQuantities((prev) => ({ ...prev, [p.id]: val }));
                                      }}
                                      className="w-16 rounded-lg border border-slate-300 px-2.5 py-1 text-center font-bold text-slate-800 bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                                    />
                                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">pcs</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 opacity-45 select-none">
                                    <input
                                      type="text"
                                      disabled
                                      value="—"
                                      className="w-16 rounded-lg border border-slate-200 px-2.5 py-1 text-center font-bold text-slate-400 bg-slate-50 cursor-not-allowed"
                                    />
                                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">pcs</span>
                                  </div>
                                )}
                              </td>

                              {/* Location Assigner */}
                              <td className="px-4 py-3.5">
                                {isOnboarded ? (
                                  <div className="space-y-1.5">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openAssignModal(p, record, currentQty);
                                      }}
                                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold transition shadow-xs ${
                                        record.copies && record.copies.length > 0
                                          ? "bg-emerald-600 hover:bg-emerald-700"
                                          : "bg-rose-600 hover:bg-rose-700"
                                      }`}
                                    >
                                      <MapPin className="w-3.5 h-3.5" />
                                      <span>Assign Location</span>
                                    </button>
                                  </div>
                                ) : (
                                  <div className="space-y-1.5 opacity-45 select-none">
                                    <button
                                      type="button"
                                      disabled
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-400 text-xs font-semibold cursor-not-allowed"
                                    >
                                      <MapPin className="w-3.5 h-3.5" />
                                      <span>Assign Location</span>
                                    </button>
                                  </div>
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
                                              c.copyRole === "UNIQUE" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"
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
                                            onClick={(e) => e.stopPropagation()}
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
                                  <span className="text-slate-350 font-bold select-none">—</span>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {/* Level 1: Zone / Block Selection */}
                <div>
                  <label className={L}>Zone / Block *</label>
                  <select
                    value={selectedParentId}
                    onChange={(e) => {
                      setSelectedParentId(e.target.value);
                      setSelectedLevel2Id("");
                      setSelectedLevel3Id("");
                    }}
                    required
                    className={I}
                  >
                    <option value="">— Select Zone/Block —</option>
                    {level1Options.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Level 2: Rack Selection */}
                <div>
                  <label className={L}>Rack / Location *</label>
                  <select
                    value={selectedLevel2Id}
                    onChange={(e) => {
                      setSelectedLevel2Id(e.target.value);
                      setSelectedLevel3Id("");
                    }}
                    required
                    disabled={!selectedParentId || level2Options.length === 0}
                    className={`${I} disabled:opacity-50 disabled:bg-slate-50`}
                  >
                    <option value="">— Select Rack —</option>
                    {level2Options.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name} {opt.locationId ? `(${opt.locationId})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Level 3: Tray Selection */}
                <div>
                  <label className={L}>Tray / Position</label>
                  <select
                    value={selectedLevel3Id}
                    onChange={(e) => setSelectedLevel3Id(e.target.value)}
                    disabled={!selectedLevel2Id || level3Options.length === 0}
                    className={`${I} disabled:opacity-50 disabled:bg-slate-50`}
                  >
                    <option value="">— Select Tray (Optional) —</option>
                    {level3Options.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name} {opt.locationId ? `(${opt.locationId})` : ""}
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
                    className={`${I} font-semibold text-slate-800`}
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
                            UNIQUE
                          </span>
                        </label>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold select-none ${
                          !row.isMaster ? "bg-slate-200 text-slate-700 font-extrabold" : "bg-slate-50 text-slate-350"
                        }`}>
                          COPY
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-normal">
                Exactly one unit must be marked UNIQUE. If a unique copy already exists for this product in your branch, saving will update role allocations accordingly.
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

      {/* Export Custom Template Modal */}
      {exportModalOpen && activeBrand && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4">
          <div className="mt-10 w-full max-w-xl rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-md p-6 shadow-2xl space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">Export Custom Excel Template</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Download a pre-formatted Excel template for importing products under {activeBrand.name}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setExportModalOpen(false);
                  setSelectedExportCategory(null);
                  setExportCategoryAttrs([]);
                  setExportCategoryQuery("");
                  setExportCategories([]);
                  setDynamicBrandCategories([]);
                }}
                className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              {/* Brand Indicator */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Brand</span>
                  <span className="text-sm font-bold text-slate-800">{activeBrand.name}</span>
                </div>
                <span className="bg-brand-100 text-brand-700 text-xs font-bold px-2.5 py-1 rounded-lg">
                  {activeBrand.code}
                </span>
              </div>

              {/* Category Search Input */}
              <div className="relative">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                  Search & Select Category *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={exportCategoryQuery}
                    onFocus={() => {
                      if (!selectedExportCategory) {
                        setExportCategories(dynamicBrandCategories);
                      }
                    }}
                    onChange={(e) => handleSearchCategories(e.target.value)}
                    placeholder={loadingCategories ? "Loading categories mapping..." : "Type to search categories (e.g. Faucets, Hardware)..."}
                    disabled={loadingCategories}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white disabled:bg-slate-50 disabled:text-slate-400"
                  />
                  {selectedExportCategory && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedExportCategory(null);
                        setExportCategoryAttrs([]);
                        setExportCategoryQuery("");
                        setExportCategories([]);
                      }}
                      className="text-xs text-rose-600 font-bold hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Suggestions List */}
                {exportCategories.length > 0 && (
                  <div className="absolute left-0 right-0 z-10 mt-1 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg divide-y divide-slate-100">
                    {exportCategories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleSelectExportCategory(cat)}
                        className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex justify-between items-center transition-colors"
                      >
                        <span className="font-semibold">{cat.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Mapped Columns & Attributes Preview */}
              {exportLoadingAttrs && (
                <div className="flex items-center justify-center py-6 text-sm text-slate-400 gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
                  <span>Loading attributes mapped to category...</span>
                </div>
              )}

              {!exportLoadingAttrs && selectedExportCategory && (
                <div className="space-y-3 pt-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-450">
                    Excel Sheet Column Preview
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    The custom spreadsheet will contain the following columns. Fill them out to import:
                  </p>

                  <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-150 bg-white">
                    {/* Fixed Product Identifiers */}
                    <div className="bg-slate-50/50 px-4 py-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Fixed Columns</span>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded border border-slate-200">Product Name</span>
                        <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded border border-slate-200">SKU</span>
                        <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded border border-slate-200">Category Name</span>
                      </div>
                    </div>

                    {/* Mapped Custom Attributes */}
                    <div className="px-4 py-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Category Custom Attributes</span>
                      {exportCategoryAttrs.length === 0 ? (
                        <span className="text-xs text-slate-400 italic">No custom attributes mapped for this category.</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {exportCategoryAttrs.map((a) => (
                            <span key={a.id} className="px-2 py-1 bg-indigo-55 text-indigo-700 text-xs font-bold rounded border border-indigo-150 flex items-center gap-1">
                              {a.name}
                              <span className="text-[9px] text-indigo-400 font-medium font-mono">({a.dataType})</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Media Columns */}
                    <div className="px-4 py-3 bg-slate-50/40">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Media Files (URLs)</span>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="flex items-center gap-1.5 p-2 rounded border border-slate-200 bg-white shadow-2xs">
                          <Image className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span className="text-xs font-bold text-slate-700 truncate">Product Image</span>
                        </div>
                        <div className="flex items-center gap-1.5 p-2 rounded border border-slate-200 bg-white shadow-2xs">
                          <Film className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="text-xs font-bold text-slate-700 truncate">Product Video</span>
                        </div>
                        <div className="flex items-center gap-1.5 p-2 rounded border border-slate-200 bg-white shadow-2xs">
                          <FileText className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span className="text-xs font-bold text-slate-700 truncate">Product PDF</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-150">
              <button
                type="button"
                onClick={() => {
                  setExportModalOpen(false);
                  setSelectedExportCategory(null);
                  setExportCategoryAttrs([]);
                  setExportCategoryQuery("");
                  setExportCategories([]);
                  setDynamicBrandCategories([]);
                }}
                className="rounded-lg border border-slate-350 px-4 py-2 text-sm font-semibold hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDownloadCustomTemplate}
                disabled={!selectedExportCategory || exportLoadingAttrs}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white px-5 py-2.5 text-sm font-bold hover:bg-brand-700 disabled:opacity-60 transition disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                <span>Download Custom Excel Template</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Inspection Details Modal */}
      {detailsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4">
          <div className="mt-10 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-md p-6 shadow-2xl space-y-6">
            
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">
                  Product Inspection Details
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  View structural master details, custom attributes, and uploaded media assets.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDetailsModalOpen(false);
                  setDetailsProduct(null);
                }}
                className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {detailsLoading && (
              <div className="flex flex-col items-center justify-center py-20 text-sm text-slate-400 gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-brand-650" />
                <span className="font-semibold">Fetching master record...</span>
              </div>
            )}

            {!detailsLoading && detailsProduct && (
              <div className="space-y-6 text-left">
                {/* Core Meta Card - Premium Hero Banner */}
                <div className="bg-slate-55/70 p-5 rounded-2xl border border-slate-200 space-y-3 bg-slate-50/50 shadow-2xs">
                  <span className="text-[10px] font-bold text-brand-600 uppercase tracking-wider block">Product Master Record</span>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                    {detailsProduct.name}
                  </h3>
                  
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-mono font-bold text-slate-700" title="SKU Code">
                      SKU: {detailsProduct.sku}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-50 border border-indigo-150 text-xs font-bold text-indigo-750" title="Product Brand">
                      Brand: {detailsProduct.brand?.name ?? "—"}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-bold text-slate-650" title="Product Category">
                      Category: {detailsProduct.category?.name ?? "—"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  {/* Left Column: Attributes & Location (7 cols) */}
                  <div className="md:col-span-7 space-y-5">
                    {/* Attributes Section */}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                      <div className="bg-slate-50/50 px-4 py-2.5 border-b border-slate-150 text-[10px] font-bold uppercase tracking-wider text-slate-450">
                        Product Specifications
                      </div>
                      {detailsProduct.attrValues && detailsProduct.attrValues.length > 0 ? (
                        <div className="divide-y divide-slate-100">
                          {detailsProduct.attrValues.map((av: any) => (
                            <div key={av.attributeId} className="flex justify-between items-center px-4 py-3 text-xs hover:bg-slate-50/30 transition-colors">
                              <span className="font-semibold text-slate-500">{av.name}</span>
                              <span className="font-bold text-slate-800 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                                {av.value ?? "—"}{av.unit ? ` ${av.unit}` : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-6 text-center text-xs text-slate-400 italic">
                          No custom attributes are mapped or filled for this category.
                        </div>
                      )}
                    </div>

                    {/* Placement Location & Copies Info (only if onboarded) */}
                    {onboardingMap[detailsProductId] && (
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                        <div className="bg-slate-50/50 px-4 py-2.5 border-b border-slate-150 text-[10px] font-bold uppercase tracking-wider text-slate-450">
                          Placement Copies &amp; Locations
                        </div>
                        {onboardingMap[detailsProductId].copies && onboardingMap[detailsProductId].copies.length > 0 ? (
                          <div className="divide-y divide-slate-100">
                            <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              <div className="col-span-2">Role</div>
                              <div className="col-span-3">Sample Size</div>
                              <div className="col-span-7">Location Node</div>
                            </div>
                            {onboardingMap[detailsProductId].copies.map((copy: any) => {
                              // Find matching size label
                              const sizeObj = sizes.find((s) => s.id === copy.sampleSizeId);
                              return (
                                <div key={copy.id} className="grid grid-cols-12 gap-2 px-4 py-3 text-xs items-center hover:bg-slate-50/30 transition-colors">
                                  <div className="col-span-2">
                                    <span className={`px-2 py-0.5 rounded-md text-[8px] font-extrabold tracking-wide ${
                                      copy.copyRole === "UNIQUE" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"
                                    }`}>
                                      {copy.copyRole}
                                    </span>
                                  </div>
                                  <div className="col-span-3 font-semibold text-slate-650">
                                    {sizeObj?.label ?? "—"}
                                  </div>
                                  <div className="col-span-7 font-bold text-slate-800 flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-emerald-655 shrink-0" />
                                    <span className="truncate" title={copy.location?.name ?? "Stage Buffer"}>
                                      {copy.location?.name ?? "Stage Buffer"}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="p-4 flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
                            <span className="text-xs text-amber-800 font-semibold">
                              Product is onboarded but no inventory copies have been assigned a location yet.
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Media Preview Assets (5 cols) */}
                  <div className="md:col-span-5 space-y-5">
                    {/* Media files preview stack */}
                    {(() => {
                      const imgMedia = detailsProduct.media && detailsProduct.media.find((m: any) => m.type === "logo");
                      const vidMedia = detailsProduct.media && detailsProduct.media.find((m: any) => m.type === "video");
                      const pdfMedia = detailsProduct.media && detailsProduct.media.find((m: any) => m.type === "pdf");
                      const hasAnyMedia = !!(imgMedia || vidMedia || pdfMedia);

                      if (!hasAnyMedia) {
                        return (
                          <div className="rounded-xl border border-dashed border-slate-250 bg-slate-50/50 p-8 text-center text-slate-400 flex flex-col items-center justify-center gap-2 shadow-2xs h-full min-h-[220px]">
                            <Image className="w-8 h-8 opacity-45" />
                            <span className="text-xs font-bold">No Media Assets Uploaded</span>
                            <span className="text-[10px] text-slate-400 leading-normal max-w-[200px] mx-auto">
                              This product does not have any image, video demonstration, or PDF catalog brochure.
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-4">
                          {/* Image Preview */}
                          {imgMedia && (
                            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Product Image</span>
                              <div className="flex flex-col gap-2">
                                <div className="h-44 w-full rounded-lg bg-slate-50 border border-slate-100 overflow-hidden flex items-center justify-center p-2">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={imgMedia.url}
                                    alt="Product inspection preview"
                                    className="max-h-full max-w-full object-contain"
                                  />
                                </div>
                                <a
                                  href={imgMedia.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-brand-600 font-bold hover:underline truncate text-center block mt-1"
                                >
                                  Open full-size image ↗
                                </a>
                              </div>
                            </div>
                          )}

                          {/* Video Player */}
                          {vidMedia && (
                            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Product Video</span>
                              <div className="space-y-2">
                                <div className="rounded-lg bg-black overflow-hidden aspect-video border border-slate-200 flex items-center justify-center">
                                  <video
                                    src={vidMedia.url}
                                    className="w-full h-full object-contain"
                                    controls
                                    preload="metadata"
                                  />
                                </div>
                                <a
                                  href={vidMedia.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-brand-600 font-bold hover:underline block truncate text-center mt-1"
                                >
                                  Open video file ↗
                                </a>
                              </div>
                            </div>
                          )}

                          {/* PDF Brochure Document */}
                          {pdfMedia && (
                            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Brochure / PDF Document</span>
                              <div className="flex items-center justify-between gap-3 p-2 bg-emerald-50/60 border border-emerald-100 rounded-lg">
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileText className="w-8 h-8 text-emerald-605 shrink-0" />
                                  <div className="min-w-0">
                                    <div className="text-xs font-bold text-slate-800 truncate">Product brochure.pdf</div>
                                    <div className="text-[9px] text-slate-450 font-mono">Format: PDF Document</div>
                                  </div>
                                </div>
                                <a
                                  href={pdfMedia.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs font-bold text-emerald-705 bg-white hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-md transition shadow-2xs shrink-0"
                                >
                                  Open PDF
                                </a>
                              </div>
                            </div>
                          )}

                          {/* Sleek inline status indicators for missing media assets */}
                          <div className="flex flex-wrap gap-2 pt-1 opacity-75 justify-center">
                            {!imgMedia && <span className="text-[10px] font-bold text-slate-400 bg-slate-100 border border-slate-200 rounded-md px-2 py-1">No Image</span>}
                            {!vidMedia && <span className="text-[10px] font-bold text-slate-400 bg-slate-100 border border-slate-200 rounded-md px-2 py-1">No Video</span>}
                            {!pdfMedia && <span className="text-[10px] font-bold text-slate-400 bg-slate-100 border border-slate-200 rounded-md px-2 py-1">No PDF</span>}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-150">
              <button
                type="button"
                onClick={() => {
                  setDetailsModalOpen(false);
                  setDetailsProduct(null);
                }}
                className="rounded-lg border border-slate-350 px-5 py-2 text-sm font-semibold hover:bg-slate-50 transition"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Complete Success Modal */}
      {importResult && (
        <div className="fixed inset-0 z-55 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4">
          <div className="mt-16 w-full max-w-md rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-md p-6 shadow-2xl space-y-6">
            {/* Icon & Title */}
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Import Complete</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Excel spreadsheet processing finished successfully.
                </p>
              </div>
            </div>

            {/* Results Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 text-center">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Success</span>
                <span className="text-2xl font-black text-emerald-800 mt-1 block">{importResult.success}</span>
                <span className="text-[9px] text-emerald-600 font-semibold mt-0.5 block">Onboarded</span>
              </div>
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 text-center">
                <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">Reused</span>
                <span className="text-2xl font-black text-indigo-800 mt-1 block">{importResult.reused}</span>
                <span className="text-[9px] text-indigo-650 font-semibold mt-0.5 block">Masters</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Failed</span>
                <span className={`text-2xl font-black mt-1 block ${importResult.failed > 0 ? "text-rose-600" : "text-slate-600"}`}>
                  {importResult.failed}
                </span>
                <span className="text-[9px] text-slate-450 font-semibold mt-0.5 block">Rows</span>
              </div>
            </div>

            {/* Detail Messages */}
            <div className="text-xs text-slate-500 space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-150 text-left">
              <div className="flex justify-between items-center">
                <span>Total rows read:</span>
                <span className="font-bold text-slate-700">{importResult.success + importResult.reused + importResult.failed}</span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-200/60 pt-2">
                <span>Status:</span>
                <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Success
                </span>
              </div>
            </div>

            {/* Close / Action */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setImportResult(null);
                  window.location.reload();
                }}
                className="w-full rounded-lg bg-slate-900 text-white py-2.5 text-sm font-bold hover:bg-slate-800 transition shadow-xs text-center cursor-pointer"
              >
                Done &amp; Refresh List
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Error Modal */}
      {importError && (
        <div className="fixed inset-0 z-55 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4">
          <div className="mt-16 w-full max-w-md rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-md p-6 shadow-2xl space-y-6">
            {/* Icon & Title */}
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                <X className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Import Error</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Could not process the uploaded template.
                </p>
              </div>
            </div>

            {/* Error Message */}
            <div className="text-xs text-rose-700 bg-rose-50/50 p-4 rounded-xl border border-rose-150 leading-relaxed text-center font-semibold">
              {importError}
            </div>

            {/* Close / Action */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setImportError(null)}
                className="w-full rounded-lg bg-slate-900 text-white py-2.5 text-sm font-bold hover:bg-slate-800 transition shadow-xs text-center cursor-pointer"
              >
                Close &amp; Retry
              </button>
            </div>
          </div>
        </div>
      )}
    </details>
  );
}

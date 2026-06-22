"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LocationNode, NODE_META, nodeMeta, ALLOWED_CHILDREN, combineCode, DEFAULT_FLAGS } from "@/lib/warehouseMeta";
import * as XLSX from "xlsx";
import { Upload, Download, Loader2, Search, X, CheckCircle2, AlertCircle, FileSpreadsheet, Plus } from "lucide-react";

export type { LocationNode } from "@/lib/warehouseMeta";

type TreeNode = LocationNode & { children: TreeNode[] };

type PreviewNode = {
  name: string;
  code: string;
  nodeType: string;
  isPlacementEligible: boolean;
  quantity: number;
  isScreenMountable: boolean;
  categories: string[];
  children: PreviewNode[];
};

export default function WarehouseTree({
  branchId,
  programId,
  programName,
  initial,
  initialFlowSteps,
  categories,
  canEdit = false,
}: {
  branchId: string;
  programId: string;
  programName: string;
  initial: LocationNode[];
  initialFlowSteps: Array<{ id: string; name: string; level: string; datatype: string }> | null;
  categories?: Array<{ id: string; name: string; code: string; parentId: string | null }> | null;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const [flowSteps, setFlowSteps] = useState<Array<{ id: string; name: string; level: string; datatype: string }>>(() => {
    if (initialFlowSteps && initialFlowSteps.length > 0) return initialFlowSteps;
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`wh_flow_${programId}`);
      if (saved) return JSON.parse(saved);
    }
    if (programName.toLowerCase().includes("catalogue") || programName.toLowerCase().includes("library")) {
      return [
        { id: "L1", name: "Cabinet", level: "L0", datatype: "String" },
        { id: "L2", name: "Shelf", level: "L1", datatype: "String" },
        { id: "L3", name: "Folder", level: "L2", datatype: "String" }
      ];
    }
    return [
      { id: "L1", name: "Warehouse", level: "L0", datatype: "String" },
      { id: "L2", name: "Block / Area", level: "L1", datatype: "String" },
      { id: "L3", name: "Rack / Shelf", level: "L2", datatype: "String" },
      { id: "L4", name: "Tray / Bin", level: "L3", datatype: "String" }
    ];
  });

  const [flowDefined, setFlowDefined] = useState<boolean>(() => {
    if (initialFlowSteps && initialFlowSteps.length > 0) return true;
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`wh_flow_defined_${programId}`);
      return saved === "true";
    }
    return false;
  });

  const newHref = (params: Record<string, string>) =>
    `/branch/warehouse/new?${new URLSearchParams({ program: programId, ...params }).toString()}`;

  // Build tree from flat list
  const roots = useMemo<TreeNode[]>(() => {
    const map = new Map<string, TreeNode>();
    for (const n of initial) map.set(n.id, { ...n, children: [] });
    const roots: TreeNode[] = [];
    for (const node of map.values()) {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    const sort = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => a.name.localeCompare(b.name));
      nodes.forEach((n) => sort(n.children));
    };
    sort(roots);
    return roots;
  }, [initial]);

  // Search filtering
  const { visible } = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { visible: null as Set<string> | null };
    const vis = new Set<string>();
    const walk = (n: TreeNode): boolean => {
      let childMatch = false;
      for (const c of n.children) childMatch = walk(c) || childMatch;
      const self =
        n.name.toLowerCase().includes(q) ||
        (n.code ?? "").toLowerCase().includes(q) ||
        n.nodeType.toLowerCase().includes(q);
      if (self || childMatch) { vis.add(n.id); return true; }
      return false;
    };
    roots.forEach(walk);
    return { visible: vis };
  }, [query, roots]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }


  async function toggleStatus(node: LocationNode) {
    setBusy(true);
    await fetch(`/api/location-nodes/${node.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: node.status === "active" ? "inactive" : "active" }),
    });
    setBusy(false);
    router.refresh();
  }

  async function remove(node: LocationNode) {
    if (node._count.copies > 0) {
      alert(
        `Cannot delete "${node.name}" — it has ${node._count.copies} product copies placed here.\n\nPer policy (PRD §B5), all copies must be relocated to another location before this node can be removed.`
      );
      return;
    }
    if (!confirm(`Delete "${node.name}"? ${node._count.children > 0 ? "It has sub-nodes and will be deactivated instead." : "This cannot be undone."}`)) return;
    setBusy(true);
    await fetch(`/api/location-nodes/${node.id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  const blockCount = initial.filter((n) => n.nodeType === "BLOCK").length;
  const rackCount = initial.filter((n) => n.nodeType === "RACK").length;
  const totalCategories = new Set(initial.filter((n) => n.categoryId).map((n) => String(n.categoryId))).size;
  const totalQuantity = initial.reduce((sum, n) => sum + (n._count?.copies ?? 0), 0);

  const [pendingAction, setPendingAction] = useState<"export_template" | "export_locations" | "import" | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [showImportModal, setShowImportModal] = useState(false);

  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState("");
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState<{ created: number; matched: number } | null>(null);
  const [pendingImportRows, setPendingImportRows] = useState<any[][] | null>(null);
  const [previewRoots, setPreviewRoots] = useState<PreviewNode[]>([]);

  const categoryCodeMap = useMemo(() => {
    return new Map((categories || []).map((c) => [c.code.trim().toUpperCase(), c.id]));
  }, [categories]);

  const categoryIdToCode = useMemo(() => {
    return new Map((categories || []).map((c) => [String(c.id), c.code]));
  }, [categories]);

  const categoryNameMap = useMemo(() => {
    return new Map((categories || []).map((c) => [c.name.trim().toUpperCase(), c.id]));
  }, [categories]);

  const warehouses = useMemo(() => {
    if (!flowSteps || flowSteps.length === 0) return [];
    const rootLevel = flowSteps[0].level;
    return initial.filter((n) => n.nodeType === rootLevel);
  }, [initial, flowSteps]);

  function handleExportTemplate(warehouseId: string) {
    const headers: string[] = [];
    flowSteps.forEach((s, idx) => {
      if (idx === 0) return; // Skip step 0 (Warehouse)
      headers.push(`${s.name} Name`);
      headers.push(`${s.name} Code (Optional)`);
    });
    headers.push("Placement Eligible (Yes/No)");
    headers.push("Quantity");
    headers.push("Screen Mountable (Yes/No)");
    headers.push("Categories (Codes)");

    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `${programName.replace(/[^a-zA-Z0-9]/g, "_")}_Warehouse_Template.xlsx`);
  }

  function handleExportLocations(warehouseId: string) {
    const headers: string[] = [];
    flowSteps.forEach((s, idx) => {
      if (idx === 0) return; // Skip step 0 (Warehouse)
      headers.push(`${s.name} Name`);
      headers.push(`${s.name} Code (Optional)`);
    });
    headers.push("Placement Eligible (Yes/No)");
    headers.push("Quantity");
    headers.push("Screen Mountable (Yes/No)");
    headers.push("Categories (Codes)");

    const rowsData: any[] = [];

    // Find the target warehouse root node in the tree
    const targetWarehouse = roots.find((r) => String(r.id) === String(warehouseId));
    if (!targetWarehouse) return;

    function walkTree(node: TreeNode, ancestors: TreeNode[]) {
      const currentAncestors = [...ancestors, node];

      if (node.children.length === 0) {
        const rowObj: Record<string, any> = {};

        flowSteps.forEach((step, idx) => {
          if (idx === 0) return; // Skip step 0 (Warehouse)
          const ancestor = currentAncestors[idx];
          rowObj[`${step.name} Name`] = ancestor ? ancestor.name : "";
          rowObj[`${step.name} Code (Optional)`] = ancestor ? (ancestor.code || "") : "";
        });

        rowObj["Placement Eligible (Yes/No)"] = node.isPlacementEligible ? "Yes" : "No";
        rowObj["Quantity"] = node.quantity || 1;
        rowObj["Screen Mountable (Yes/No)"] = node.isScreenMountable ? "Yes" : "No";

        const categoryIds = new Set<string>();
        if (node.categoryId) categoryIds.add(String(node.categoryId));
        if (node.nodeCategories) {
          node.nodeCategories.forEach((nc) => {
            if (nc.categoryId) categoryIds.add(String(nc.categoryId));
          });
        }
        const codes = Array.from(categoryIds)
          .map((id) => categoryIdToCode.get(String(id)))
          .filter(Boolean);
        rowObj["Categories (Codes)"] = codes.join(", ");

        rowsData.push(rowObj);
      } else {
        node.children.forEach((child) => walkTree(child, currentAncestors));
      }
    }

    targetWarehouse.children.forEach((child) => walkTree(child, [targetWarehouse]));

    const ws = XLSX.utils.json_to_sheet(rowsData, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Locations");
    XLSX.writeFile(wb, `${programName.replace(/[^a-zA-Z0-9]/g, "_")}_${targetWarehouse.name.replace(/[^a-zA-Z0-9]/g, "_")}_Locations.xlsx`);
  }

  async function simulateImportFile(file: File) {
    setImporting(true);
    setImportProgress("Reading and simulating import...");
    setImportError("");
    setImportSuccess(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
          throw new Error("The uploaded file does not contain any sheets.");
        }
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        if (rows.length <= 1) {
          throw new Error("The uploaded spreadsheet is empty or has no data rows.");
        }

        // Find the header row dynamically (skipping any empty/title rows at the top)
        let headerRowIndex = -1;
        let headerRow: string[] = [];
        for (let r = 0; r < Math.min(rows.length, 10); r++) {
          const row = rows[r];
          if (!row || row.length === 0) continue;
          const rowStrings = row.map((c) => String(c || "").trim().toLowerCase());
          const hasBlock = rowStrings.some((s) => s.includes("block"));
          const hasRack = rowStrings.some((s) => s.includes("rack"));
          const hasAccessory = rowStrings.some((s) => s.includes("accessory") || s.includes("accessories"));
          const hasQuantity = rowStrings.some((s) => s.includes("quantity") || s.includes("count"));
          
          let matchCount = 0;
          if (hasBlock) matchCount++;
          if (hasRack) matchCount++;
          if (hasAccessory) matchCount++;
          if (hasQuantity) matchCount++;
          
          if (matchCount >= 2) {
            headerRowIndex = r;
            headerRow = row.map((h) => String(h || "").trim());
            break;
          }
        }

        if (headerRowIndex === -1) {
          headerRowIndex = 0;
          headerRow = rows[0].map((h) => String(h || "").trim());
        }

        // Find column indices (starting from step 1)
        const findColumnIndex = (hRow: string[], stepName: string, isCode: boolean) => {
          const cleanStep = stepName.toLowerCase().replace(/[^a-z0-9]/g, "");
          const targetHeader = isCode ? `${stepName} Code (Optional)` : `${stepName} Name`;
          
          let idx = hRow.findIndex((h) => h.toLowerCase() === targetHeader.toLowerCase());
          if (idx !== -1) return idx;

          idx = hRow.findIndex((h) => h.toLowerCase() === stepName.toLowerCase());
          if (idx !== -1) return idx;

          // Standard synonyms for fuzzy matching names
          if (!isCode) {
            const stepLower = stepName.toLowerCase();
            const syns: string[] = [];
            if (stepLower.includes("shelf") || stepLower.includes("drawer") || stepLower.includes("storage")) {
              syns.push("storage type", "type", "storage");
            }
            if (stepLower.includes("tray") || stepLower.includes("compartment") || stepLower.includes("bin") || stepLower.includes("number")) {
              syns.push("number", "no", "no.");
            }
            if (stepLower.includes("block") || stepLower.includes("area")) {
              syns.push("block", "block no", "block no.");
            }
            if (stepLower.includes("rack") || stepLower.includes("shelf")) {
              syns.push("rack", "rack no", "rack no.");
            }

            for (const syn of syns) {
              const sIdx = hRow.findIndex((h) => {
                const cleanH = h.toLowerCase().trim();
                return cleanH === syn || cleanH.replace(/[^a-z0-9]/g, "") === syn.replace(/[^a-z0-9]/g, "");
              });
              if (sIdx !== -1) return sIdx;
            }
          }

          const suffixes = isCode ? ["code", "id"] : ["name", "no.", "no", "number"];
          for (const suffix of suffixes) {
            idx = hRow.findIndex((h) => {
              const cleanH = h.toLowerCase().replace(/[^a-z0-9]/g, "");
              return cleanH === cleanStep + suffix.replace(/[^a-z0-9]/g, "") || cleanH === cleanStep;
            });
            if (idx !== -1) return idx;
          }

          idx = hRow.findIndex((h) => {
            const cleanH = h.toLowerCase().replace(/[^a-z0-9]/g, "");
            return cleanH.includes(cleanStep);
          });
          return idx;
        };

        const stepColIndices = flowSteps.map((step, idx) => {
          if (idx === 0) return { nameIdx: -1, codeIdx: -1 };

          const nameIdx = findColumnIndex(headerRow, step.name, false);
          const codeIdx = findColumnIndex(headerRow, step.name, true);

          return { nameIdx, codeIdx };
        });

        const placementIdx = headerRow.findIndex((h) => 
          h.toLowerCase().includes("placement") || 
          h.toLowerCase().includes("eligible")
        );
        const quantityIdx = headerRow.findIndex((h) => 
          h.toLowerCase().includes("quantity") || 
          h.toLowerCase().includes("count of accessories") || 
          h.toLowerCase().includes("total count") ||
          h.toLowerCase().includes("qty")
        );
        const screenIdx = headerRow.findIndex((h) => 
          h.toLowerCase().includes("screen") || 
          h.toLowerCase().includes("mountable")
        );
        const categoriesIdx = headerRow.findIndex((h) => 
          h.toLowerCase().includes("categories") || 
          h.toLowerCase().includes("accessory") || 
          h.toLowerCase().includes("accessories") || 
          h.toLowerCase().includes("category")
        );

        // Validate that we have at least columns for step 1
        if (flowSteps.length > 1 && stepColIndices[1].nameIdx === -1) {
          throw new Error(`Required column "${flowSteps[1].name}" or "${flowSteps[1].name} Name" not found in spreadsheet.`);
        }

        const currentNodes = JSON.parse(JSON.stringify(initial)) as LocationNode[];
        const nodesToCreateList: any[] = [];

        for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex++) {
          const row = rows[rowIndex];
          if (!row || row.length === 0) continue;

          // Skip completely empty rows
          const hasAnyValue = row.some((cell) => cell !== undefined && cell !== null && String(cell).trim() !== "");
          if (!hasAnyValue) continue;

          let parentId = selectedWarehouseId;
          for (let i = 1; i < flowSteps.length; i++) {
            const step = flowSteps[i];
            const indices = stepColIndices[i];
            if (indices.nameIdx === -1) continue;

            const rawName = row[indices.nameIdx];
            if (rawName === undefined || rawName === null || String(rawName).trim() === "") {
              break; // Stop climbing down hierarchy for this row
            }

            let nodeName = String(rawName).trim();
            const rawCode = indices.codeIdx !== -1 ? row[indices.codeIdx] : null;
            let nodeCode = rawCode !== null && rawCode !== undefined ? String(rawCode).trim() : "";
            if (step.datatype.toLowerCase() === "string") {
              nodeCode = nodeCode.toUpperCase();
            }

            // Parse Name and Code if Name contains " - CODE" format
            if (nodeName.includes(" - ")) {
              const parts = nodeName.split(" - ");
              nodeName = parts[0].trim();
              if (!nodeCode) {
                nodeCode = parts[1].trim();
              }
            }

            if (step.datatype.toLowerCase() === "string") {
              nodeName = nodeName.toUpperCase();
            }

            // Clean code
            if (nodeCode) {
              nodeCode = nodeCode.replace(/\s+/g, "-").replace(/[^A-Za-z0-9_-]/g, "");
            }

            // Auto-generate code if empty (short, sequential based on cleaned name)
            if (!nodeCode) {
              let cleanName = nodeName.replace(/\s+/g, "-").replace(/[^A-Za-z0-9_-]/g, "").replace(/-+/g, "-");
              if (step.datatype.toLowerCase() === "string") {
                cleanName = cleanName.toUpperCase();
              }
              
              // Ensure code is unique among sibling nodes under this parent
              let uniqueCode = cleanName;
              let suffix = 1;
              while (currentNodes.some((n) => 
                String(n.parentId) === String(parentId || "") && 
                n.nodeType === step.level && 
                n.code?.toUpperCase() === uniqueCode.toUpperCase()
              )) {
                uniqueCode = `${cleanName}-${suffix}`;
                suffix++;
              }
              nodeCode = uniqueCode;
            }

            // Match existing
            const matched = currentNodes.find((n) => {
              const parentMatch = parentId ? String(n.parentId) === String(parentId) : !n.parentId;
              return (
                parentMatch &&
                n.nodeType === step.level &&
                (n.name.toUpperCase() === nodeName.toUpperCase() || (nodeCode && n.code?.toUpperCase() === nodeCode.toUpperCase()))
              );
            });

            if (matched) {
              parentId = String(matched.id);
            } else {
              const isLeaf =
                i === flowSteps.length - 1 ||
                !stepColIndices[i + 1] ||
                row[stepColIndices[i + 1].nameIdx] === undefined ||
                row[stepColIndices[i + 1].nameIdx] === null ||
                String(row[stepColIndices[i + 1].nameIdx]).trim() === "";

              let isPlacementEligible = false;
              let quantity = 1;
              let isScreenMountable = false;
              let categoryIds: string[] = [];

              if (isLeaf) {
                const placementVal = placementIdx !== -1 ? row[placementIdx] : null;
                isPlacementEligible =
                  placementVal !== null && placementVal !== undefined
                    ? String(placementVal).trim().toLowerCase().startsWith("y") ||
                      String(placementVal).trim() === "1" ||
                      String(placementVal).trim().toLowerCase() === "true"
                    : (DEFAULT_FLAGS[step.level]?.isPlacementEligible ?? false);

                const qtyVal = quantityIdx !== -1 ? row[quantityIdx] : null;
                quantity = qtyVal !== null && qtyVal !== undefined ? Math.max(1, parseInt(String(qtyVal), 10) || 1) : 1;

                const screenVal = screenIdx !== -1 ? row[screenIdx] : null;
                isScreenMountable =
                  screenVal !== null && screenVal !== undefined
                    ? String(screenVal).trim().toLowerCase().startsWith("y") ||
                      String(screenVal).trim() === "1" ||
                      String(screenVal).trim().toLowerCase() === "true"
                    : (DEFAULT_FLAGS[step.level]?.isScreenMountable ?? false);

                const catVal = categoriesIdx !== -1 ? row[categoriesIdx] : null;
                if (catVal !== null && catVal !== undefined) {
                  const codes = String(catVal)
                    .split(/[,;]+/)
                    .map((c) => c.trim())
                    .filter(Boolean);
                  categoryIds = codes.map((c) => {
                    const normalizedC = c.toUpperCase();
                    const exact = categoryCodeMap.get(normalizedC) || categoryNameMap.get(normalizedC);
                    if (exact) return exact;
                    
                    // Fallback to case-insensitive containment match
                    const lowerC = c.toLowerCase();
                    const found = categories?.find((cat) => {
                      const catName = cat.name.toLowerCase();
                      const catCode = cat.code.toLowerCase();
                      return catName.includes(lowerC) || catCode.includes(lowerC);
                    });
                    return found ? found.id : null;
                  }).filter(Boolean) as string[];
                }
              } else {
                const defFlags = DEFAULT_FLAGS[step.level] ?? { isPlacementEligible: false, isScreenMountable: false };
                isPlacementEligible = defFlags.isPlacementEligible;
                isScreenMountable = defFlags.isScreenMountable;
              }

              // Create simulated node
              const simulatedId = `sim_${Date.now()}_${Math.random()}`;
              const simulatedNode = {
                id: simulatedId,
                parentId,
                nodeType: step.level,
                name: nodeName,
                code: nodeCode,
                isPlacementEligible,
                quantity,
                isScreenMountable,
                categoryIds,
              };

              currentNodes.push({
                id: simulatedId,
                parentId,
                nodeType: step.level,
                name: nodeName,
                code: nodeCode || null,
                categoryId: categoryIds[0] || null,
                category: null,
                path: "",
                depth: i,
                isPlacementEligible,
                quantity,
                isScreenMountable,
                locationId: null,
                status: "active",
                _count: { children: 0, copies: 0 },
              });

              nodesToCreateList.push(simulatedNode);
              parentId = simulatedId;
            }
          }
        }

        // Build preview roots
        const rootsList: PreviewNode[] = [];
        const tempMap = new Map<string, PreviewNode>();

        nodesToCreateList.forEach((n) => {
          const catNames = (n.categoryIds || []).map((cid: string) => {
            const cat = categories?.find((c) => String(c.id) === String(cid));
            return cat ? `${cat.name} (${cat.code})` : cid;
          });

          tempMap.set(n.id, {
            name: n.name,
            code: n.code,
            nodeType: n.nodeType,
            isPlacementEligible: n.isPlacementEligible,
            quantity: n.quantity,
            isScreenMountable: n.isScreenMountable,
            categories: catNames,
            children: [],
          });
        });

        nodesToCreateList.forEach((n) => {
          const node = tempMap.get(n.id)!;
          if (n.parentId === selectedWarehouseId) {
            rootsList.push(node);
          } else if (tempMap.has(n.parentId)) {
            tempMap.get(n.parentId)!.children.push(node);
          }
        });

        setPreviewRoots(rootsList);
        setPendingImportRows(rows.slice(headerRowIndex));
      } catch (err: any) {
        setImportError(err.message || "An error occurred during simulation.");
      } finally {
        setImporting(false);
      }
    };

    reader.onerror = () => {
      setImportError("Failed to read the spreadsheet file.");
      setImporting(false);
    };

    reader.readAsArrayBuffer(file);
  }

  async function executeImport() {
    if (!pendingImportRows) return;
    setImporting(true);
    setImportProgress("Importing locations to database...");
    setImportError("");

    try {
      const rows = pendingImportRows;
      const headerRow = rows[0].map((h) => String(h || "").trim());

      // Find column indices (starting from step 1)
      const findColumnIndex = (hRow: string[], stepName: string, isCode: boolean) => {
        const cleanStep = stepName.toLowerCase().replace(/[^a-z0-9]/g, "");
        const targetHeader = isCode ? `${stepName} Code (Optional)` : `${stepName} Name`;
        
        let idx = hRow.findIndex((h) => h.toLowerCase() === targetHeader.toLowerCase());
        if (idx !== -1) return idx;

        idx = hRow.findIndex((h) => h.toLowerCase() === stepName.toLowerCase());
        if (idx !== -1) return idx;

        // Standard synonyms for fuzzy matching names
        if (!isCode) {
          const stepLower = stepName.toLowerCase();
          const syns: string[] = [];
          if (stepLower.includes("shelf") || stepLower.includes("drawer") || stepLower.includes("storage")) {
            syns.push("storage type", "type", "storage");
          }
          if (stepLower.includes("tray") || stepLower.includes("compartment") || stepLower.includes("bin") || stepLower.includes("number")) {
            syns.push("number", "no", "no.");
          }
          if (stepLower.includes("block") || stepLower.includes("area")) {
            syns.push("block", "block no", "block no.");
          }
          if (stepLower.includes("rack") || stepLower.includes("shelf")) {
            syns.push("rack", "rack no", "rack no.");
          }

          for (const syn of syns) {
            const sIdx = hRow.findIndex((h) => {
              const cleanH = h.toLowerCase().trim();
              return cleanH === syn || cleanH.replace(/[^a-z0-9]/g, "") === syn.replace(/[^a-z0-9]/g, "");
            });
            if (sIdx !== -1) return sIdx;
          }
        }

        const suffixes = isCode ? ["code", "id"] : ["name", "no.", "no", "number"];
        for (const suffixesList of suffixes) {
          idx = hRow.findIndex((h) => {
            const cleanH = h.toLowerCase().replace(/[^a-z0-9]/g, "");
            return cleanH === cleanStep + suffixesList.replace(/[^a-z0-9]/g, "") || cleanH === cleanStep;
          });
          if (idx !== -1) return idx;
        }

        idx = hRow.findIndex((h) => {
          const cleanH = h.toLowerCase().replace(/[^a-z0-9]/g, "");
          return cleanH.includes(cleanStep);
        });
        return idx;
      };

      const stepColIndices = flowSteps.map((step, idx) => {
        if (idx === 0) return { nameIdx: -1, codeIdx: -1 };

        const nameIdx = findColumnIndex(headerRow, step.name, false);
        const codeIdx = findColumnIndex(headerRow, step.name, true);

        return { nameIdx, codeIdx };
      });

      const placementIdx = headerRow.findIndex((h) => 
        h.toLowerCase().includes("placement") || 
        h.toLowerCase().includes("eligible")
      );
      const quantityIdx = headerRow.findIndex((h) => 
        h.toLowerCase().includes("quantity") || 
        h.toLowerCase().includes("count of accessories") || 
        h.toLowerCase().includes("total count") ||
        h.toLowerCase().includes("qty")
      );
      const screenIdx = headerRow.findIndex((h) => 
        h.toLowerCase().includes("screen") || 
        h.toLowerCase().includes("mountable")
      );
      const categoriesIdx = headerRow.findIndex((h) => 
        h.toLowerCase().includes("categories") || 
        h.toLowerCase().includes("accessory") || 
        h.toLowerCase().includes("accessories") || 
        h.toLowerCase().includes("category")
      );

      let createdCount = 0;
      let matchedCount = 0;
      const currentNodes = [...initial];

      for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];
        if (!row || row.length === 0) continue;

        const hasAnyValue = row.some((cell) => cell !== undefined && cell !== null && String(cell).trim() !== "");
        if (!hasAnyValue) continue;

        setImportProgress(`Saving row ${rowIndex} of ${rows.length - 1}...`);

        let parentId = selectedWarehouseId;
        for (let i = 1; i < flowSteps.length; i++) {
          const step = flowSteps[i];
          const indices = stepColIndices[i];
          if (indices.nameIdx === -1) continue;

          const rawName = row[indices.nameIdx];
          if (rawName === undefined || rawName === null || String(rawName).trim() === "") {
            break;
          }

          let nodeName = String(rawName).trim();
          const rawCode = indices.codeIdx !== -1 ? row[indices.codeIdx] : null;
          let nodeCode = rawCode !== null && rawCode !== undefined ? String(rawCode).trim() : "";
          if (step.datatype.toLowerCase() === "string") {
            nodeCode = nodeCode.toUpperCase();
          }

          // Parse Name and Code if Name contains " - CODE" format
          if (nodeName.includes(" - ")) {
            const parts = nodeName.split(" - ");
            nodeName = parts[0].trim();
            if (!nodeCode) {
              nodeCode = parts[1].trim();
            }
          }

          if (step.datatype.toLowerCase() === "string") {
            nodeName = nodeName.toUpperCase();
          }

          if (nodeCode) {
            nodeCode = nodeCode.replace(/\s+/g, "-").replace(/[^A-Za-z0-9_-]/g, "");
          }

          // Auto-generate code if empty (short, sequential based on cleaned name)
          if (!nodeCode) {
            let cleanName = nodeName.replace(/\s+/g, "-").replace(/[^A-Za-z0-9_-]/g, "").replace(/-+/g, "-");
            if (step.datatype.toLowerCase() === "string") {
              cleanName = cleanName.toUpperCase();
            }
            
            // Ensure code is unique among sibling nodes under this parent
            let uniqueCode = cleanName;
            let suffix = 1;
            while (currentNodes.some((n) => 
              String(n.parentId) === String(parentId || "") && 
              n.nodeType === step.level && 
              n.code?.toUpperCase() === uniqueCode.toUpperCase()
            )) {
              uniqueCode = `${cleanName}-${suffix}`;
              suffix++;
            }
            nodeCode = uniqueCode;
          }

          const matched = currentNodes.find((n) => {
            const parentMatch = parentId ? String(n.parentId) === String(parentId) : !n.parentId;
            return (
              parentMatch &&
              n.nodeType === step.level &&
              (n.name.toUpperCase() === nodeName.toUpperCase() || (nodeCode && n.code?.toUpperCase() === nodeCode.toUpperCase()))
            );
          });

          if (matched) {
            parentId = String(matched.id);
            matchedCount++;
          } else {
            const isLeaf =
              i === flowSteps.length - 1 ||
              !stepColIndices[i + 1] ||
              row[stepColIndices[i + 1].nameIdx] === undefined ||
              row[stepColIndices[i + 1].nameIdx] === null ||
              String(row[stepColIndices[i + 1].nameIdx]).trim() === "";

            let isPlacementEligible = false;
            let quantity = 1;
            let isScreenMountable = false;
            let categoryIds: string[] = [];

            if (isLeaf) {
              const placementVal = placementIdx !== -1 ? row[placementIdx] : null;
              isPlacementEligible =
                placementVal !== null && placementVal !== undefined
                  ? String(placementVal).trim().toLowerCase().startsWith("y") ||
                    String(placementVal).trim() === "1" ||
                    String(placementVal).trim().toLowerCase() === "true"
                  : (DEFAULT_FLAGS[step.level]?.isPlacementEligible ?? false);

              const qtyVal = quantityIdx !== -1 ? row[quantityIdx] : null;
              quantity = qtyVal !== null && qtyVal !== undefined ? Math.max(1, parseInt(String(qtyVal), 10) || 1) : 1;

              const screenVal = screenIdx !== -1 ? row[screenIdx] : null;
              isScreenMountable =
                screenVal !== null && screenVal !== undefined
                  ? String(screenVal).trim().toLowerCase().startsWith("y") ||
                    String(screenVal).trim() === "1" ||
                    String(screenVal).trim().toLowerCase() === "true"
                  : (DEFAULT_FLAGS[step.level]?.isScreenMountable ?? false);

              const catVal = categoriesIdx !== -1 ? row[categoriesIdx] : null;
              if (catVal !== null && catVal !== undefined) {
                const codes = String(catVal)
                  .split(/[,;]+/)
                  .map((c) => c.trim())
                  .filter(Boolean);
                categoryIds = codes.map((c) => {
                  const normalizedC = c.toUpperCase();
                  const exact = categoryCodeMap.get(normalizedC) || categoryNameMap.get(normalizedC);
                  if (exact) return exact;
                  
                  // Fallback to case-insensitive containment match
                  const lowerC = c.toLowerCase();
                  const found = categories?.find((cat) => {
                    const catName = cat.name.toLowerCase();
                    const catCode = cat.code.toLowerCase();
                    return catName.includes(lowerC) || catCode.includes(lowerC);
                  });
                  return found ? found.id : null;
                }).filter(Boolean) as string[];
              }
            } else {
              const defFlags = DEFAULT_FLAGS[step.level] ?? { isPlacementEligible: false, isScreenMountable: false };
              isPlacementEligible = defFlags.isPlacementEligible;
              isScreenMountable = defFlags.isScreenMountable;
            }

            const payload: Record<string, any> = {
              branchId,
              programId,
              parentId: parentId ? String(parentId) : null,
              nodeType: step.level,
              name: nodeName,
              code: nodeCode || null,
              isPlacementEligible,
              quantity,
              isScreenMountable,
              categoryIds,
            };

            const res = await fetch("/api/location-nodes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });

            if (!res.ok) {
              const data = await res.json();
              throw new Error(`Row ${rowIndex + 1} (${step.name} "${nodeName}"): ${data.error || "Save failed"}`);
            }

            const data = await res.json();
            const newNode = data.node;
            if (!newNode) {
              throw new Error(`Row ${rowIndex + 1}: API didn't return created node.`);
            }

            currentNodes.push(newNode);
            parentId = String(newNode.id);
            createdCount++;
          }
        }
      }

      setImportSuccess({ created: createdCount, matched: matchedCount });
      setPendingImportRows(null);
      setPreviewRoots([]);
      router.refresh();
    } catch (err: any) {
      setImportError(err.message || "An error occurred during save.");
    } finally {
      setImporting(false);
    }
  }

  function renderPreviewTree(nodes: PreviewNode[]): React.ReactNode {
    return (
      <ul className="pl-3 border-l border-slate-200 dark:border-slate-800 space-y-2 mt-1">
        {nodes.map((node, idx) => {
          const meta = nodeMeta(node.nodeType);
          const stepName = flowSteps.find((s) => s.level === node.nodeType)?.name || node.nodeType;
          return (
            <li key={idx} className="text-xs">
              <div className="flex flex-wrap items-center gap-2 py-1">
                <span className={`px-2 py-0.5 rounded font-semibold text-[9px] uppercase tracking-wider ${meta.badge}`}>
                  {stepName}
                </span>
                <span className="font-bold text-slate-850 dark:text-slate-100">{node.name}</span>
                {node.code && <span className="font-mono text-slate-400 text-[10px]">({node.code})</span>}
                {node.isPlacementEligible && (
                  <span className="px-1.5 py-0.25 rounded bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-405 font-semibold text-[9px]">
                    Placement
                  </span>
                )}
                {node.isScreenMountable && (
                  <span className="px-1.5 py-0.25 rounded bg-purple-55 text-purple-600 dark:bg-purple-950/30 dark:text-purple-405 font-semibold text-[9px]">
                    Screen
                  </span>
                )}
                {node.categories.length > 0 && (
                  <span className="text-[10px] text-slate-450 font-mono">
                    [{node.categories.join(", ")}]
                  </span>
                )}
              </div>
              {node.children.length > 0 && renderPreviewTree(node.children)}
            </li>
          );
        })}
      </ul>
    );
  }

  // Recursive renderer
  function renderNodes(nodes: TreeNode[], depth = 0): React.ReactNode {
    return nodes.map((n) => {
      if (visible && !visible.has(n.id)) return null;
      const meta = nodeMeta(n.nodeType);
      const hasChildren = n.children.length > 0;
      const isOpen = query ? true : expanded.has(n.id);
      const isInactive = n.status === "inactive";
      let allowedChildren: string[] = ALLOWED_CHILDREN[n.nodeType] ?? [];
      if (flowSteps) {
        const currentStepIdx = flowSteps.findIndex((s) => s.level === n.nodeType);
        const hasNextStep = currentStepIdx !== -1 && currentStepIdx < flowSteps.length - 1;
        allowedChildren = hasNextStep ? [flowSteps[currentStepIdx + 1].level] : [];
      }

      return (
        <div key={n.id}>
          <div
            className={`group flex items-center gap-2 py-2.5 pr-3 border-b border-slate-100 hover:bg-slate-50 ${isInactive ? "opacity-50" : ""}`}
            style={{ paddingLeft: `${depth * 28 + 12}px` }}
          >
            {/* Expand toggle */}
            {hasChildren ? (
              <button
                onClick={() => toggle(n.id)}
                className="w-5 h-5 shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-700"
              >
                <span className={`text-[10px] transition-transform inline-block ${isOpen ? "rotate-90" : ""}`}>▶</span>
              </button>
            ) : (
              <span className="w-5 shrink-0" />
            )}

            {/* Icon */}
            <span className="text-base shrink-0">{meta.icon}</span>

            {/* Type badge */}
            <span className={`text-[10px] px-2 py-0.5 rounded font-semibold shrink-0 ${meta.badge}`}>
              {flowSteps.find((s) => s.level === n.nodeType)?.name || n.nodeType}
            </span>

            {/* Name + code */}
            <span className="text-sm font-medium text-slate-800 truncate">{n.name}</span>
            {n.code && (
              <span className="font-mono text-[11px] text-slate-400 shrink-0">{n.code}</span>
            )}

            {/* Category tag */}
            {n.category && (
              <div className="flex flex-col items-start gap-0.5 shrink-0">
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-655 font-medium">
                  {n.category.name}
                </span>
                {n.category.categoryAttributes && n.category.categoryAttributes.length > 0 && (
                  <span className="text-[9px] text-slate-400 font-mono pl-1 max-w-[200px] truncate" title={n.category.categoryAttributes.map((ca) => ca.attribute.name).join(", ")}>
                    {n.category.categoryAttributes.map((ca) => ca.attribute.name).join(", ")}
                  </span>
                )}
              </div>
            )}

            {/* Flags */}
            <div className="flex items-center gap-1.5 shrink-0">
              {n.isPlacementEligible && (
                <>
                  <span title="Placement eligible" className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 font-medium"> Placement</span>
                  {n.copies && n.copies.length > 0 ? (
                    n.copies.some((c) => c.copyRole === "UNIQUE") ? (
                      <span title="Contains Unique copy" className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-medium shadow-sm">
                         Unique
                      </span>
                    ) : (
                      <span title="Contains Copy" className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-750 border border-indigo-200 font-medium shadow-sm">
                         Copy
                      </span>
                    )
                  ) : (
                    <span title="Empty location" className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-250 font-medium">
                      ○ Empty
                    </span>
                  )}
                </>
              )}
              {n.isScreenMountable && (
                <span title="Screen mountable" className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-medium"> Screen</span>
              )}

            </div>

            {/* Status badge */}
            {isInactive && (
              <span className="text-[10px] text-slate-400 border border-slate-300 rounded px-1.5 shrink-0">inactive</span>
            )}

            {/* Child count */}
            {hasChildren && (
              <span className="text-xs text-slate-400 shrink-0 ml-auto mr-3">
                {n._count.children} sub
              </span>
            )}
            {n._count.copies > 0 && (
              <span className="text-xs text-slate-400 shrink-0">
                {n._count.copies} copies
              </span>
            )}

            {/* Hover actions */}
            <div className="ml-auto hidden group-hover:flex items-center gap-3 shrink-0">
              {canEdit && allowedChildren.length > 0 && (
                <Link href={newHref({ parentId: n.id })} className="text-xs text-brand-600 hover:underline whitespace-nowrap">
                  + Sub
                </Link>
              )}
              {canEdit && (
                <Link href={newHref({ editId: n.id })} className="text-xs text-slate-600 hover:underline">Edit</Link>
              )}
              {canEdit && (
                <button
                  onClick={() => toggleStatus(n)}
                  disabled={busy}
                  className="text-xs text-slate-500 hover:underline"
                >
                  {n.status === "active" ? "Deactivate" : "Activate"}
                </button>
              )}
              {canEdit && (
                <button
                  onClick={() => remove(n)}
                  disabled={busy}
                  className="text-xs text-red-600 hover:underline"
                >
                  Delete
                </button>
              )}
            </div>
          </div>

          {/* Children */}
          {isOpen && hasChildren && renderNodes(n.children, depth + 1)}
        </div>
      );
    });
  }

  if (!flowDefined) {
    return (
      <div className="space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Warehouse &amp; Locations</h1>
          <p className="text-sm text-slate-500 mt-1">
            Specify the hierarchical nomenclature flow for program <span className="font-semibold text-slate-700">{programName}</span>.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-md p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">Configure Onboarding Nomenclature &amp; Flow</h2>
            <p className="text-xs text-slate-500 mt-1">
              First define what the flow levels are (with Step ID, Name, Level and Datatype), and then proceed to define actual physical locations.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-650 flex items-center gap-2 shadow-sm">
            <span className="font-bold text-slate-800">Note:</span>
            <span>&quot;String&quot; refers to text, and &quot;Number&quot; refers to digits.</span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-150 bg-white/30">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 w-16">ID</th>
                  <th className="px-4 py-3">Level Name</th>
                  <th className="px-4 py-3 w-48">Node Level / Type</th>
                  <th className="px-4 py-3 w-64">Datatype / Function</th>
                  <th className="px-4 py-3 text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 bg-white/40">
                {flowSteps.map((step, idx) => (
                  <tr key={step.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-500 font-semibold">{step.id}</td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={step.name}
                        onChange={(e) => {
                          const next = [...flowSteps];
                          next[idx].name = e.target.value;
                          setFlowSteps(next);
                        }}
                        placeholder="e.g. Warehouse, Block, Rack..."
                        className="w-full rounded border border-slate-300 px-2.5 py-1.5 focus:ring-1 focus:ring-brand-500 bg-white text-xs font-semibold"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700 font-bold text-sm">
                      L{idx}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={step.datatype}
                        onChange={(e) => {
                          const next = [...flowSteps];
                          next[idx].datatype = e.target.value;
                          setFlowSteps(next);
                        }}
                        className="w-full rounded border border-slate-300 px-2.5 py-1.5 focus:ring-1 focus:ring-brand-500 bg-white text-xs font-semibold cursor-pointer"
                      >
                        <option value="String">String</option>
                        <option value="Number">Number</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          const next = flowSteps
                            .filter((x) => x.id !== step.id)
                            .map((x, i) => ({ ...x, id: `L${i + 1}`, level: `L${i}` }));
                          setFlowSteps(next);
                        }}
                        disabled={flowSteps.length <= 1}
                        className="text-xs text-red-500 hover:text-red-700 font-bold disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={() => {
                const nextId = `L${flowSteps.length + 1}`;
                setFlowSteps([...flowSteps, { id: nextId, name: "", level: `L${flowSteps.length}`, datatype: "String" }]);
              }}
              className="rounded-md border border-slate-300 text-slate-700 bg-white px-4 py-2 text-xs font-semibold hover:bg-slate-50 transition"
            >
              + Add Level
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                if (flowSteps.some((s) => !s.name.trim())) {
                  alert("Please enter names for all flow levels.");
                  return;
                }
                setBusy(true);
                const cleanedSteps = flowSteps.map((s, i) => ({
                  ...s,
                  level: `L${i}`,
                }));
                try {
                  const res = await fetch("/api/branch-programs/flow", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      branchId,
                      programId,
                      flowSteps: cleanedSteps,
                    }),
                  });
                  if (!res.ok) {
                    const data = await res.json();
                    alert(data.error || "Failed to save flow nomenclature.");
                    return;
                  }
                  localStorage.setItem(`wh_flow_${programId}`, JSON.stringify(cleanedSteps));
                  localStorage.setItem(`wh_flow_defined_${programId}`, "true");
                  setFlowSteps(cleanedSteps);
                  setFlowDefined(true);
                  router.refresh();
                } catch {
                  alert("Failed to save flow nomenclature.");
                } finally {
                  setBusy(false);
                }
              }}
              className="rounded-md bg-brand-600 text-white px-5 py-2.5 text-xs font-bold hover:bg-brand-700 transition disabled:opacity-50"
            >
              {busy ? "Saving..." : "Confirm Flow & Define Locations"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Warehouse &amp; Locations</h1>
        <p className="text-sm text-slate-500 mt-1">
          Building the location tree for program{" "}
          <span className="font-semibold text-slate-700">{programName}</span>. Hierarchy:{" "}
          <span className="font-semibold text-slate-700">{flowSteps.map((s) => s.name).join(" → ")}</span>. Each node can be flagged for product placement and/or screen mounting.
        </p>
      </div>

      {/* Visual Flow Indicator */}
      <div className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-4 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Active Nomenclature &amp; Onboarding Flow
          </span>
          <button
            onClick={() => {
              if (confirm("Are you sure you want to adjust the nomenclature flow? Your created locations will remain, but you can adjust the flow level structure.")) {
                localStorage.setItem(`wh_flow_defined_${programId}`, "false");
                setFlowDefined(false);
              }
            }}
            className="text-[11px] text-brand-600 hover:text-brand-855 font-bold hover:underline"
          >
            Adjust Flow Setup
          </button>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 py-1">
          {flowSteps.map((step, idx) => (
            <div key={step.id} className="flex items-center gap-3">
              <div className="flex flex-col bg-slate-55 border border-slate-200 rounded-lg p-2.5 shadow-xxs max-w-[200px]">
                <div className="text-[10px] font-bold text-slate-400 font-mono leading-none">{step.id}</div>
                <div className="text-xs font-bold text-slate-800 mt-1">{step.name}</div>
                <div className="flex gap-1.5 mt-1">
                  <span className="text-[9px] font-semibold text-brand-700 bg-brand-50 border border-brand-100 rounded px-1.5 py-0.25 uppercase">
                    {step.level}
                  </span>
                  <span className="text-[9px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.25">
                    {step.datatype.split(" ")[0]}
                  </span>
                </div>
              </div>
              {idx < flowSteps.length - 1 && (
                <span className="text-slate-400 font-bold text-sm">➔</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">No. of Blocks</div>
          <div className="mt-1 text-3xl font-bold text-slate-900">{blockCount}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">No. of Racks</div>
          <div className="mt-1 text-3xl font-bold text-slate-900">{rackCount}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Categories</div>
          <div className="mt-1 text-3xl font-bold text-slate-900">{totalCategories}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Quantity</div>
          <div className="mt-1 text-3xl font-bold text-slate-900">{totalQuantity}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search nodes..."
            className="w-full rounded-lg border border-slate-200 dark:border-slate-850 pl-9 pr-3 py-2 text-sm bg-white/60 dark:bg-slate-900/60 focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder-slate-400 text-slate-800 dark:text-slate-200 transition-all"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {warehouses.length > 0 && (
            <>
              <button
                onClick={() => setPendingAction("export_template")}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850 hover:border-slate-300 transition-all duration-200 shadow-sm cursor-pointer"
                title="Download blank template file"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Template</span>
              </button>
              
              <button
                onClick={() => setPendingAction("export_locations")}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850 hover:border-slate-300 transition-all duration-200 shadow-sm cursor-pointer"
                title="Export current location tree"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Locations</span>
              </button>
              
              {canEdit && (
                <button
                  onClick={() => setPendingAction("import")}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850 hover:border-slate-300 transition-all duration-200 shadow-sm cursor-pointer"
                  title="Import locations from Excel file"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import Locations</span>
                </button>
              )}
            </>
          )}

          {canEdit && (
            <Link
              href={newHref({})}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-700 transition-all duration-200 shadow-md shadow-brand-500/10 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Warehouse</span>
            </Link>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        {flowSteps.map((step) => {
          const meta = nodeMeta(step.level);
          return (
            <span key={step.id} className={`px-2 py-0.5 rounded font-semibold ${meta.badge}`} title={step.datatype}>
              {step.name}
            </span>
          );
        })}
        <span className="ml-2 text-slate-400">· Hover rows for actions</span>
      </div>

      {/* Main Container */}
      <div className="rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md overflow-hidden">
        {roots.length === 0 ? (
          <div className="px-4 py-16 text-center text-slate-400 text-sm">
            <div className="text-4xl mb-3"></div>
            No locations yet. Click <strong>Add Warehouse</strong> to build your location tree.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {renderNodes(roots)}
          </div>
        )}
      </div>

      {pendingAction && !showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 dark:border-slate-800/80 dark:bg-slate-950/95 backdrop-blur-xl p-6 shadow-2xl transition-all animate-in zoom-in-95 duration-200">
            {/* Close Button */}
            <button
              onClick={() => {
                setPendingAction(null);
                setSelectedWarehouseId("");
              }}
              className="absolute right-4 top-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {pendingAction === "export_template" ? "Export Template" : pendingAction === "export_locations" ? "Export Locations" : "Import Locations"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Select target warehouse to proceed</p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Warehouse</label>
                <select
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                  className="w-full rounded-lg border border-slate-205 dark:border-slate-800 p-2.5 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                >
                  <option value="">— Select Warehouse —</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} {w.code ? `(${w.code})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setPendingAction(null);
                    setSelectedWarehouseId("");
                  }}
                  className="flex-1 rounded-lg border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!selectedWarehouseId) return;
                    if (pendingAction === "export_template") {
                      handleExportTemplate(selectedWarehouseId);
                      setPendingAction(null);
                      setSelectedWarehouseId("");
                    } else if (pendingAction === "export_locations") {
                      handleExportLocations(selectedWarehouseId);
                      setPendingAction(null);
                      setSelectedWarehouseId("");
                    } else if (pendingAction === "import") {
                      setShowImportModal(true);
                    }
                  }}
                  disabled={!selectedWarehouseId}
                  className="flex-1 rounded-lg bg-brand-600 text-white px-4 py-2.5 text-xs font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50"
                >
                  Proceed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 dark:border-slate-800/80 dark:bg-slate-950/95 backdrop-blur-xl p-6 shadow-2xl transition-all animate-in zoom-in-95 duration-200">
            {/* Close Button */}
            <button
              onClick={() => {
                if (!importing) {
                  setShowImportModal(false);
                  setPendingAction(null);
                  setSelectedWarehouseId("");
                  setImportProgress("");
                  setImportError("");
                  setImportSuccess(null);
                  setPendingImportRows(null);
                  setPreviewRoots([]);
                }
              }}
              disabled={importing}
              className="absolute right-4 top-4 p-1.5 rounded-full text-slate-400 hover:text-slate-655 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors disabled:opacity-30 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Import Locations</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Importing into: <span className="font-semibold text-brand-600 dark:text-brand-400">
                      {warehouses.find(w => String(w.id) === String(selectedWarehouseId))?.name || ""}
                    </span>
                  </p>
                </div>
              </div>

              {!importing && !importSuccess && !importError && !pendingImportRows && (
                <div className="space-y-4">
                  {/* File Upload Dropzone */}
                  <label className="flex flex-col items-center justify-center w-full h-44 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-xl cursor-pointer bg-slate-50/50 dark:bg-slate-900/30 hover:bg-slate-50 dark:hover:bg-slate-900/50 hover:border-brand-400 transition-all duration-200 group">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                      <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 group-hover:scale-110 transition-transform duration-200 mb-2">
                        <Upload className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Click to upload spreadsheet</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">or drag and drop your file here</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 font-mono bg-slate-200/50 dark:bg-slate-850 px-2 py-0.5 rounded">.XLSX, .XLS files only</p>
                    </div>
                    <input
                      type="file"
                      accept=".xlsx, .xls"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) simulateImportFile(file);
                      }}
                    />
                  </label>
                  <p className="text-[11px] text-slate-405 leading-relaxed">
                    <strong>Note:</strong> Spreadsheet columns must map to active program steps starting from level 1 (e.g. <em>{flowSteps.slice(1).map(s => s.name).join(" → ")}</em>). Blank rows or rows without name cells will be skipped. Codes left blank will be auto-generated.
                  </p>
                </div>
              )}

              {importing && (
                <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center">
                  <Loader2 className="w-10 h-10 text-brand-600 animate-spin" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-850 dark:text-slate-200">Processing...</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{importProgress}</p>
                  </div>
                </div>
              )}

              {!importing && pendingImportRows && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 p-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Import Preview</h4>
                    <div className="max-h-56 overflow-y-auto border border-slate-205 dark:border-slate-800 rounded-lg p-3 bg-white/60 dark:bg-slate-950/60 shadow-inner">
                      {previewRoots.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-6">
                          🎉 All locations in the spreadsheet already exist in this warehouse. No new locations will be created.
                        </p>
                      ) : (
                        renderPreviewTree(previewRoots)
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setPendingImportRows(null);
                        setPreviewRoots([]);
                      }}
                      className="flex-1 rounded-lg border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={executeImport}
                      className="flex-1 rounded-lg bg-brand-600 text-white px-4 py-2.5 text-xs font-semibold hover:bg-brand-700 transition-colors"
                    >
                      Confirm &amp; Import
                    </button>
                  </div>
                </div>
              )}

              {importSuccess && (
                <div className="flex flex-col items-center justify-center py-6 space-y-4 text-center animate-in fade-in-50 zoom-in-95 duration-300">
                  <div className="p-3 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-base font-bold text-slate-800 dark:text-slate-100">Import Completed Successfully!</p>
                    <div className="flex gap-4 justify-center text-xs">
                      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg px-4 py-2">
                        <div className="font-semibold text-slate-400">Matched / Reused</div>
                        <div className="text-lg font-bold text-slate-700 dark:text-slate-300">{importSuccess.matched}</div>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg px-4 py-2">
                        <div className="font-semibold text-slate-400">Newly Created</div>
                        <div className="text-lg font-bold text-brand-600 dark:text-brand-400">{importSuccess.created}</div>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      setPendingAction(null);
                      setSelectedWarehouseId("");
                      setImportSuccess(null);
                    }}
                    className="w-full rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-950 px-4 py-2.5 text-xs font-semibold hover:opacity-90 transition-opacity"
                  >
                    Close &amp; Reload Tree
                  </button>
                </div>
              )}

              {importError && (
                <div className="flex flex-col items-center justify-center py-6 space-y-4 text-center animate-in fade-in-50 zoom-in-95 duration-300">
                  <div className="p-3 rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
                    <AlertCircle className="w-10 h-10" />
                  </div>
                  <div className="space-y-2 w-full">
                    <p className="text-base font-bold text-slate-850 dark:text-slate-100">Import Failed</p>
                    <div className="rounded-lg bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50 p-3 text-left">
                      <p className="text-xs text-rose-700 dark:text-rose-400 font-medium break-words leading-relaxed">{importError}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full">
                    <button
                      onClick={() => {
                        setImportError("");
                        setImportSuccess(null);
                      }}
                      className="flex-1 rounded-lg border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                    >
                      Try Again
                    </button>
                    <button
                      onClick={() => {
                        setShowImportModal(false);
                        setPendingAction(null);
                        setSelectedWarehouseId("");
                        setImportError("");
                        setImportSuccess(null);
                      }}
                      className="flex-1 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-950 px-4 py-2.5 text-xs font-semibold hover:opacity-90 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

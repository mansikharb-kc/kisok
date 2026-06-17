// Shared warehouse/location constants & helpers (used by the tree + the node form page).

export type LocationNode = {
  id: string;
  parentId: string | null;
  nodeType: string;
  name: string;
  code: string | null;
  categoryId: string | null;
  category: {
    id: string;
    name: string;
    code: string;
    categoryAttributes?: { attribute: { name: string; code: string } }[];
  } | null;
  path: string | null;
  depth: number;
  isPlacementEligible: boolean;
  isScreenMountable: boolean;
  locationId: string | null;
  status: string;
  _count: { children: number; copies: number };
  copies?: { copyRole: string }[];
};

export type CategoryOption = {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
  categoryAttributes?: { attribute: { id: string; name: string; code: string } }[];
};

export const NODE_TYPES = ["WAREHOUSE", "BLOCK", "RACK", "TRAY", "CUSTOM"] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export const NODE_META: Record<NodeType, { badge: string; icon: string; desc: string }> = {
  WAREHOUSE: { badge: "bg-purple-100 text-purple-700", icon: "", desc: "Top-level warehouse / zone" },
  BLOCK:     { badge: "bg-indigo-100 text-indigo-700", icon: "", desc: "Block (docket) — carries the RMS screen" },
  RACK:      { badge: "bg-amber-100 text-amber-700",   icon: "", desc: "Rack — placement eligible" },
  TRAY:      { badge: "bg-green-100 text-green-700",   icon: "", desc: "Tray — placement eligible" },
  CUSTOM:    { badge: "bg-slate-100 text-slate-600",   icon: "", desc: "Custom node type" },
};

export function nodeMeta(type: string) {
  return NODE_META[type as NodeType] ?? NODE_META.CUSTOM;
}

function cleanCodeSegment(name: string): string {
  return name.replace(/\s+/g, "-").replace(/[^A-Za-z0-9_-]/g, "").replace(/-+/g, "-");
}

export function combineCode(parentCode: string, segment: string): string {
  const parent = parentCode.trim();
  const child = cleanCodeSegment(segment);
  if (!parent) return child;
  if (parent.endsWith("-") || child.startsWith("-")) return `${parent}${child}`.replace(/-+/g, "-");
  return `${parent}-${child}`;
}

// WAREHOUSE -> BLOCK -> RACK -> TRAY -> CUSTOM
export const ALLOWED_CHILDREN: Record<string, NodeType[]> = {
  WAREHOUSE: ["BLOCK", "RACK", "CUSTOM"],
  BLOCK:     ["RACK", "CUSTOM"],
  RACK:      ["TRAY", "CUSTOM"],
  TRAY:      ["CUSTOM"],
  CUSTOM:    ["CUSTOM", "RACK", "TRAY"],
};

export const ALLOWED_ROOT_TYPES: NodeType[] = ["WAREHOUSE"];

export const DEFAULT_FLAGS: Record<string, { isPlacementEligible: boolean; isScreenMountable: boolean }> = {
  WAREHOUSE: { isPlacementEligible: false, isScreenMountable: false },
  BLOCK:     { isPlacementEligible: false, isScreenMountable: true },
  RACK:      { isPlacementEligible: true,  isScreenMountable: false },
  TRAY:      { isPlacementEligible: true,  isScreenMountable: false },
  CUSTOM:    { isPlacementEligible: false, isScreenMountable: false },
};

export const CAT_LEVELS = ["Domain", "Group", "Family", "Category", "Sub-Category"];

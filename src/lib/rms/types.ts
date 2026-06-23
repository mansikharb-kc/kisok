// RMS shared types. Phase: P1.0
// TODO: flesh out as each phase is built.

export type RmsScreenContext = {
  screenId: string;
  token: string;
  branchId: string;
  branchName: string;
  blockNodeId: string;
  locationPath: string; // e.g. "3rd Floor | Block D | Rack 2"
};

export type DiscoveryMode = "rack" | "category" | "brand" | "product";

// TODO: RmsProduct, RmsCategory, RmsBrand, BomItem, RmsEvent, Recommendation
export {};

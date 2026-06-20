// Role definitions, navigation, and permission helpers — derived from the
// PRD trickle-down model (L1 HO → L2 Branch → L3 Operate).

export type RoleCode =
  | "HO_ADMIN"
  | "BRANCH_ADMIN"
  | "ONB_LEAD"
  | "CONSIGNMENT_USER"
  | "OB_EXEC"
  | "PROJECT_USER"
  | "CONCIERGE_MANAGER";

export const ROLE_LABELS: Record<RoleCode, string> = {
  HO_ADMIN: "KC HO Admin",
  BRANCH_ADMIN: "KC Branch Admin",
  ONB_LEAD: "Onboarding Lead",
  CONSIGNMENT_USER: "Consignment User",
  OB_EXEC: "Onboarding Exec",
  PROJECT_USER: "Project User",
  CONCIERGE_MANAGER: "Concierge Manager",
};

export type NavItem = {
  href: string;
  label: string;
  group: string;
  roles: RoleCode[];
};

// Sidebar navigation — each item lists which roles may see it.
export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", group: "Overview", roles: ["HO_ADMIN", "BRANCH_ADMIN", "ONB_LEAD", "CONSIGNMENT_USER", "OB_EXEC", "PROJECT_USER", "CONCIERGE_MANAGER"] },
  { href: "/archived", label: "Archived", group: "Overview", roles: ["HO_ADMIN"] },

  // L1 — HO masters (Branch Admin: view only, enforced in each page)
  { href: "/masters/categories",       label: "Categories",       group: "HO Masters", roles: ["HO_ADMIN", "BRANCH_ADMIN", "ONB_LEAD", "OB_EXEC", "PROJECT_USER", "CONCIERGE_MANAGER"] },
  { href: "/masters/attributes",       label: "Attributes",       group: "HO Masters", roles: ["HO_ADMIN", "BRANCH_ADMIN"] },
  { href: "/masters/brands",           label: "Brands",           group: "HO Masters", roles: ["HO_ADMIN", "BRANCH_ADMIN"] },
  { href: "/masters/programs",         label: "Programs",         group: "HO Masters", roles: ["HO_ADMIN", "BRANCH_ADMIN"] },
  { href: "/masters/sticker-templates",label: "Sticker Templates",group: "HO Masters", roles: ["HO_ADMIN", "BRANCH_ADMIN"] },
  { href: "/masters/branches",         label: "Branches",         group: "HO Masters", roles: ["HO_ADMIN"] },
  { href: "/approvals",                label: "Approvals",        group: "HO Masters", roles: ["HO_ADMIN"] },

  // L2 — Branch config (Branch Admin full CRUD)
  { href: "/branch/warehouse", label: "Warehouse & Locations", group: "Branch Setup", roles: ["BRANCH_ADMIN"] },

  // L2 — Read-only visibility into ops for Branch Admin (PRD §8: view sellers/assignments)
  { href: "/branch/programs", label: "Programs (select)", group: "Branch Setup", roles: ["BRANCH_ADMIN"] },
  { href: "/branch/sellers",     label: "Sellers (view)",     group: "Branch Setup", roles: ["BRANCH_ADMIN"] },
  { href: "/branch/assignments", label: "Assignments (view)", group: "Branch Setup", roles: ["BRANCH_ADMIN"] },

  // L3 — Operations
  { href: "/ops/sellers",       label: "Sellers",          group: "Operations", roles: ["ONB_LEAD"] },
  { href: "/ops/assignments",   label: "Assignments",      group: "Operations", roles: ["ONB_LEAD"] },
  { href: "/ops/sample-sizes",  label: "Sample Sizes",     group: "Operations", roles: ["ONB_LEAD"] },
  { href: "/ops/onboarding",    label: "Product Onboarding",group: "Operations", roles: ["OB_EXEC"] },
  { href: "/ops/placement",     label: "Placement & QR",   group: "Operations", roles: ["OB_EXEC"] },
  { href: "/ops/consignments",  label: "Consignments / QC",group: "Operations", roles: ["CONSIGNMENT_USER", "OB_EXEC"] },
  { href: "/ops/activity",      label: "Activity",         group: "Operations", roles: ["OB_EXEC", "ONB_LEAD"] },
  { href: "/ops/flags",         label: "Flags",            group: "Operations", roles: ["HO_ADMIN", "BRANCH_ADMIN", "ONB_LEAD", "OB_EXEC"] },
  { href: "/ops/tickets",       label: "Tickets",          group: "Operations", roles: ["PROJECT_USER", "CONCIERGE_MANAGER"] },

  // Admin
  { href: "/users/role/ho-admin", label: "HO Admins", group: "Users", roles: ["HO_ADMIN"] },
  { href: "/users/role/branch-admin", label: "Branch Admins", group: "Users", roles: ["HO_ADMIN"] },
  { href: "/users/role/onb-lead", label: "Onboarding Leads", group: "Users", roles: ["HO_ADMIN", "BRANCH_ADMIN"] },
  { href: "/users/role/consignment-user", label: "Consignment Users", group: "Users", roles: ["HO_ADMIN", "BRANCH_ADMIN"] },
  { href: "/users/role/ob-exec", label: "Onboarding Execs", group: "Users", roles: ["HO_ADMIN", "BRANCH_ADMIN"] },
  { href: "/users/role/project-user", label: "Project Users", group: "Users", roles: ["HO_ADMIN", "BRANCH_ADMIN"] },
  { href: "/users/role/concierge-manager", label: "Concierge Managers", group: "Users", roles: ["HO_ADMIN", "BRANCH_ADMIN"] },
];

export type SessionRole = { code: RoleCode; branchId: string | null };

export function hasRole(roles: SessionRole[], ...codes: RoleCode[]): boolean {
  return roles.some((r) => codes.includes(r.code));
}

export function navForRoles(roles: SessionRole[]): NavItem[] {
  const codes = new Set(roles.map((r) => r.code));
  return NAV.filter((n) => n.roles.some((r) => codes.has(r)));
}

export function canSee(path: string, roles: SessionRole[]): boolean {
  const codes = new Set(roles.map((r) => r.code));
  const item = NAV.find((n) => path === n.href || path.startsWith(n.href + "/"));
  if (!item) return true; // non-nav pages handled by page-level checks
  return item.roles.some((r) => codes.has(r));
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { NavItem } from "@/lib/rbac";

function Chevron({ dir }: { dir: "up" | "left" | "right" }) {
  const rot = dir === "up" ? "rotate(0deg)" : dir === "left" ? "rotate(90deg)" : "rotate(-90deg)";
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: rot, transition: "transform 0.2s ease" }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// Minimal line icon per route (used for the collapsed icon-rail).
function NavIcon({ href }: { href: string }) {
  const p: Record<string, string> = {
    dashboard: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
    categories: "M12 2 2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
    attributes: "M20.59 13.41 11 3.83V2h-1.83L2 9.17 11.59 18.76a2 2 0 0 0 2.83 0l6.17-6.17a2 2 0 0 0 0-2.18zM7 9a1 1 0 1 1 0-2 1 1 0 0 1 0 2z",
    brands: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z M3.27 6.96 12 12.01l8.73-5.05 M12 22.08V12",
    programs: "M9 11H3v10h6zM21 3h-6v18h6zM15 8H9v13h6z",
    sticker: "M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zM7 7h10M7 12h10M7 17h6",
    branches: "M3 21h18M5 21V7l8-4v18M19 21V11l-6-4",
    approvals: "M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3",
    warehouse: "M3 21V8l9-5 9 5v13M3 21h18M9 21v-6h6v6",
    sellers: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
    assignments: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
    sizes: "M21 3 3 21M9 3H3v6M21 15v6h-6",
    consignments: "M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
    onboarding: "M16.5 9.4 7.5 4.21M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.27 6.96 12 12.01l8.73-5.05M12 22.08V12",
    placement: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    archived: "M21 8v13H3V8M23 3H1v5h22zM10 12h4",
    flags: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z M4 22v-7",
  };
  let key = "dashboard";
  if (href.includes("categories")) key = "categories";
  else if (href.includes("attributes")) key = "attributes";
  else if (href.includes("brands")) key = "brands";
  else if (href.includes("programs")) key = "programs";
  else if (href.includes("sticker")) key = "sticker";
  else if (href.includes("branches")) key = "branches";
  else if (href.includes("approvals")) key = "approvals";
  else if (href.includes("warehouse")) key = "warehouse";
  else if (href.includes("sellers")) key = "sellers";
  else if (href.includes("assignments")) key = "assignments";
  else if (href.includes("sample-sizes")) key = "sizes";
  else if (href.includes("consignments")) key = "consignments";
  else if (href.includes("onboarding")) key = "onboarding";
  else if (href.includes("placement")) key = "placement";
  else if (href.includes("users")) key = "users";
  else if (href.includes("archived")) key = "archived";
  else if (href.includes("flags")) key = "flags";
  else if (href.includes("dashboard")) key = "dashboard";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {p[key].split(/(?=M)/).map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

// Pick a representative icon for a whole group (used in the collapsed rail).
function groupIconHref(group: string): string {
  switch (group) {
    case "Overview": return "/dashboard";
    case "HO Masters": return "/masters/categories";
    case "Branch Setup": return "/branch/warehouse";
    case "Operations": return "/ops/onboarding";
    case "Users": return "/users";
    default: return "/dashboard";
  }
}

function ThemeIcon({ dark }: { dark: boolean }) {
  return dark ? (
    // moon
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ) : (
    // sun
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function NavGroup({ name, items, pathname }: { name: string; items: NavItem[]; pathname: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-2 mb-1 group">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/75 group-hover:text-white transition-colors">
          {name}
        </span>
        <span className="text-white/75 group-hover:text-white transition-colors">
          <Chevron dir={open ? "up" : "left"} />
        </span>
      </button>
      <div style={{ overflow: "hidden", maxHeight: open ? "600px" : "0px", transition: "max-height 0.25s ease" }}>
        <div className="space-y-0.5">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded px-3 py-2 text-sm transition ${
                  active ? "bg-white/15 text-white font-medium" : "text-white hover:bg-white/5"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({ nav, user }: { nav: NavItem[]; user: { name: string; roleLabels: string[] } }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("kc_sidebar_collapsed") === "1");
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("kc_sidebar_collapsed", next ? "1" : "0");
      return next;
    });
  }
  function toggleTheme() {
    setDark((d) => {
      const next = !d;
      localStorage.setItem("kc_theme", next ? "dark" : "light");
      document.documentElement.classList.toggle("dark", next);
      return next;
    });
  }

  const groups: { name: string; items: NavItem[] }[] = [];
  for (const item of nav) {
    let g = groups.find((x) => x.name === item.group);
    if (!g) { g = { name: item.group, items: [] }; groups.push(g); }
    g.items.push(item);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside
      className={`glass-dark text-slate-300 flex flex-col h-screen sticky top-0 shrink-0 transition-[width] duration-200 ${
        collapsed ? "w-14" : "w-64"
      }`}
    >
      {/* Header with collapse toggle */}
      <div className={`flex items-center px-3 py-5 border-b border-white/10 ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed && (
          <Link href="/dashboard" className="min-w-0">
            <div className="text-white font-bold tracking-tight">KC IMS</div>
            <div className="text-[11px] text-white/60 uppercase tracking-wider">Inventory Management</div>
          </Link>
        )}
        <button
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="text-white/80 hover:text-white shrink-0 w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 focus:outline-none"
        >
          <Chevron dir={collapsed ? "right" : "left"} />
        </button>
      </div>

      {/* Nav (hidden when collapsed) */}
      {!collapsed ? (
        <nav className="flex-1 overflow-y-auto scrollbar-hide px-3 py-4 space-y-5">
          {groups.map((g) => (
            <NavGroup key={g.name} name={g.name} items={g.items} pathname={pathname} />
          ))}
        </nav>
      ) : (
        <nav className="flex-1 overflow-y-auto scrollbar-hide py-4 flex flex-col items-center gap-1">
          {groups.map((g) => {
            const active = g.items.some(
              (item) => pathname === item.href || pathname.startsWith(item.href + "/")
            );
            return (
              <button
                key={g.name}
                onClick={() => toggle()}
                title={g.name}
                className={`w-10 h-10 flex items-center justify-center rounded transition ${
                  active ? "bg-white/15 text-white" : "text-white/80 hover:bg-white/5 hover:text-white"
                }`}
              >
                <NavIcon href={groupIconHref(g.name)} />
              </button>
            );
          })}
        </nav>
      )}

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/10">
        {!collapsed ? (
          <>
            <div className="text-sm text-white font-medium truncate">{user.name}</div>
            <div className="text-[11px] text-white/70 truncate">{user.roleLabels.join(", ")}</div>
            <button
              onClick={toggleTheme}
              className="mt-3 w-full rounded border border-white/15 text-white text-xs py-1.5 hover:bg-white/5 flex items-center justify-center gap-2"
            >
              <ThemeIcon dark={dark} />
              {dark ? "Light mode" : "Dark mode"}
            </button>
            <button onClick={logout} className="mt-2 w-full rounded border border-white/15 text-white text-xs py-1.5 hover:bg-white/5">
              Sign out
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={toggleTheme}
              title={dark ? "Light mode" : "Dark mode"}
              className="w-full flex justify-center text-white/80 hover:text-white py-1.5 rounded hover:bg-white/10 focus:outline-none"
            >
              <ThemeIcon dark={dark} />
            </button>
            <button onClick={logout} aria-label="Sign out" className="w-full flex justify-center text-white/80 hover:text-white py-1.5 rounded hover:bg-white/10 focus:outline-none">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

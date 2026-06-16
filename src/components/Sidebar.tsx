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

function NavGroup({ name, items, pathname }: { name: string; items: NavItem[]; pathname: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-2 mb-1 group">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 group-hover:text-slate-300 transition-colors">
          {name}
        </span>
        <span className="text-slate-500 group-hover:text-slate-300 transition-colors">
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
                  active ? "bg-white/15 text-white font-medium" : "text-slate-300 hover:bg-white/5 hover:text-white"
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

  useEffect(() => {
    setCollapsed(localStorage.getItem("kc_sidebar_collapsed") === "1");
  }, []);
  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("kc_sidebar_collapsed", next ? "1" : "0");
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
      <div className="flex items-center justify-between px-3 py-5 border-b border-white/10">
        {!collapsed && (
          <Link href="/dashboard" className="min-w-0">
            <div className="text-white font-bold tracking-tight">KC IMS</div>
            <div className="text-[11px] text-slate-400 uppercase tracking-wider">Inventory Management</div>
          </Link>
        )}
        {collapsed && <span className="text-white font-bold text-sm mx-auto">KC</span>}
        <button
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="text-slate-400 hover:text-white shrink-0 p-1 rounded hover:bg-white/10"
        >
          <Chevron dir={collapsed ? "right" : "left"} />
        </button>
      </div>

      {/* Nav (hidden when collapsed) */}
      {!collapsed && (
        <nav className="flex-1 overflow-y-auto scrollbar-hide px-3 py-4 space-y-5">
          {groups.map((g) => (
            <NavGroup key={g.name} name={g.name} items={g.items} pathname={pathname} />
          ))}
        </nav>
      )}
      {collapsed && <div className="flex-1" />}

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/10">
        {!collapsed ? (
          <>
            <div className="text-sm text-white font-medium truncate">{user.name}</div>
            <div className="text-[11px] text-slate-400 truncate">{user.roleLabels.join(", ")}</div>
            <button onClick={logout} className="mt-3 w-full rounded border border-white/15 text-slate-300 text-xs py-1.5 hover:bg-white/5">
              Sign out
            </button>
          </>
        ) : (
          <button onClick={logout} aria-label="Sign out" className="w-full flex justify-center text-slate-400 hover:text-white py-1.5 rounded hover:bg-white/10">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        )}
      </div>
    </aside>
  );
}

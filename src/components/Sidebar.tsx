"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { NavItem } from "@/lib/rbac";

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: open ? "rotate(0deg)" : "rotate(-90deg)",
        transition: "transform 0.2s ease",
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function NavGroup({
  name,
  items,
  pathname,
}: {
  name: string;
  items: NavItem[];
  pathname: string;
}) {
  const hasActive = items.some(
    (item) =>
      pathname === item.href || pathname.startsWith(item.href + "/")
  );
  const [open, setOpen] = useState(true);

  return (
    <div>
      {/* Group header with toggle arrow */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-2 mb-1 group"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 group-hover:text-slate-400 transition-colors">
          {name}
        </span>
        <span className="text-slate-500 group-hover:text-slate-400 transition-colors">
          <ChevronIcon open={open} />
        </span>
      </button>

      {/* Collapsible items */}
      <div
        style={{
          overflow: "hidden",
          maxHeight: open ? "500px" : "0px",
          transition: "max-height 0.25s ease",
        }}
      >
        <div className="space-y-0.5">
          {items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-md px-3 py-2 text-sm transition ${
                  active
                    ? "bg-brand-600 text-white"
                    : "hover:bg-white/5 hover:text-white"
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

export default function Sidebar({
  nav,
  user,
}: {
  nav: NavItem[];
  user: { name: string; roleLabels: string[] };
}) {
  const pathname = usePathname();
  const router = useRouter();

  // Group nav items by their `group`, preserving order.
  const groups: { name: string; items: NavItem[] }[] = [];
  for (const item of nav) {
    let g = groups.find((x) => x.name === item.group);
    if (!g) {
      g = { name: item.group, items: [] };
      groups.push(g);
    }
    g.items.push(item);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="w-64 shrink-0 bg-brand-900 text-slate-300 flex flex-col h-screen sticky top-0">
      <Link href="/dashboard" className="px-5 py-5 border-b border-white/10 block hover:bg-white/5 transition-colors">
        <div className="text-white font-bold tracking-tight">KC IMS</div>
        <div className="text-[11px] text-slate-400 uppercase tracking-wider">
          Inventory Management
        </div>
      </Link>

      <nav className="flex-1 overflow-y-auto scrollbar-hide px-3 py-4 space-y-5">
        {groups.map((g) => (
          <NavGroup
            key={g.name}
            name={g.name}
            items={g.items}
            pathname={pathname}
          />
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-white/10">
        <div className="text-sm text-white font-medium truncate">{user.name}</div>
        <div className="text-[11px] text-slate-400 truncate">
          {user.roleLabels.join(", ")}
        </div>
        <button
          onClick={logout}
          className="mt-3 w-full rounded-md border border-white/15 text-slate-300 text-xs py-1.5 hover:bg-white/5"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}

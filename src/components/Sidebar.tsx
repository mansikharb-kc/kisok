"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { NavItem } from "@/lib/rbac";

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
      <div className="px-5 py-5 border-b border-white/10">
        <div className="text-white font-bold tracking-tight">KC IMS</div>
        <div className="text-[11px] text-slate-400 uppercase tracking-wider">
          Inventory Management
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {groups.map((g) => (
          <div key={g.name}>
            <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              {g.name}
            </div>
            <div className="space-y-0.5">
              {g.items.map((item) => {
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

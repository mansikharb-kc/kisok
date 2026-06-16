"use client";

import { usePathname } from "next/navigation";
import { NAV } from "@/lib/rbac";

// Turn a raw path segment into a readable title (fallback for non-nav pages).
function prettify(segment: string): string {
  return segment
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function TopBar() {
  const pathname = usePathname();

  // Find the most specific NAV item that matches the current path.
  const match = NAV.filter(
    (n) => pathname === n.href || pathname.startsWith(n.href + "/")
  ).sort((a, b) => b.href.length - a.href.length)[0];

  let group = match?.group ?? "";
  let label = match?.label ?? prettify(pathname.split("/").filter(Boolean).pop() ?? "Dashboard");

  // Deeper pages (e.g. /ops/onboarding/new) — show the leaf as the page title.
  if (match && pathname !== match.href) {
    const leaf = pathname.slice(match.href.length).split("/").filter(Boolean)[0];
    if (leaf && !/^\d+$/.test(leaf)) {
      group = match.label;
      label = prettify(leaf);
    }
  }

  return (
    <header className="sticky top-0 z-20 glass border-b border-slate-200/70">
      <div className="max-w-6xl mx-auto w-full px-8 h-14 flex items-center justify-between">
        <nav className="flex items-center gap-2 text-sm min-w-0">
          {group && (
            <>
              <span className="text-slate-400 truncate">{group}</span>
              <span className="text-slate-300">/</span>
            </>
          )}
          <span className="font-semibold text-slate-800 truncate">{label}</span>
        </nav>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.jpeg" alt="KC IMS" className="h-7 w-auto shrink-0 object-contain" />
      </div>
    </header>
  );
}

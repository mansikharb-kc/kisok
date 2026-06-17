"use client";

import { useMemo, useState } from "react";

type Item = { id: string; label: string; tone: string; target?: string | null; actor: string; when: string };

export default function RecentActivityClient({ items, emptyHint }: { items: Item[]; emptyHint: string }) {
  const [actor, setActor] = useState("");
  const [q, setQ] = useState("");

  const actors = useMemo(() => [...new Set(items.map((i) => i.actor))].sort(), [items]);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return items.filter(
      (i) =>
        (!actor || i.actor === actor) &&
        (!t || `${i.label} ${i.target ?? ""} ${i.actor}`.toLowerCase().includes(t))
    );
  }, [items, actor, q]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-700">Recent Activity</h2>
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search activity…"
            className="rounded-md border border-slate-300 bg-white/60 backdrop-blur-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <select
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            className="rounded-md border border-slate-300 bg-white/60 backdrop-blur-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All people</option>
            {actors.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md divide-y divide-slate-100">
        {items.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-400">No activity yet. {emptyHint}</div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-400">No activity matches the filter.</div>
        ) : (
          filtered.map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-4 py-3">
              <span className={`w-2 h-2 rounded-full shrink-0 ${a.tone}`} />
              <div className="text-sm min-w-0">
                <span className="font-medium text-slate-800">{a.label}</span>
                {a.target && <span className="text-slate-600"> {a.target}</span>}
              </div>
              <span className="ml-auto text-xs text-slate-400 whitespace-nowrap">{a.actor} · {a.when}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

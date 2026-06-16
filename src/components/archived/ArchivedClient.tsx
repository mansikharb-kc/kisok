"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import IconButton from "@/components/ui/IconButton";

export type ArchivedItem = { id: string; name: string; sub?: string | null };
export type ArchivedGroup = { entity: string; label: string; items: ArchivedItem[] };

export default function ArchivedClient({ groups }: { groups: ArchivedGroup[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function restore(entity: string, id: string) {
    setBusy(true);
    await fetch("/api/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity, id, action: "restore" }),
    });
    setBusy(false);
    router.refresh();
  }

  const total = groups.reduce((s, g) => s + g.items.length, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Archived</h1>
        <p className="text-sm text-slate-500 mt-1">Archived items are hidden from their lists. Restore brings them back as active.</p>
      </div>

      {total === 0 ? (
        <div className="rounded border border-dashed border-slate-300 bg-white/60 backdrop-blur-md p-10 text-center text-sm text-slate-400">
          Nothing archived. Items you archive will appear here for restore.
        </div>
      ) : (
        groups
          .filter((g) => g.items.length > 0)
          .map((g) => (
            <div key={g.entity} className="rounded border border-slate-200 bg-white/60 backdrop-blur-md overflow-hidden">
              <div className="px-4 py-2 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {g.label} <span className="text-slate-400">· {g.items.length}</span>
              </div>
              <div className="divide-y divide-slate-100">
                {g.items.map((it) => (
                  <div key={it.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-800 truncate">{it.name}</div>
                      {it.sub ? <div className="font-mono text-[11px] text-slate-400">{it.sub}</div> : null}
                    </div>
                    <IconButton kind="restore" tone="success" title="Restore" disabled={busy} onClick={() => restore(g.entity, it.id)} />
                  </div>
                ))}
              </div>
            </div>
          ))
      )}
    </div>
  );
}

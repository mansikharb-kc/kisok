"use client";

import { useState } from "react";

export default function BrandDetailLogo({ url, name }: { url: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const initials = name.trim().slice(0, 2).toUpperCase();

  if (url && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} onError={() => setFailed(true)} className="h-16 w-16 shrink-0 rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md object-contain" />;
  }

  return <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white">{initials}</div>;
}

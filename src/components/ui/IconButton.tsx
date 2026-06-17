"use client";

import React from "react";

type Kind = "edit" | "delete" | "retire" | "activate" | "approve" | "reject" | "view" | "add" | "archive" | "restore";
type Tone = "default" | "primary" | "danger" | "success";

const PATHS: Record<Kind, React.ReactNode> = {
  edit: (<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>),
  delete: (<><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>),
  archive: (<><rect x="3" y="3" width="18" height="5" rx="1" /><path d="M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" /><path d="M12 11v6" /><path d="m9 14 3 3 3-3" /></>),
  restore: (<><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></>),
  retire: (<><path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" /></>),
  activate: (<><path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" /></>),
  approve: (<polyline points="20 6 9 17 4 12" />),
  reject: (<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>),
  view: (<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>),
  add: (<><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>),
};

const TONE: Record<Tone, string> = {
  default: "text-slate-600 hover:bg-slate-50 border-slate-200",
  primary: "text-brand-600 hover:bg-slate-50 border-slate-200",
  danger: "text-rose-600 hover:bg-rose-50 border-rose-200",
  success: "text-emerald-600 hover:bg-emerald-50 border-emerald-200",
};

export default function IconButton({
  kind,
  title,
  tone = "default",
  onClick,
  disabled,
}: {
  kind: Kind;
  title: string;
  tone?: Tone;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-8 w-8 items-center justify-center rounded border ${TONE[tone]} transition-colors disabled:opacity-50`}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {PATHS[kind]}
      </svg>
    </button>
  );
}

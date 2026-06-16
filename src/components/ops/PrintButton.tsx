"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-lg bg-brand-600 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-700 transition-colors shadow-sm"
    >
      <Printer className="h-4 w-4" />
      Print Profile / Save PDF
    </button>
  );
}

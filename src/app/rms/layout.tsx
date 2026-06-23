// RMS root layout — own theme/shell, NO IMS sidebar/login, fullscreen kiosk.
// Phase: P1.0  (TODO: apply rmsTheme, PWA hooks, idle-reset, fonts)
import type { ReactNode } from "react";

export default function RmsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f6f5fa] text-[#1e1b2e] select-none">
      {children}
    </div>
  );
}

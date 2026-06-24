// Per-screen kiosk wrapper. Phase: P1.2
// TODO (P1.1 security): device-activation guard here — if device not approved, render <DeviceGate/>.
import type { ReactNode } from "react";

export default function ScreenLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen">{children}</div>;
}

// Per-screen layout — device-activation guard + block context + location top bar.
// Phase: P1.1
// TODO:
//  - resolve screen by token (lib/rms/queries.getScreenByToken)
//  - check device-activation cookie; if not approved -> render <DeviceGate/> (pending/denied)
//  - provide RmsScreenContext to children
import type { ReactNode } from "react";
import RmsTopBar from "@/components/rms/RmsTopBar";

export default function ScreenLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { token: string };
}) {
  return (
    <div>
      <RmsTopBar token={params.token} />
      <main>{children}</main>
    </div>
  );
}

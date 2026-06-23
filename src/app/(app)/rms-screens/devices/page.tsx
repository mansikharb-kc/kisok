// Admin — device approval queue for the branch's screens. Phase: P1.1
// Access: Branch Admin + SCREEN_MANAGER (their branch only).
// TODO: list pending device requests, Approve / Reject / Revoke.
export const dynamic = "force-dynamic";

export default function RmsDevicesAdminPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold text-slate-900">Screen Devices</h1>
      <p className="text-sm text-slate-500">
        Scaffold — Phase 1.1. Approve / reject / revoke device activation requests.
      </p>
    </div>
  );
}

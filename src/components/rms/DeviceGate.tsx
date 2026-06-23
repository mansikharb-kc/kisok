// Device activation gate — shown when a device is not yet approved. Phase: P1.1
// TODO: show "Pending approval", create device access request (POST /api/rms/device),
//       poll status; block content until Screen Manager approves.
export default function DeviceGate({ token }: { token: string }) {
  return (
    <section className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <h2 className="text-xl font-bold">Pending approval</h2>
      <p className="mt-2 text-sm text-[#6b7280]">
        This screen is awaiting approval from the branch Screen Manager. (scaffold · {token})
      </p>
    </section>
  );
}

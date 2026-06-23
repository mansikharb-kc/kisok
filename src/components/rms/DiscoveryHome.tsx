// RMS Home — "What's in this Rack" + 3 mode cards (By Category / By Brand / By Product). Phase: P1.2
// TODO: branch welcome, 3 gradient mode cards, route into category/brand flows.
export default function DiscoveryHome({ token }: { token: string }) {
  return (
    <section className="p-8 text-center">
      <h1 className="text-2xl font-bold">{/* TODO: WELCOME TO <branch> */}RMS Home</h1>
      <p className="mt-2 text-sm text-[#6b7280]">Scaffold — Phase 1.2 (screen {token})</p>
      {/* TODO: What's in this Rack | Explore by Category | Explore by Brand | Explore by Product */}
    </section>
  );
}

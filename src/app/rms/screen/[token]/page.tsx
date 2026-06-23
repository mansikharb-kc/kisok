// RMS Home — Local "What's in this Rack" + Global 3 modes (BBC / BBB / BBP).
// Phase: P1.2
import DiscoveryHome from "@/components/rms/DiscoveryHome";

export default function RmsHomePage({ params }: { params: { token: string } }) {
  return <DiscoveryHome token={params.token} />;
}

// BBB / BBP — Browse By Brand / Product (brands -> products; sponsored/featured/most-viewed).
// Phase: P1.5
import BrandGrid from "@/components/rms/BrandGrid";

export default function RmsBrandPage({ params }: { params: { token: string } }) {
  return <BrandGrid token={params.token} />;
}

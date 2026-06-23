// BBC — Browse By Category (all categories -> selected cat/subcat -> products).
// Phase: P1.3
import CategoryGrid from "@/components/rms/CategoryGrid";

export default function RmsCategoryPage({ params }: { params: { token: string } }) {
  return <CategoryGrid token={params.token} />;
}

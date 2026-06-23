// Shared Product Attribute (detail) page — image+QR+specs+physical location+"+BOM".
// Reused by all flows. No price. Phase: P1.4
import ProductDetail from "@/components/rms/ProductDetail";

export default function RmsProductPage({
  params,
}: {
  params: { token: string; productId: string };
}) {
  return <ProductDetail token={params.token} productId={params.productId} />;
}

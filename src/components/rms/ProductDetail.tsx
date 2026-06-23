// Shared product detail — image gallery + QR + spec tabs + PHYSICAL LOCATION + "Locate Sample"
// + "+ BOM" + "more from this brand". NO price. Phase: P1.4
// TODO: fetch product, attributes, media, location path; suggestions; track product_view event.
export default function ProductDetail({ token, productId }: { token: string; productId: string }) {
  return (
    <section className="p-8">
      Product detail — scaffold (Phase 1.4) · product {productId} · screen {token}
    </section>
  );
}

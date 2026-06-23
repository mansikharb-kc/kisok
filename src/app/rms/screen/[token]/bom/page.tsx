// BOM cart — items added via "+ BOM"; customer ID + QR handoff + email/CRM as quote (no price).
// Phase: P1.6 (+ P1.10 customer/quote)
import BomCart from "@/components/rms/BomCart";

export default function RmsBomPage({ params }: { params: { token: string } }) {
  return <BomCart token={params.token} />;
}

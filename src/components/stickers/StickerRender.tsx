import { code128 } from "@/lib/barcode";
import type { StickerLayout } from "@/lib/stickerLayout";

export type RenderRow = { id: string; label: string; value: string };

const KC_LOGO = "/logo.jpeg"; // company logo printed in the top-right corner

export type StickerRenderProps = {
  layout: StickerLayout;
  rows: RenderRow[];
  brandName?: string;
  brandLogoUrl?: string | null;
  qrUrl?: string | null;
  barcodeValue?: string | null;
  bottomCode?: string | null; // code printed under the barcode (e.g. D28.05.01)
};

function Barcode({ value, heightMm }: { value: string; heightMm: number }) {
  const { widths, total } = code128(value || " ");
  const rects: JSX.Element[] = [];
  let x = 0;
  widths.forEach((w, i) => {
    if (i % 2 === 0) rects.push(<rect key={i} x={x} y={0} width={w} height={10} fill="#000" />);
    x += w;
  });
  return (
    <svg viewBox={`0 0 ${total} 10`} preserveAspectRatio="none" style={{ width: "100%", height: `${heightMm}mm`, display: "block" }}>
      {rects}
    </svg>
  );
}

function QrSlot({ url, sizeMm }: { url?: string | null; sizeMm: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="qr" style={{ width: `${sizeMm}mm`, height: `${sizeMm}mm` }} />;
  }
  // Placeholder so the QR position is visible in the preview (real QR prints per copy).
  return (
    <div
      style={{
        width: `${sizeMm}mm`,
        height: `${sizeMm}mm`,
        border: "0.3mm dashed #999",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#999",
        fontSize: `${sizeMm * 0.22}mm`,
        fontWeight: 700,
        letterSpacing: "0.2mm",
      }}
    >
      QR
    </div>
  );
}

function BrandMark({ logoUrl, name, sizeMm }: { logoUrl?: string | null; name?: string; sizeMm: number }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt={name ?? "brand"} style={{ height: `${sizeMm}mm`, width: "auto", objectFit: "contain" }} />;
  }
  return <span style={{ fontWeight: 800, fontSize: `${sizeMm * 0.7}mm` }}>{name ?? ""}</span>;
}

// ---- Laminate (portrait 37.5 × 50 mm) -------------------------------------
function LaminateSticker(props: StickerRenderProps) {
  const { layout, rows, brandName, brandLogoUrl, qrUrl, barcodeValue, bottomCode } = props;
  const { w, h } = layout.size;
  return (
    <div
      style={{
        width: `${w}mm`,
        height: `${h}mm`,
        boxSizing: "border-box",
        padding: "1.6mm",
        background: "#fff",
        color: "#000",
        fontFamily: "Arial, Helvetica, sans-serif",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: "5mm" }}>
        {layout.showBrandLogo ? <BrandMark logoUrl={brandLogoUrl} name={brandName} sizeMm={4} /> : <span />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={KC_LOGO} alt="KC" style={{ height: "4.5mm", width: "auto", objectFit: "contain" }} />
      </div>
      <div style={{ borderTop: "0.4mm solid #000", margin: "1mm 0" }} />
      <div style={{ display: "flex", alignItems: "center", gap: "1mm", fontWeight: 800, fontSize: "2.4mm", lineHeight: 1.1 }}>
        <span style={{ width: "1.6mm", height: "1.6mm", borderRadius: "50%", background: "#000", display: "inline-block" }} />
        <span style={{ textTransform: "uppercase" }}>{brandName ?? "Brand"}</span>
      </div>

      <div style={{ flex: 1, marginTop: "1.2mm", display: "flex", flexDirection: "column", gap: "0.7mm", overflow: "hidden" }}>
        {rows.map((r) => (
          <div key={r.id} style={{ fontSize: "1.9mm", lineHeight: 1.15 }}>
            <span style={{ color: "#333" }}>{r.label}: </span>
            <span style={{ fontWeight: 700 }}>{r.value || "—"}</span>
          </div>
        ))}
      </div>

      <div style={{ borderTop: "0.4mm solid #000", margin: "1mm 0" }} />
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "1.5mm" }}>
        {layout.showQr ? <QrSlot url={qrUrl} sizeMm={10} /> : <span />}
        {layout.showBarcode && (
          <div style={{ flex: 1, maxWidth: "22mm" }}>
            <Barcode value={barcodeValue ?? ""} heightMm={6} />
            {bottomCode ? <div style={{ marginTop: "0.8mm", fontWeight: 800, fontSize: "2.6mm", textAlign: "center", letterSpacing: "0.3mm" }}>{bottomCode}</div> : null}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Pioneer (landscape 85 × 60 mm) ---------------------------------------
function PioneerSticker(props: StickerRenderProps) {
  const { layout, rows, brandName, brandLogoUrl, qrUrl, barcodeValue, bottomCode } = props;
  const { w, h } = layout.size;
  return (
    <div
      style={{
        width: `${w}mm`,
        height: `${h}mm`,
        boxSizing: "border-box",
        padding: "3mm",
        background: "#fff",
        color: "#000",
        fontFamily: "Arial, Helvetica, sans-serif",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "2mm" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "2mm" }}>
          <span style={{ width: "2mm", height: "2mm", borderRadius: "50%", background: "#000", display: "inline-block" }} />
          {layout.showBrandLogo ? <BrandMark logoUrl={brandLogoUrl} name={brandName} sizeMm={5} /> : null}
          <span style={{ fontWeight: 800, fontSize: "3.4mm", textTransform: "uppercase" }}>{brandName ?? "Brand"}</span>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={KC_LOGO} alt="KC" style={{ height: "6mm", width: "auto", objectFit: "contain" }} />
      </div>
      <div style={{ borderTop: "0.4mm solid #000", margin: "1.5mm 0" }} />

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6mm 4mm", alignContent: "start", overflow: "hidden" }}>
        {rows.map((r) => (
          <div key={r.id} style={{ fontSize: "2.2mm", lineHeight: 1.2 }}>
            <span style={{ color: "#333" }}>{r.label}: </span>
            <span style={{ fontWeight: 700 }}>{r.value || "—"}</span>
          </div>
        ))}
      </div>

      <div style={{ borderTop: "0.4mm solid #000", margin: "1.5mm 0" }} />
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "3mm" }}>
        {layout.showQr ? <QrSlot url={qrUrl} sizeMm={13} /> : <span />}
        {layout.showBarcode && (
          <div style={{ flex: 1, maxWidth: "45mm" }}>
            <Barcode value={barcodeValue ?? ""} heightMm={8} />
            {bottomCode ? <div style={{ marginTop: "1mm", fontWeight: 800, fontSize: "3mm", textAlign: "center", letterSpacing: "0.4mm" }}>{bottomCode}</div> : null}
          </div>
        )}
      </div>
    </div>
  );
}

/** Renders a sticker at its exact mm size. Wrap with a CSS transform to scale
 *  for on-screen preview; print uses true mm. */
export default function StickerRender(props: StickerRenderProps) {
  return props.layout.base === "pioneer" ? <PioneerSticker {...props} /> : <LaminateSticker {...props} />;
}

type OnboardingRecord = {
  id: string;
  status: string;
  createdAt: string;
  product: {
    name: string;
    sku: string;
    brand: { name: string; code: string };
    category: { name: string; code: string };
  };
  seller: { name: string; sellerCode: string };
  program: { name: string; code: string };
};

export default function OnboardingList({ records }: { records: OnboardingRecord[] }) {
  if (records.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
        <p className="text-sm text-slate-400">
          No products onboarded yet for your assigned sellers.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-5 py-3">Product</th>
            <th className="px-5 py-3">Brand &amp; Category</th>
            <th className="px-5 py-3">Seller &amp; Program</th>
            <th className="px-5 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-600">
          {records.map((r) => (
            <tr key={r.id} className="transition-colors hover:bg-slate-50/50">
              <td className="px-5 py-4 align-top">
                <div className="font-semibold text-slate-800">{r.product.name}</div>
                <div className="mt-0.5 font-mono text-xs text-slate-500">SKU: {r.product.sku}</div>
              </td>
              <td className="px-5 py-4 align-top">
                <div className="text-xs font-medium text-slate-800">{r.product.brand.name}</div>
                <div className="mt-0.5 text-[11px] text-slate-500">{r.product.category.name}</div>
              </td>
              <td className="px-5 py-4 align-top">
                <div className="text-xs font-semibold text-slate-700">{r.seller.name}</div>
                <div className="mt-0.5 font-mono text-[10px] text-slate-500">{r.seller.sellerCode}</div>
                <div className="mt-1 inline-flex rounded border border-brand-100 bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700">
                  {r.program.name}
                </div>
              </td>
              <td className="px-5 py-4 align-top">
                <span
                  className={`inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                    r.status === "active" || r.status === "onboarded"
                      ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  {r.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

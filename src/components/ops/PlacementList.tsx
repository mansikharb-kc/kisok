type Row = {
  id: string;
  instanceCode: string;
  copyRole: string;
  availability: string;
  status: string;
  locationNodeId: string | null;
  product: { name: string; sku: string; brand?: { name: string } | null };
  location: { name: string; locationId: string | null; path: string | null } | null;
  size: { label: string } | null;
  qr: { url: string } | null;
  record: { seller: { name: string } };
};

export default function PlacementList({ rows }: { rows: Row[] }) {
  return (
    <div className="bg-white/60 backdrop-blur-md rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <h2 className="font-bold text-slate-800 text-sm">Physical Copy Catalogues</h2>
        <span className="text-xs font-medium text-slate-400">{rows.length} copies total</span>
      </div>

      {rows.length === 0 ? (
        <div className="p-12 text-center text-slate-400 text-sm">
          No physical product copies have been placed at this branch yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-5 py-3.5">QR & Instance Code</th>
                <th className="px-5 py-3.5">Product Details</th>
                <th className="px-5 py-3.5">Copy Role & Size</th>
                <th className="px-5 py-3.5">Physical Location</th>
                <th className="px-5 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-4 align-top">
                    <div className="flex items-start gap-3">
                      {c.qr?.url ? (
                        <img
                          src={c.qr.url}
                          alt={`QR for ${c.instanceCode}`}
                          className="w-12 h-12 rounded border border-slate-200 bg-white/60 backdrop-blur-md object-contain shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded border border-dashed border-slate-200 bg-slate-50 shrink-0" />
                      )}
                      <div>
                        <div className="font-mono text-xs font-semibold text-slate-800 break-all">{c.instanceCode}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">Instance ID: #{c.id}</div>
                        <div className="mt-1">
                          {c.qr?.url ? (
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 font-medium select-none">
                              QR ready
                            </span>
                          ) : (
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200 font-medium select-none">
                              No QR
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <div className="font-semibold text-slate-800">{c.product.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">SKU: {c.product.sku}</div>
                    <div className="text-[10px] font-medium text-slate-400 mt-1">Seller: {c.record.seller.name}</div>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <div className="space-y-1">
                      <div>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            c.copyRole === "MASTER" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {c.copyRole}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 font-medium">Size: {c.size?.label || "—"}</div>
                    </div>
                  </td>
                  <td className="px-5 py-4 align-top">
                    {c.location ? (
                      <div className="space-y-1">
                        <div className="font-semibold text-slate-800 text-xs">{c.location.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">ID: {c.location.locationId}</div>
                        <div className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]" title={c.location.path ?? ""}>
                          Path: {c.location.path}
                        </div>
                      </div>
                    ) : (
                      <span className="text-amber-600 font-medium text-xs flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                        Unplaced / Stage Buffer
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 align-top">
                    <div className="space-y-1">
                      <div>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${
                            c.availability === "IN"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}
                        >
                          Availability: {c.availability}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">Status: {c.status}</div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

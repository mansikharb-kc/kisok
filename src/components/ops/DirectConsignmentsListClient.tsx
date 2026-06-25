"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Truck, FileText, CheckCircle2, AlertCircle, Plus, Upload, X } from "lucide-react";
import { formatDate } from "@/lib/format";

type DirectConsignment = {
  id: string;
  dcNo: string;
  sellerName: string;
  brandName: string;
  receivedDate: string;
  vehicleDetails: string | null;
  quantityReceived: number;
  boxQc: string;
  photographUrl: string | null;
  packingListDoc: string | null;
  remarks: string | null;
  status: string;
  createdAt: string;
};

export default function DirectConsignmentsListClient({
  directConsignments,
}: {
  directConsignments: DirectConsignment[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // Form states
  const [showRaiseDirect, setShowRaiseDirect] = useState(false);
  const [dcSellerName, setDcSellerName] = useState("");
  const [dcReceivedDate, setDcReceivedDate] = useState(new Date().toISOString().slice(0, 10));
  const [dcVehicleDetails, setDcVehicleDetails] = useState("");
  const [dcQtyReceived, setDcQtyReceived] = useState("");
  const [dcBoxQc, setDcBoxQc] = useState("Good");
  const [dcPhotoUrl, setDcPhotoUrl] = useState("");
  const [dcPackingListDoc, setDcPackingListDoc] = useState("");
  const [dcRemarks, setDcRemarks] = useState("");
  const [dcErr, setDcErr] = useState("");
  const [uploadingDcPhoto, setUploadingDcPhoto] = useState(false);
  const [uploadingDcPacking, setUploadingDcPacking] = useState(false);

  async function handleDcPhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDcPhoto(true);
    setDcErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setDcErr(data.error || "Photograph upload failed");
        return;
      }
      setDcPhotoUrl(data.url);
    } catch {
      setDcErr("Photograph upload failed");
    } finally {
      setUploadingDcPhoto(false);
    }
  }

  async function handleDcPackingUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDcPacking(true);
    setDcErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setDcErr(data.error || "Packing list upload failed");
        return;
      }
      setDcPackingListDoc(data.url);
    } catch {
      setDcErr("Packing list upload failed");
    } finally {
      setUploadingDcPacking(false);
    }
  }

  async function raiseDirect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setDcErr("");

    const cleanVehicle = (dcVehicleDetails || "").trim().toUpperCase();
    if (!cleanVehicle) {
      setDcErr("Vehicle Details are required.");
      setBusy(false);
      return;
    }

    // Standard Indian vehicle number plate regex format (e.g. KA-01-MX-1234 or MH 12 AB 1234)
    const vehicleRegex = /^[A-Z]{2}[ -]?[0-9]{1,2}[ -]?[A-Z]{1,3}[ -]?[0-9]{4}$/i;
    const dummyKeywords = ["TEST", "DUMMY", "TEMP", "VEHICLE", "1234", "ABCD", "N/A", "NONE", "NIL", "ASD", "QWE", "1111", "0000", "XXXX"];
    const isDummy = dummyKeywords.some(keyword => cleanVehicle.includes(keyword)) || cleanVehicle.length < 5;

    if (!vehicleRegex.test(cleanVehicle) || isDummy) {
      setDcErr("Please enter a valid vehicle registration number (e.g., KA-01-MX-1234) without using dummy values.");
      setBusy(false);
      return;
    }

    if (!dcPhotoUrl) {
      setDcErr("Photograph Reference is required. Please upload a photograph.");
      setBusy(false);
      return;
    }

    if (!dcPackingListDoc) {
      setDcErr("Packing List Document is required. Please upload a packing list.");
      setBusy(false);
      return;
    }

    try {
      const res = await fetch("/api/direct-consignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerName: dcSellerName,
          brandName: "N/A",
          receivedDate: dcReceivedDate,
          vehicleDetails: cleanVehicle,
          quantityReceived: parseInt(dcQtyReceived, 10) || 0,
          boxQc: dcBoxQc,
          photographUrl: dcPhotoUrl,
          packingListDoc: dcPackingListDoc,
          remarks: dcRemarks || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDcErr(data.error || "Failed to raise direct consignment");
        return;
      }
      setShowRaiseDirect(false);
      // Reset form
      setDcSellerName("");
      setDcReceivedDate(new Date().toISOString().slice(0, 10));
      setDcVehicleDetails("");
      setDcQtyReceived("");
      setDcBoxQc("Good");
      setDcPhotoUrl("");
      setDcPackingListDoc("");
      setDcRemarks("");
      router.refresh();
    } catch {
      setDcErr("A network error occurred.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Create Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowRaiseDirect(true)}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-650 hover:bg-indigo-750 text-white px-4 py-2 text-xs font-semibold shadow-sm transition active:scale-[0.98] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Raise Direct Consignment</span>
        </button>
      </div>

      {/* Main List */}
      {directConsignments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 backdrop-blur-md p-12 text-center text-sm text-slate-450">
          No direct consignments raised yet. Click above to record a direct consignment.
        </div>
      ) : (
        <div className="space-y-3">
          {directConsignments.map((dc) => {
            const statusLabel = dc.status === "RESOLVED" ? "Resolved / Registered" : "With Onboarding Lead";
            const badgeClass =
              dc.status === "RESOLVED"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-orange-50 text-orange-700 border-orange-200";

            return (
              <div key={dc.id} className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-800 text-white font-semibold shadow-sm">
                        {dc.dcNo}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold uppercase tracking-wider ${badgeClass}`}>
                        {statusLabel}
                      </span>
                      <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDate(dc.createdAt)}
                      </span>
                    </div>
                    <h3 className="font-extrabold text-slate-900 mt-2 text-sm tracking-tight">
                      {dc.sellerName}
                    </h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs text-slate-600">
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Date Received</span>
                    <span className="text-slate-800 font-semibold block mt-0.5">{formatDate(dc.receivedDate)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Vehicle Details</span>
                    <span className="text-slate-800 font-semibold block mt-0.5">{dc.vehicleDetails || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Quantity Received</span>
                    <span className="text-slate-800 font-extrabold block mt-0.5">{dc.quantityReceived}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Box QC Status</span>
                    <span className="text-slate-800 font-semibold block mt-0.5">{dc.boxQc}</span>
                  </div>
                  {(dc.photographUrl || dc.packingListDoc) && (
                    <div className="sm:col-span-2 md:col-span-1 space-y-1">
                      <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Attached Documents</span>
                      <div className="flex gap-3 mt-1 flex-wrap">
                        {dc.photographUrl && (
                          <a
                            href={dc.photographUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-indigo-650 hover:underline font-bold text-[11px]"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Photo
                          </a>
                        )}
                        {dc.packingListDoc && (
                          <a
                            href={dc.packingListDoc}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-indigo-650 hover:underline font-bold text-[11px]"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Packing List
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                  {dc.remarks && (
                    <div className="sm:col-span-2 md:col-span-3">
                      <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Remarks</span>
                      <span className="text-slate-800 italic">"{dc.remarks}"</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Creation Modal */}
      {showRaiseDirect && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 overflow-y-auto py-8">
          <form onSubmit={raiseDirect} className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-2xl p-6 space-y-6 text-white my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-100 uppercase tracking-wider">Raise Direct Consignment</h3>
              <button
                type="button"
                onClick={() => setShowRaiseDirect(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            {dcErr && (
              <div className="rounded-lg bg-red-955 border border-red-800 text-red-250 text-xs p-3 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{dcErr}</span>
              </div>
            )}

            {/* Seller & Brand Name Details */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Seller Name / Brand Name</label>
              <input
                type="text"
                required
                value={dcSellerName}
                onChange={(e) => setDcSellerName(e.target.value)}
                placeholder="e.g. Century Limited / Asian Paints"
                className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-xs focus:ring-1 focus:ring-brand-500 focus:outline-none text-slate-200 placeholder:text-slate-600"
              />
              <p className="text-[9px] text-slate-500 font-medium">Use a slash ( / ) to separate, e.g. <em>Seller Name / Brand Name</em></p>
            </div>

            <div className="border-t border-slate-800/80 my-2" />

            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Record Consignment Receipt
            </div>

            {/* Receipt Details Form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Date Received</label>
                <input
                  type="date"
                  required
                  value={dcReceivedDate}
                  onChange={(e) => setDcReceivedDate(e.target.value)}
                  className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-xs focus:ring-1 focus:ring-brand-500 focus:outline-none text-slate-200"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Vehicle Details</label>
                <input
                  type="text"
                  required
                  value={dcVehicleDetails}
                  onChange={(e) => setDcVehicleDetails(e.target.value)}
                  placeholder="e.g. KA-01-MX-1234"
                  className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-xs focus:ring-1 focus:ring-brand-500 focus:outline-none text-slate-200 placeholder:text-slate-600"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Quantity Received</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={dcQtyReceived}
                  onChange={(e) => setDcQtyReceived(e.target.value)}
                  placeholder="e.g. 5"
                  className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-xs focus:ring-1 focus:ring-brand-500 focus:outline-none text-slate-200 placeholder:text-slate-600 no-spinner"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">QC of the Box</label>
                <select
                  value={dcBoxQc}
                  onChange={(e) => setDcBoxQc(e.target.value)}
                  className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-200 cursor-pointer"
                >
                  <option value="Good">Good / Intact</option>
                  <option value="Scratched">Scratched</option>
                  <option value="Damaged">Damaged / Open</option>
                  <option value="Incomplete">Incomplete Items</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Photograph Reference</label>
                <input
                  type="text"
                  readOnly
                  placeholder="Upload file to populate"
                  value={dcPhotoUrl ? dcPhotoUrl.split("/").pop() || "" : ""}
                  className="w-full rounded border border-slate-800 bg-slate-900 px-3 py-2 text-xs focus:outline-none text-slate-350 placeholder:text-slate-600 cursor-not-allowed font-mono"
                />
                <label className={`cursor-pointer rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 flex items-center justify-center shadow-sm transition active:scale-[0.98] w-full ${uploadingDcPhoto ? "opacity-60 cursor-not-allowed" : ""}`}>
                  {uploadingDcPhoto ? "Uploading..." : dcPhotoUrl ? "Change Photograph" : "Upload Photograph"}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleDcPhotoUpload}
                    className="hidden"
                    style={{ display: "none" }}
                    disabled={uploadingDcPhoto}
                  />
                </label>
                {dcPhotoUrl && (
                  <div className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                    ✓ File uploaded successfully
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Packing List Doc</label>
                <input
                  type="text"
                  readOnly
                  placeholder="Upload file to populate"
                  value={dcPackingListDoc ? dcPackingListDoc.split("/").pop() || "" : ""}
                  className="w-full rounded border border-slate-800 bg-slate-900 px-3 py-2 text-xs focus:outline-none text-slate-350 placeholder:text-slate-600 cursor-not-allowed font-mono"
                />
                <label className={`cursor-pointer rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 flex items-center justify-center shadow-sm transition active:scale-[0.98] w-full ${uploadingDcPacking ? "opacity-60 cursor-not-allowed" : ""}`}>
                  {uploadingDcPacking ? "Uploading..." : dcPackingListDoc ? "Change Packing List" : "Upload Packing List"}
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={handleDcPackingUpload}
                    className="hidden"
                    style={{ display: "none" }}
                    disabled={uploadingDcPacking}
                  />
                </label>
                {dcPackingListDoc && (
                  <div className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                    ✓ File uploaded successfully
                  </div>
                )}
              </div>

              <div className="sm:col-span-2 md:col-span-3 space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Receipt Remarks</label>
                <textarea
                  rows={2}
                  placeholder="Remarks on the consignment..."
                  value={dcRemarks}
                  onChange={(e) => setDcRemarks(e.target.value)}
                  className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-xs focus:ring-1 focus:ring-brand-500 focus:outline-none text-slate-200 placeholder:text-slate-600"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowRaiseDirect(false)}
                className="rounded-md border border-slate-700 bg-slate-850 px-4 py-2 text-xs font-semibold hover:bg-slate-850 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-md bg-indigo-600 hover:bg-indigo-750 text-white px-5 py-2 text-xs font-semibold transition disabled:opacity-60 shadow-lg cursor-pointer"
              >
                {busy ? "Submitting..." : "Push Consignment: Received"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

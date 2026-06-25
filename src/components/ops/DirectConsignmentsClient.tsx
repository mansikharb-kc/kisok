"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Clock, Truck, FileText, UserCheck, UserPlus, CheckCircle2, ChevronDown, ChevronUp, Search } from "lucide-react";
import { formatDate } from "@/lib/format";
import { buildParentOptions } from "@/lib/categoryTree";

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

type Brand = { id: string; name: string; code: string };
type Category = { id: string; name: string; code: string; parentId: string | null };
type Program = { id: string; name: string; code: string };
type Exec = { id: string; fullName: string; email: string };

type DirectConsignmentsClientProps = {
  directConsignments: DirectConsignment[];
  brands: Brand[];
  categories: Category[];
  programs: Program[];
  execs: Exec[];
};

interface SearchableSelectProps {
  options: { value: string; label: string; searchString?: string }[];
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  required?: boolean;
}

function SearchableSelect({ options, placeholder, value, onChange, required = false }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value);
  const filteredOptions = options.filter((o) => {
    const textToSearch = o.searchString ? o.searchString : o.label;
    return textToSearch.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setSearch("");
        }}
        className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-xs focus:ring-1 focus:ring-brand-500 focus:outline-none cursor-pointer flex items-center justify-between text-slate-800 text-left min-h-[34px]"
      >
        <span className={selectedOption ? "text-slate-800 font-semibold" : "text-slate-400"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl flex flex-col p-1.5 gap-1">
          <div className="relative flex items-center mb-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              autoFocus
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 bg-slate-50/50"
            />
          </div>
          <div className="overflow-y-auto max-h-48 space-y-0.5">
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setIsOpen(false);
                }}
                className="w-full px-3 py-1.5 text-left text-xs rounded text-rose-600 hover:bg-rose-50/50 font-semibold border-b border-slate-100 mb-1"
              >
                ✕ Clear selection
              </button>
            )}
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-400 italic">No matches found</div>
            ) : (
              filteredOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-xs rounded transition-colors whitespace-pre ${
                    opt.value === value
                      ? "bg-indigo-50 text-indigo-700 font-bold"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DirectConsignmentsClient({
  directConsignments,
  brands,
  categories,
  programs,
  execs,
}: DirectConsignmentsClientProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [expandedDcId, setExpandedDcId] = useState<string | null>(null);

  // Form states for each direct consignment
  const [sellerCodes, setSellerCodes] = useState<Record<string, string>>({});
  const [selectedBrands, setSelectedBrands] = useState<Record<string, string>>({});
  const [selectedCategories, setSelectedCategories] = useState<Record<string, string>>({});
  const [selectedPrograms, setSelectedPrograms] = useState<Record<string, string>>({});
  const [selectedExecs, setSelectedExecs] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<Record<string, string>>({});
  const [membershipIds, setMembershipIds] = useState<Record<string, string>>({});
  const [memberTypes, setMemberTypes] = useState<Record<string, string>>({});
  const [salespersons, setSalespersons] = useState<Record<string, string>>({});
  const [spocNames, setSpocNames] = useState<Record<string, string>>({});
  const [spocPhones, setSpocPhones] = useState<Record<string, string>>({});
  const [spocEmails, setSpocEmails] = useState<Record<string, string>>({});
  const [sellerNames, setSellerNames] = useState<Record<string, string>>({});

  const [cascadeSelections, setCascadeSelections] = useState<Record<string, Record<number, string>>>({});

  const brandOptions = useMemo(() => {
    return brands.map((b) => ({
      value: b.id,
      label: `${b.name} (${b.code})`,
    }));
  }, [brands]);

  const parentOptions = useMemo(() => {
    return buildParentOptions(categories);
  }, [categories]);

  const parentById = useMemo(() => {
    return new Map(parentOptions.map((p) => [p.id, p]));
  }, [parentOptions]);

  const programOptions = useMemo(() => {
    return programs.map((p) => ({
      value: p.id,
      label: `${p.name} (${p.code})`,
    }));
  }, [programs]);

  const execOptions = useMemo(() => {
    return execs.map((e) => ({
      value: e.id,
      label: `${e.fullName} (${e.email})`,
    }));
  }, [execs]);

  const handleSelectCategoryAtLevel = (dcId: string, level: number, catId: string) => {
    setCascadeSelections((prev) => {
      const prevLevels = prev[dcId] || {};
      const nextLevels: Record<number, string> = {};

      for (let i = 1; i < level; i++) {
        if (prevLevels[i]) nextLevels[i] = prevLevels[i];
      }

      if (catId) {
        nextLevels[level] = catId;
      }

      let finalCatId = "";
      for (let i = 4; i >= 1; i--) {
        if (nextLevels[i]) {
          finalCatId = nextLevels[i];
          break;
        }
      }

      setSelectedCategories((prevCats) => ({ ...prevCats, [dcId]: finalCatId }));

      return {
        ...prev,
        [dcId]: nextLevels,
      };
    });
  };

  const CATEGORY_LEVELS = [
    { level: 1, label: "Category: Domain (L1)", placeholder: "Select Domain" },
    { level: 2, label: "Category: Department (L2)", placeholder: "Select Department" },
    { level: 3, label: "Category: Section (L3)", placeholder: "Select Section" },
    { level: 4, label: "Category: Detail (L4)", placeholder: "Select Category" },
  ];

  // Find matching brand by name helper
  const findMatchingBrandId = (brandName: string) => {
    if (!brandName) return "";
    const b = brands.find((x) => x.name.toLowerCase() === brandName.toLowerCase());
    return b ? b.id : "";
  };

  const handleToggle = (dcId: string) => {
    if (expandedDcId === dcId) {
      setExpandedDcId(null);
    } else {
      setExpandedDcId(dcId);
      const dc = directConsignments.find((d) => d.id === dcId)!;

      // Pre-fill form state defaults if not already set
      if (dc.sellerName && !sellerNames[dcId]) {
        setSellerNames((p) => ({ ...p, [dcId]: dc.sellerName }));
      }
      if (!sellerCodes[dcId]) {
        const cleanCode = (dc.sellerName || "")
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "_")
          .substring(0, 10);
        setSellerCodes((p) => ({ ...p, [dcId]: cleanCode }));
      }
      if (!selectedBrands[dcId]) {
        setSelectedBrands((p) => ({ ...p, [dcId]: findMatchingBrandId(dc.brandName) }));
      }
    }
  };

  const handleResolve = async (dcId: string) => {
    const code = sellerCodes[dcId]?.trim();
    const sellerName = sellerNames[dcId]?.trim();
    const brandId = selectedBrands[dcId];
    const categoryId = selectedCategories[dcId];
    const programId = selectedPrograms[dcId];
    const obExecUserId = selectedExecs[dcId];
    const membershipId = membershipIds[dcId]?.trim();
    const memberType = memberTypes[dcId];
    const salesperson = salespersons[dcId]?.trim();
    const spocName = spocNames[dcId]?.trim();
    const spocPhone = spocPhones[dcId]?.trim();
    const spocEmail = spocEmails[dcId]?.trim();

    if (!sellerName) {
      setErrors((p) => ({ ...p, [dcId]: "Seller name is required." }));
      return;
    }
    if (!code) {
      setErrors((p) => ({ ...p, [dcId]: "Seller code is required." }));
      return;
    }
    if (!brandId) {
      setErrors((p) => ({ ...p, [dcId]: "Please select a Brand." }));
      return;
    }
    if (!categoryId) {
      setErrors((p) => ({ ...p, [dcId]: "Please select a Category." }));
      return;
    }
    if (!programId) {
      setErrors((p) => ({ ...p, [dcId]: "Please select an assigned Program." }));
      return;
    }
    if (!obExecUserId) {
      setErrors((p) => ({ ...p, [dcId]: "Please select an Onboarding Executive." }));
      return;
    }

    setBusy(true);
    setErrors((p) => ({ ...p, [dcId]: "" }));
    setSuccess((p) => ({ ...p, [dcId]: "" }));

    try {
      const res = await fetch("/api/direct-consignments/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directConsignmentId: dcId,
          sellerName,
          sellerCode: code,
          brandId,
          categoryId,
          programId,
          obExecUserId,
          membershipId: membershipId || null,
          memberType: memberType || null,
          salesperson: salesperson || null,
          spocName: spocName || null,
          spocPhone: spocPhone || null,
          spocEmail: spocEmail || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrors((p) => ({ ...p, [dcId]: data.error || "Failed to resolve direct consignment." }));
        return;
      }

      setSuccess((p) => ({ ...p, [dcId]: "Seller registered and executive assigned successfully!" }));
      setExpandedDcId(null);
      router.refresh();
    } catch {
      setErrors((p) => ({ ...p, [dcId]: "A network error occurred." }));
    } finally {
      setBusy(false);
    }
  };

  if (directConsignments.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 backdrop-blur-md p-12 text-center text-sm text-slate-400">
        No active direct consignment packages found.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {directConsignments.map((dc) => {
        const isOpen = expandedDcId === dc.id;

        return (
          <div
            key={dc.id}
            className={`rounded-2xl border transition-all duration-300 ${
              isOpen
                ? "border-brand-500 bg-white/95 shadow-md"
                : "border-slate-200 bg-white/60 backdrop-blur-md hover:border-slate-350 hover:shadow-sm"
            }`}
          >
            {/* Header Area */}
            <div
              onClick={() => handleToggle(dc.id)}
              className="px-6 py-4 flex items-center justify-between cursor-pointer select-none"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-800 text-white font-semibold shadow-sm">
                    {dc.dcNo}
                  </span>
                  <span className="text-[10px] bg-orange-50 text-orange-700 font-semibold px-2 py-0.5 rounded border border-orange-200 uppercase tracking-wider">
                    Direct Consignment
                  </span>
                  <span className="text-slate-400 font-medium flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {formatDate(dc.createdAt)}
                  </span>
                </div>
                <h3 className="font-extrabold text-slate-900 mt-2 text-base tracking-tight">
                  {dc.sellerName}
                  {dc.brandName && dc.brandName !== "N/A" && (
                    <> · <span className="text-slate-500 font-medium">{dc.brandName}</span></>
                  )}
                </h3>
              </div>
              <button className="text-slate-400 hover:text-slate-650 transition shrink-0 p-1">
                {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </div>

            {/* Content & Action Area */}
            {isOpen && (
              <div className="px-6 pb-6 border-t border-slate-100 pt-5 space-y-6">
                {errors[dc.id] && (
                  <div className="rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs px-4 py-2.5 font-bold">
                    {errors[dc.id]}
                  </div>
                )}
                {success[dc.id] && (
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs px-4 py-2.5 font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    {success[dc.id]}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Side: Receipt Details Card */}
                  <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-5 space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-slate-500" />
                      Consignment Receipt Details
                    </h4>

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-450 block text-[10px] font-bold uppercase tracking-wider">Date Received</span>
                        <span className="text-slate-800 font-semibold block mt-0.5">{formatDate(dc.receivedDate)}</span>
                      </div>
                      <div>
                        <span className="text-slate-450 block text-[10px] font-bold uppercase tracking-wider">Vehicle Details</span>
                        <span className="text-slate-800 font-semibold block mt-0.5">{dc.vehicleDetails || "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-slate-450 block text-[10px] font-bold uppercase tracking-wider">Quantity Received</span>
                        <span className="text-slate-800 font-extrabold block mt-0.5">{dc.quantityReceived}</span>
                      </div>
                      <div>
                        <span className="text-slate-450 block text-[10px] font-bold uppercase tracking-wider">Box QC Status</span>
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border mt-0.5 ${
                          dc.boxQc === "Good"
                            ? "bg-emerald-50 text-emerald-750 border-emerald-200"
                            : "bg-rose-50 text-rose-750 border-rose-200"
                        }`}>
                          {dc.boxQc || "N/A"}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-slate-200/50 my-1" />

                    <div className="flex gap-4 text-xs flex-wrap">
                      {dc.photographUrl && (
                        <a
                          href={dc.photographUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-brand-600 hover:text-brand-850 hover:underline font-bold"
                        >
                          <FileText className="w-4 h-4 shrink-0" />
                          View Photograph
                        </a>
                      )}
                      {dc.packingListDoc && (
                        <a
                          href={dc.packingListDoc}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-brand-600 hover:text-brand-850 hover:underline font-bold"
                        >
                          <FileText className="w-4 h-4 shrink-0" />
                          View Packing List
                        </a>
                      )}
                    </div>

                    {dc.remarks && (
                      <div className="border-t border-slate-200/50 pt-3 text-xs">
                        <span className="text-slate-450 block text-[10px] font-bold uppercase tracking-wider">Receipt Remarks</span>
                        <span className="text-slate-800 mt-1 block italic bg-white border border-slate-100 rounded-lg p-2.5">
                          "{dc.remarks}"
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right Side: Redirect Link to Add Seller Form */}
                  <div className="flex flex-col items-center justify-center p-6 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/10 text-center space-y-4 min-h-[280px]">
                    <div className="p-3.5 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                      <UserPlus className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Unregistered Seller Profile</h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                        To process this consignment, you need to register the seller profile in the system first.
                      </p>
                    </div>
                    <Link
                      href={`/ops/sellers/new?name=${encodeURIComponent(dc.sellerName)}&directConsignmentId=${dc.id}`}
                      className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 text-xs font-bold transition shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 cursor-pointer"
                    >
                      <UserCheck className="w-4 h-4 shrink-0" />
                      <span>Add Seller &amp; Assign Executive →</span>
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

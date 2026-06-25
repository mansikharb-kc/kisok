"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Clock, Truck, FileText, UserCheck, CheckCircle2, ChevronDown, ChevronUp, Search } from "lucide-react";
import { formatDate } from "@/lib/format";
import { buildParentOptions } from "@/lib/categoryTree";

type Ticket = {
  id: string;
  ticketNo: string | null;
  type: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: string;
};

type Brand = { id: string; name: string; code: string };
type Category = { id: string; name: string; code: string; parentId: string | null };
type Program = { id: string; name: string; code: string };
type Exec = { id: string; fullName: string; email: string };

type DirectConsignmentsClientProps = {
  tickets: Ticket[];
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
        className="w-full rounded border border-slate-350 bg-white px-3 py-2 text-xs focus:ring-1 focus:ring-brand-500 focus:outline-none cursor-pointer flex items-center justify-between text-slate-800 text-left min-h-[34px]"
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
  tickets,
  brands,
  categories,
  programs,
  execs,
}: DirectConsignmentsClientProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);

  // Form states for each ticket
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

  const handleSelectCategoryAtLevel = (ticketId: string, level: number, catId: string) => {
    setCascadeSelections((prev) => {
      const ticketPrev = prev[ticketId] || {};
      const ticketNext: Record<number, string> = {};

      for (let i = 1; i < level; i++) {
        if (ticketPrev[i]) ticketNext[i] = ticketPrev[i];
      }

      if (catId) {
        ticketNext[level] = catId;
      }

      let finalCatId = "";
      for (let i = 4; i >= 1; i--) {
        if (ticketNext[i]) {
          finalCatId = ticketNext[i];
          break;
        }
      }

      setSelectedCategories((prevCats) => ({ ...prevCats, [ticketId]: finalCatId }));

      return {
        ...prev,
        [ticketId]: ticketNext,
      };
    });
  };

  const CATEGORY_LEVELS = [
    { level: 1, label: "Category: Domain (L1)", placeholder: "Select Domain" },
    { level: 2, label: "Category: Department (L2)", placeholder: "Select Department" },
    { level: 3, label: "Category: Section (L3)", placeholder: "Select Section" },
    { level: 4, label: "Category: Detail (L4)", placeholder: "Select Category" },
  ];

  // Parse ticket description JSON helper
  const getDetails = (t: Ticket) => {
    try {
      return JSON.parse(t.description || "{}");
    } catch {
      return {};
    }
  };

  // Find matching brand by name helper
  const findMatchingBrandId = (brandName: string) => {
    if (!brandName) return "";
    const b = brands.find((x) => x.name.toLowerCase() === brandName.toLowerCase());
    return b ? b.id : "";
  };

  const handleToggle = (ticketId: string) => {
    if (expandedTicketId === ticketId) {
      setExpandedTicketId(null);
    } else {
      setExpandedTicketId(ticketId);
      const details = getDetails(tickets.find((t) => t.id === ticketId)!);

      // Pre-fill form state defaults if not already set
      if (!sellerCodes[ticketId]) {
        const cleanCode = (details.sellerName || "")
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "_")
          .substring(0, 10);
        setSellerCodes((p) => ({ ...p, [ticketId]: cleanCode }));
      }
      if (!selectedBrands[ticketId]) {
        setSelectedBrands((p) => ({ ...p, [ticketId]: findMatchingBrandId(details.brandName) }));
      }
      if (details.membershipId !== undefined && !membershipIds[ticketId]) {
        setMembershipIds((p) => ({ ...p, [ticketId]: details.membershipId || "" }));
      }
      if (details.memberType !== undefined && !memberTypes[ticketId]) {
        setMemberTypes((p) => ({ ...p, [ticketId]: details.memberType || "" }));
      }
      if (details.salesperson !== undefined && !salespersons[ticketId]) {
        setSalespersons((p) => ({ ...p, [ticketId]: details.salesperson || "" }));
      }
      if (details.spocName !== undefined && !spocNames[ticketId]) {
        setSpocNames((p) => ({ ...p, [ticketId]: details.spocName || "" }));
      }
      if (details.spocPhone !== undefined && !spocPhones[ticketId]) {
        setSpocPhones((p) => ({ ...p, [ticketId]: details.spocPhone || "" }));
      }
      if (details.spocEmail !== undefined && !spocEmails[ticketId]) {
        setSpocEmails((p) => ({ ...p, [ticketId]: details.spocEmail || "" }));
      }
    }
  };

  const handleResolve = async (ticketId: string, details: any) => {
    const code = sellerCodes[ticketId]?.trim();
    const brandId = selectedBrands[ticketId];
    const categoryId = selectedCategories[ticketId];
    const programId = selectedPrograms[ticketId];
    const obExecUserId = selectedExecs[ticketId];
    const membershipId = membershipIds[ticketId]?.trim();
    const memberType = memberTypes[ticketId];
    const salesperson = salespersons[ticketId]?.trim();
    const spocName = spocNames[ticketId]?.trim();
    const spocPhone = spocPhones[ticketId]?.trim();
    const spocEmail = spocEmails[ticketId]?.trim();

    if (!code) {
      setErrors((p) => ({ ...p, [ticketId]: "Seller code is required." }));
      return;
    }
    if (!brandId) {
      setErrors((p) => ({ ...p, [ticketId]: "Please select a Brand." }));
      return;
    }
    if (!categoryId) {
      setErrors((p) => ({ ...p, [ticketId]: "Please select a Category." }));
      return;
    }
    if (!programId) {
      setErrors((p) => ({ ...p, [ticketId]: "Please select an assigned Program." }));
      return;
    }
    if (!obExecUserId) {
      setErrors((p) => ({ ...p, [ticketId]: "Please select an Onboarding Executive." }));
      return;
    }

    setBusy(true);
    setErrors((p) => ({ ...p, [ticketId]: "" }));
    setSuccess((p) => ({ ...p, [ticketId]: "" }));

    try {
      const res = await fetch("/api/tickets/direct-consignment/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId,
          sellerName: details.sellerName,
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
        setErrors((p) => ({ ...p, [ticketId]: data.error || "Failed to resolve direct consignment." }));
        return;
      }

      setSuccess((p) => ({ ...p, [ticketId]: "Seller registered and executive assigned successfully!" }));
      setExpandedTicketId(null);
      router.refresh();
    } catch {
      setErrors((p) => ({ ...p, [ticketId]: "A network error occurred." }));
    } finally {
      setBusy(false);
    }
  };

  if (tickets.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 backdrop-blur-md p-12 text-center text-sm text-slate-400">
        No active direct consignment tickets found.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tickets.map((t) => {
        const details = getDetails(t);
        const isOpen = expandedTicketId === t.id;

        return (
          <div
            key={t.id}
            className={`rounded-2xl border transition-all duration-300 ${
              isOpen
                ? "border-brand-500 bg-white/95 shadow-md"
                : "border-slate-200 bg-white/60 backdrop-blur-md hover:border-slate-350 hover:shadow-sm"
            }`}
          >
            {/* Header Area */}
            <div
              onClick={() => handleToggle(t.id)}
              className="px-6 py-4 flex items-center justify-between cursor-pointer select-none"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-800 text-white font-semibold shadow-sm">
                    {t.ticketNo}
                  </span>
                  <span className="text-[10px] bg-orange-50 text-orange-700 font-semibold px-2 py-0.5 rounded border border-orange-200 uppercase tracking-wider">
                    Direct Consignment
                  </span>
                  <span className="text-slate-400 font-medium flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {formatDate(t.createdAt)}
                  </span>
                </div>
                <h3 className="font-extrabold text-slate-900 mt-2 text-base tracking-tight">
                  {details.sellerName} · <span className="text-slate-500 font-medium">{details.brandName}</span>
                </h3>
              </div>
              <button className="text-slate-400 hover:text-slate-600 transition shrink-0 p-1">
                {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </div>

            {/* Content & Action Area */}
            {isOpen && (
              <div className="px-6 pb-6 border-t border-slate-100 pt-5 space-y-6">
                {errors[t.id] && (
                  <div className="rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs px-4 py-2.5 font-bold">
                    {errors[t.id]}
                  </div>
                )}
                {success[t.id] && (
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs px-4 py-2.5 font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    {success[t.id]}
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
                        <span className="text-slate-800 font-semibold block mt-0.5">{formatDate(details.receivedDate)}</span>
                      </div>
                      <div>
                        <span className="text-slate-450 block text-[10px] font-bold uppercase tracking-wider">Vehicle Details</span>
                        <span className="text-slate-800 font-semibold block mt-0.5">{details.vehicleDetails || "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-slate-450 block text-[10px] font-bold uppercase tracking-wider">Quantity Received</span>
                        <span className="text-slate-800 font-extrabold block mt-0.5">{details.quantityReceived}</span>
                      </div>
                      <div>
                        <span className="text-slate-450 block text-[10px] font-bold uppercase tracking-wider">Box QC Status</span>
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border mt-0.5 ${
                          details.boxQc === "Good"
                            ? "bg-emerald-50 text-emerald-750 border-emerald-200"
                            : "bg-rose-50 text-rose-750 border-rose-200"
                        }`}>
                          {details.boxQc || "N/A"}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-slate-200/50 my-1" />

                    <div className="flex gap-4 text-xs flex-wrap">
                      {details.photographUrl && (
                        <a
                          href={details.photographUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-brand-600 hover:text-brand-850 hover:underline font-bold"
                        >
                          <FileText className="w-4 h-4 shrink-0" />
                          View Photograph
                        </a>
                      )}
                      {details.packingListDoc && (
                        <a
                          href={details.packingListDoc}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-brand-600 hover:text-brand-850 hover:underline font-bold"
                        >
                          <FileText className="w-4 h-4 shrink-0" />
                          View Packing List
                        </a>
                      )}
                    </div>

                    <div className="border-t border-slate-200/50 my-1" />

                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Submitted Seller Details</h5>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-450 block text-[10px] font-bold uppercase tracking-wider">Membership ID</span>
                        <span className="text-slate-800 font-semibold block mt-0.5">{details.membershipId || "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-slate-450 block text-[10px] font-bold uppercase tracking-wider">Member Type</span>
                        <span className="text-slate-800 font-semibold block mt-0.5">{details.memberType || "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-slate-450 block text-[10px] font-bold uppercase tracking-wider">Salesperson</span>
                        <span className="text-slate-800 font-semibold block mt-0.5">{details.salesperson || "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-slate-450 block text-[10px] font-bold uppercase tracking-wider">SPOC Name</span>
                        <span className="text-slate-800 font-semibold block mt-0.5">{details.spocName || "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-slate-450 block text-[10px] font-bold uppercase tracking-wider">SPOC Phone</span>
                        <span className="text-slate-800 font-semibold block mt-0.5">{details.spocPhone || "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-slate-450 block text-[10px] font-bold uppercase tracking-wider">SPOC Email</span>
                        <span className="text-slate-800 font-semibold block mt-0.5">{details.spocEmail || "N/A"}</span>
                      </div>
                    </div>

                    {details.remarks && (
                      <div className="border-t border-slate-200/50 pt-3 text-xs">
                        <span className="text-slate-450 block text-[10px] font-bold uppercase tracking-wider">Receipt Remarks</span>
                        <span className="text-slate-800 mt-1 block italic bg-white border border-slate-100 rounded-lg p-2.5">
                          "{details.remarks}"
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right Side: Register & Assign Form */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-slate-500" />
                      Create Seller &amp; Assign Task
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Seller Name</label>
                        <div className="font-semibold text-xs text-slate-800 bg-slate-100 border border-slate-200 rounded px-3 py-2">
                          {details.sellerName}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Seller Code (Unique)</label>
                        <input
                          type="text"
                          required
                          value={sellerCodes[t.id] || ""}
                          onChange={(e) => setSellerCodes((p) => ({ ...p, [t.id]: e.target.value }))}
                          placeholder="e.g. CENTURY"
                          className="w-full rounded border border-slate-350 bg-white px-3 py-2 text-xs focus:ring-1 focus:ring-brand-500 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Membership ID</label>
                        <input
                          type="text"
                          value={membershipIds[t.id] || ""}
                          onChange={(e) => setMembershipIds((p) => ({ ...p, [t.id]: e.target.value }))}
                          placeholder="e.g. MEM-1234 (blank to auto-gen)"
                          className="w-full rounded border border-slate-350 bg-white px-3 py-2 text-xs focus:ring-1 focus:ring-brand-500 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Member Type</label>
                        <select
                          value={memberTypes[t.id] || ""}
                          onChange={(e) => setMemberTypes((p) => ({ ...p, [t.id]: e.target.value }))}
                          className="w-full rounded border border-slate-350 bg-white px-3 py-2 text-xs focus:ring-1 focus:ring-brand-500 focus:outline-none text-slate-700 font-medium"
                        >
                          <option value="">Select Member Type</option>
                          <option value="Paid">Paid</option>
                          <option value="Sponsor">Sponsor</option>
                          <option value="Barter">Barter</option>
                          <option value="Free">Free</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Salesperson</label>
                        <input
                          type="text"
                          value={salespersons[t.id] || ""}
                          onChange={(e) => setSalespersons((p) => ({ ...p, [t.id]: e.target.value }))}
                          placeholder="Salesperson Name"
                          className="w-full rounded border border-slate-350 bg-white px-3 py-2 text-xs focus:ring-1 focus:ring-brand-500 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">SPOC Name</label>
                        <input
                          type="text"
                          value={spocNames[t.id] || ""}
                          onChange={(e) => setSpocNames((p) => ({ ...p, [t.id]: e.target.value }))}
                          placeholder="SPOC Name"
                          className="w-full rounded border border-slate-350 bg-white px-3 py-2 text-xs focus:ring-1 focus:ring-brand-500 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">SPOC Phone</label>
                        <input
                          type="text"
                          value={spocPhones[t.id] || ""}
                          onChange={(e) => setSpocPhones((p) => ({ ...p, [t.id]: e.target.value }))}
                          placeholder="SPOC Phone"
                          className="w-full rounded border border-slate-350 bg-white px-3 py-2 text-xs focus:ring-1 focus:ring-brand-500 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">SPOC Email</label>
                        <input
                          type="email"
                          value={spocEmails[t.id] || ""}
                          onChange={(e) => setSpocEmails((p) => ({ ...p, [t.id]: e.target.value }))}
                          placeholder="SPOC Email"
                          className="w-full rounded border border-slate-350 bg-white px-3 py-2 text-xs focus:ring-1 focus:ring-brand-500 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Map to HO Brand</label>
                        <SearchableSelect
                          options={brandOptions}
                          placeholder="Select Brand"
                          value={selectedBrands[t.id] || ""}
                          onChange={(val) => setSelectedBrands((p) => ({ ...p, [t.id]: val }))}
                        />
                      </div>

                      {CATEGORY_LEVELS.map((lvl) => {
                        const k = lvl.level;
                        if (k > 1 && !cascadeSelections[t.id]?.[k - 1]) return null;

                        const parentSel = cascadeSelections[t.id]?.[k - 1];
                        const opts = k === 1
                          ? parentOptions.filter((p) => p.level === 1)
                          : parentOptions.filter((p) => p.level === k && p.parentId === parentSel);

                        if (k > 1 && opts.length === 0) return null;

                        const searchableOpts = opts.map((o) => ({
                          value: o.id,
                          label: `${o.number} · ${o.name}`,
                          searchString: `${o.number} ${o.name}`,
                        }));

                        return (
                          <div key={k} className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{lvl.label}</label>
                            <SearchableSelect
                              options={searchableOpts}
                              placeholder={lvl.placeholder}
                              value={cascadeSelections[t.id]?.[k] || ""}
                              onChange={(val) => handleSelectCategoryAtLevel(t.id, k, val)}
                            />
                          </div>
                        );
                      })}

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Assign Program</label>
                        <SearchableSelect
                          options={programOptions}
                          placeholder="Select Program"
                          value={selectedPrograms[t.id] || ""}
                          onChange={(val) => setSelectedPrograms((p) => ({ ...p, [t.id]: val }))}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Onboarding Executive</label>
                        <SearchableSelect
                          options={execOptions}
                          placeholder="Select Executive"
                          value={selectedExecs[t.id] || ""}
                          onChange={(val) => setSelectedExecs((p) => ({ ...p, [t.id]: val }))}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-3">
                      <button
                        type="button"
                        onClick={() => handleResolve(t.id, details)}
                        disabled={busy}
                        className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 text-xs font-bold transition disabled:opacity-60 shadow-md"
                      >
                        {busy ? "Registering..." : "Create Seller & Assign →"}
                      </button>
                    </div>
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

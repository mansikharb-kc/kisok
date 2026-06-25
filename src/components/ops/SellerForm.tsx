"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { slugFromName } from "@/lib/attributeMeta";
import { BRAND_TYPES, AGREEMENT_DURATIONS, durationMonths, addMonths, formatDMY, isValidGstin, brandCodeBase, parseFitoutDays, subtractDays, formatDaysToYMD } from "@/lib/brandMeta";
import { isNonEmptyString } from "@/lib/validation";
import { buildParentOptions, FlatCat } from "@/lib/categoryTree";
import { LEVELS, levelMeta } from "@/lib/categoryLevels";
import BrandDetailsModal from "@/components/brands/BrandDetailsModal";
import BrandCategoryEditModal from "@/components/brands/BrandCategoryEditModal";

function addDays(dateStr: string, fitoutStr: string): string {
  if (!dateStr) return "";
  const days = parseFitoutDays(fitoutStr);
  const parts = dateStr.split("-");
  if (parts.length !== 3) return "";
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // 0-based
  const day = parseInt(parts[2], 10);
  const date = new Date(Date.UTC(year, month, day));
  if (isNaN(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function calculateEndDate(startDateStr: string, tenureDaysStr: string): string {
  if (!startDateStr || !tenureDaysStr) return "";
  const days = parseInt(tenureDaysStr, 10);
  if (isNaN(days) || days <= 0) return "";
  const parts = startDateStr.split("-");
  if (parts.length !== 3) return "";
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const date = new Date(Date.UTC(year, month, day));
  if (isNaN(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + days - 1);
  return date.toISOString().slice(0, 10);
}

type BrandOption = {
  id: string;
  name: string;
  code: string;
  createdByUserId?: string | null;
  brandCategories?: { categoryId: string }[];
};

type ProgramOption = {
  id: string;
  name: string;
  code: string;
};

type ExecOption = {
  id: string;
  fullName: string;
  email: string;
  _count?: {
    assignments: number;
  };
};

type CustomField = {
  id: string;
  label: string;
  code: string;
  fieldType: "text" | "number" | "date" | "enum";
  options: string[] | null;
  isRequired: boolean;
};

const MEMBER_TYPES = ["Paid", "Sponsor", "Barter", "Free"];

type SellerEdit = {
  id: string;
  name: string;
  sellerCode: string;
  membershipId: string | null;
  memberType?: string | null;
  salesperson?: string | null;
  spocName?: string | null;
  spocPhone?: string | null;
  spocEmail?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customFields?: any;
  status: string;
  sellerBrands: { brandId: string }[];
  sellerCategories?: { categoryId: string }[];
  contracts: {
    programId: string;
    collaborationTenure: string | null;
    fitoutPeriod: string | null;
    contractStart: string | null; // yyyy-mm-dd
    contractEnd: string | null; // yyyy-mm-dd
    verified: boolean;
    remarks: string | null;
    contractMediaId?: string | null;
    contractMedia?: { url: string } | null;
    customFields?: any;
  }[];
  assignments?: {
    programId: string | null;
    obExecUserId: string;
  }[];
};

export default function SellerForm({
  brands,
  programs,
  execs,
  flatCategories = [],
  seller,
  salespersons = [],
  currentUserId,
}: {
  brands: BrandOption[];
  programs: ProgramOption[];
  execs: ExecOption[];
  flatCategories?: FlatCat[];
  seller?: SellerEdit;
  salespersons?: string[];
  currentUserId?: string;
}) {
  const router = useRouter();
  const editing = !!seller;
  console.log("CLIENT EXECS PROP:", execs);

  // Basic Information
  const [name, setName] = useState(seller?.name ?? "");
  const [sellerCode, setSellerCode] = useState(seller?.sellerCode ?? "");
  const [codeTouched, setCodeTouched] = useState(editing);
  const [membershipId, setMembershipId] = useState(seller?.membershipId ?? "");
  const [status, setStatus] = useState(seller?.status ?? "active");

  // Member / SPOC details
  const [memberType, setMemberType] = useState(seller?.memberType ?? "");
  const [salesperson, setSalesperson] = useState(seller?.salesperson ?? "");
  const [salespersonDesignation, setSalespersonDesignation] = useState(() => {
    const cf = seller?.customFields as any;
    return cf?.salespersonDesignation ?? "";
  });

  // Multiple Brand SPOCs
  type BrandSpoc = {
    id: string;
    name: string;
    phone: string;
    email: string;
    designation?: string;
  };
  const [brandSpocs, setBrandSpocs] = useState<BrandSpoc[]>(() => {
    const cf = seller?.customFields as any;
    if (cf && Array.isArray(cf.brandSpocs)) {
      return cf.brandSpocs.map((s: any, i: number) => ({
        id: String(i),
        name: s.name ?? '',
        phone: s.phone ?? '',
        email: s.email ?? '',
        designation: s.designation ?? '',
      }));
    }
    if (seller?.spocName || seller?.spocPhone || seller?.spocEmail) {
      return [{
        id: '1',
        name: seller.spocName ?? '',
        phone: seller.spocPhone ?? '',
        email: seller.spocEmail ?? '',
        designation: '',
      }];
    }
    return [];
  });

  // HO-defined custom fields
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomField[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, string>>(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cf = (seller?.customFields ?? {}) as Record<string, any>;
    const init: Record<string, string> = {};
    for (const k of Object.keys(cf)) init[k] = cf[k] == null ? "" : String(cf[k]);
    return init;
  });

  useEffect(() => {
    fetch("/api/custom-fields?entity=collaboration")
      .then((r) => r.json())
      .then((d) => setCustomFieldDefs(d.fields ?? []))
      .catch(() => {});
  }, []);

  // Brands Mapped
  const approvedBrandIdSet = useMemo(() => new Set(brands.map((b) => String(b.id))), [brands]);
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>(
    seller?.sellerBrands.map((sb) => String(sb.brandId)).filter((id) => approvedBrandIdSet.has(id)) ?? []
  );

  const selectedBrands = useMemo(() => {
    return selectedBrandIds
      .map((brandId) => brands.find((b) => String(b.id) === String(brandId)))
      .filter(Boolean) as BrandOption[];
  }, [selectedBrandIds, brands]);

  const parents = useMemo(() => buildParentOptions(flatCategories), [flatCategories]);
  const byId = useMemo(() => new Map(parents.map((p) => [p.id, p])), [parents]);

  const [sel, setSel] = useState<Record<number, string>>({});
  const [pickedCategoryIds, setPickedCategoryIds] = useState<string[]>(
    seller?.sellerCategories?.map((sc) => String(sc.categoryId)) ?? []
  );

  const [prevSelectedBrandIds, setPrevSelectedBrandIds] = useState<string[]>(selectedBrandIds);

  // Contracts/Programs
  // We represent contracts as a dictionary keyed by programId.
  const [activeContracts, setActiveContracts] = useState<
    Record<
      string,
      {
        collaborationTenure: string;
        fitoutPeriod: string;
        baseStartDate: string;
        fitoutEnd: string;
        contractStart: string;
        contractEnd: string;
        verified: boolean;
        remarks: string;
        obExecUserId: string;
        contractMediaId: string | null;
        contractMediaUrl: string | null;
        categoryIds: string[];
        brandCategoryIds: Record<string, string[]>;
        freeCollaboration: boolean;
        kcSalesperson: string;
      }
    >
  >(() => {
    const initial: Record<string, any> = {};
    if (seller?.contracts) {
      for (const c of seller.contracts) {
        const match = seller.assignments?.find((a) => String(a.programId) === String(c.programId));
        const rawFitout = c.fitoutPeriod ? c.fitoutPeriod.replace(/\D/g, "") : "";
        const rawTenure = c.collaborationTenure ? c.collaborationTenure.replace(/\D/g, "") : "";
        const startStr = c.contractStart ? c.contractStart.slice(0, 10) : "";
        const baseStartStr = startStr && rawFitout ? subtractDays(startStr, rawFitout) : "";
        const fitoutEndStr = baseStartStr && rawFitout ? subtractDays(startStr, "1") : "";
        
        const savedBrandCats = (c.customFields as any)?.brandCategoryIds ?? {};
        const savedFlatCats = (c.customFields as any)?.categoryIds ?? [];
        const brandCategoryIds: Record<string, string[]> = { ...savedBrandCats };
        
        if (Object.keys(brandCategoryIds).length === 0 && savedFlatCats.length > 0 && seller?.sellerBrands) {
          for (const sb of seller.sellerBrands) {
            brandCategoryIds[String(sb.brandId)] = [...savedFlatCats];
          }
        }

        const freeCollab = (c.customFields as any)?.freeCollaboration ?? false;
        const kcSales = (c.customFields as any)?.kcSalesperson ?? "";

        initial[c.programId] = {
          collaborationTenure: rawTenure,
          fitoutPeriod: rawFitout,
          baseStartDate: baseStartStr,
          fitoutEnd: fitoutEndStr,
          contractStart: startStr,
          contractEnd: c.contractEnd ? c.contractEnd.slice(0, 10) : "",
          verified: c.verified,
          remarks: c.remarks ?? "",
          obExecUserId: match ? String(match.obExecUserId) : "",
          contractMediaId: c.contractMediaId ? String(c.contractMediaId) : null,
          contractMediaUrl: c.contractMedia?.url ?? null,
          categoryIds: savedFlatCats,
          brandCategoryIds,
          freeCollaboration: freeCollab,
          kcSalesperson: kcSales,
        };
      }
    }
    return initial;
  });

  const [activeContractTab, setActiveContractTab] = useState<string | null>(null);

  useEffect(() => {
    const activeIds = Object.keys(activeContracts);
    if (activeIds.length === 0) {
      setActiveContractTab(null);
    } else if (!activeContractTab || !activeContracts[activeContractTab]) {
      setActiveContractTab(activeIds[0]);
    }
  }, [activeContracts, activeContractTab]);

  useEffect(() => {
    const addedBrands = selectedBrandIds.filter((id) => !prevSelectedBrandIds.includes(id));
    const removedBrands = prevSelectedBrandIds.filter((id) => !selectedBrandIds.includes(id));

    if (addedBrands.length > 0 || removedBrands.length > 0) {
      let nextPicked = [...pickedCategoryIds];

      // 1. Add categories of newly selected brands
      addedBrands.forEach((brandId) => {
        const b = brands.find((br) => String(br.id) === String(brandId));
        if (b && b.brandCategories) {
          b.brandCategories.forEach((bc) => {
            const cid = String(bc.categoryId);
            if (!nextPicked.includes(cid)) {
              nextPicked.push(cid);
            }
          });
        }
      });

      // 2. Remove categories of deselected brands, unless they belong to other selected brands
      if (removedBrands.length > 0) {
        const stillSelectedCategoryIds = new Set<string>();
        const stillSelectedBrandIds = selectedBrandIds.filter((id) => !addedBrands.includes(id));
        stillSelectedBrandIds.forEach((brandId) => {
          const b = brands.find((br) => String(br.id) === String(brandId));
          if (b && b.brandCategories) {
            b.brandCategories.forEach((bc) => stillSelectedCategoryIds.add(String(bc.categoryId)));
          }
        });

        const removedCategoryIds = new Set<string>();
        removedBrands.forEach((brandId) => {
          const b = brands.find((br) => String(br.id) === String(brandId));
          if (b && b.brandCategories) {
            b.brandCategories.forEach((bc) => removedCategoryIds.add(String(bc.categoryId)));
          }
        });

        nextPicked = nextPicked.filter((cid) => {
          if (removedCategoryIds.has(cid) && !stillSelectedCategoryIds.has(cid)) {
            return false;
          }
          return true;
        });
      }

      setPickedCategoryIds(nextPicked);
      setPrevSelectedBrandIds(selectedBrandIds);
      setSel({});

      const nextPickedSet = new Set(nextPicked);
      setActiveContracts((prev) => {
        let changed = false;
        const next: typeof prev = {};

        for (const [programId, contract] of Object.entries(prev)) {
          const nextCategoryIds = (contract.categoryIds ?? []).filter((id) => nextPickedSet.has(String(id)));
          
          const nextBrandCategoryIds: Record<string, string[]> = {};
          for (const [bid, cats] of Object.entries(contract.brandCategoryIds ?? {})) {
            if (bid === "other" || selectedBrandIds.includes(bid)) {
              nextBrandCategoryIds[bid] = cats.filter((id) => nextPickedSet.has(String(id)));
            } else {
              changed = true;
            }
          }
          
          if (nextCategoryIds.length !== (contract.categoryIds ?? []).length) changed = true;
          next[programId] = {
            ...contract,
            categoryIds: nextCategoryIds,
            brandCategoryIds: nextBrandCategoryIds,
          };
        }

        return changed ? next : prev;
      });
    }
  }, [selectedBrandIds, prevSelectedBrandIds, brands, flatCategories, pickedCategoryIds]);

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedBrandDetailsId, setSelectedBrandDetailsId] = useState<string | null>(null);
  const [selectedBrandForCategoryEdit, setSelectedBrandForCategoryEdit] = useState<string | null>(null);

  const [localBrands, setLocalBrands] = useState<BrandOption[]>(brands);
  const [brandSearch, setBrandSearch] = useState("");

  const filteredBrands = useMemo(() => {
    const query = brandSearch.trim().toLowerCase();
    if (!query) return localBrands;
    return localBrands.filter(
      (b) =>
        b.name.toLowerCase().includes(query) ||
        b.code.toLowerCase().includes(query)
    );
  }, [localBrands, brandSearch]);

  // Listen to brand creation events from the new tab/page
  useEffect(() => {
    const channel = new BroadcastChannel("brand_creation");
    channel.onmessage = (event) => {
      if (event.data?.type === "BRAND_CREATED") {
        const newBrand = event.data.brand;
        if (newBrand && newBrand.id) {
          setLocalBrands((prev) => {
            if (prev.some((b) => String(b.id) === String(newBrand.id))) {
              return prev;
            }
            return [...prev, newBrand];
          });
          setSelectedBrandIds((prev) => {
            if (prev.includes(String(newBrand.id))) {
              return prev;
            }
            return [...prev, String(newBrand.id)];
          });
        }
      }
    };
    return () => {
      channel.close();
    };
  }, []);

  // Toggle brand selection
  function toggleBrand(brandId: string) {
    setSelectedBrandIds((prev) =>
      prev.includes(brandId) ? prev.filter((id) => id !== brandId) : [...prev, brandId]
    );
  }

  // ---- category cascade ----
  function optionsForLevel(k: number) {
    let list = parents;
    if (k === 1) return list.filter((p) => p.level === 1);
    const parentSel = sel[k - 1];
    if (!parentSel) return [];
    return list.filter((p) => p.level === k && p.parentId === parentSel);
  }
  function selectAt(k: number, id: string) {
    setSel((prev) => {
      const next: Record<number, string> = {};
      for (let i = 1; i < k; i++) if (prev[i]) next[i] = prev[i];
      next[k] = id;
      return next;
    });
  }
  const deepest = useMemo(() => {
    let id: string | null = null;
    for (let k = 1; k <= LEVELS.slice(0, 4).length; k++) if (sel[k]) id = sel[k];
    return id;
  }, [sel]);

  function addAssociation() {
    if (!deepest || pickedCategoryIds.includes(deepest)) return;
    setPickedCategoryIds((p) => [...p, deepest]);
    setSel({});
  }
  function removeAssociation(id: string) {
    setPickedCategoryIds((p) => p.filter((x) => x !== id));
    setActiveContracts((prev) => {
      let changed = false;
      const next: typeof prev = {};
      for (const [programId, contract] of Object.entries(prev)) {
        const nextCategoryIds = (contract.categoryIds ?? []).filter((cid) => cid !== id);
        const nextBrandCategoryIds: Record<string, string[]> = {};
        for (const [bid, cats] of Object.entries(contract.brandCategoryIds ?? {})) {
          nextBrandCategoryIds[bid] = cats.filter((cid) => cid !== id);
        }
        if (nextCategoryIds.length !== (contract.categoryIds ?? []).length) changed = true;
        next[programId] = {
          ...contract,
          categoryIds: nextCategoryIds,
          brandCategoryIds: nextBrandCategoryIds,
        };
      }
      return changed ? next : prev;
    });
  }

  // Toggle program contract selection
  function toggleProgram(programId: string) {
    let added = false;
    setActiveContracts((prev) => {
      const next = { ...prev };
      if (next[programId]) {
        delete next[programId];
      } else {
        next[programId] = {
          collaborationTenure: "",
          fitoutPeriod: "",
          baseStartDate: "",
          fitoutEnd: "",
          contractStart: "",
          contractEnd: "",
          verified: false,
          remarks: "",
          obExecUserId: "",
          contractMediaId: null,
          contractMediaUrl: null,
          categoryIds: [],
          brandCategoryIds: {},
          freeCollaboration: false,
          kcSalesperson: "",
        };
        added = true;
      }
      return next;
    });

    if (added) {
      setActiveContractTab(programId);
    }
  }

  function toggleContractCategory(programId: string, brandId: string, categoryId: string) {
    setActiveContracts((prev) => {
      const current = prev[programId];
      if (!current) return prev;
      
      const currentBrandCategoryIds = current.brandCategoryIds ?? {};
      const currentBrandCats = currentBrandCategoryIds[brandId] ?? [];
      const nextBrandCats = currentBrandCats.includes(categoryId)
        ? currentBrandCats.filter((id) => id !== categoryId)
        : [...currentBrandCats, categoryId];
        
      const nextBrandCategoryIds = {
        ...currentBrandCategoryIds,
        [brandId]: nextBrandCats,
      };

      const allSelectedCats = new Set<string>();
      Object.values(nextBrandCategoryIds).forEach((cats) => {
        cats.forEach((cid) => allSelectedCats.add(cid));
      });

      return {
        ...prev,
        [programId]: {
          ...current,
          brandCategoryIds: nextBrandCategoryIds,
          categoryIds: Array.from(allSelectedCats),
        },
      };
    });
  }

  // Handle contract field changes
  function updateContract(programId: string, field: string, value: any) {
    setActiveContracts((prev) => {
      const current = prev[programId] || {
        collaborationTenure: "",
        fitoutPeriod: "",
        baseStartDate: "",
        fitoutEnd: "",
        contractStart: "",
        contractEnd: "",
        verified: false,
        remarks: "",
        obExecUserId: "",
        contractMediaId: null,
        contractMediaUrl: null,
        freeCollaboration: false,
        kcSalesperson: "",
      };
      
      const updated = {
        ...current,
        [field]: value,
      };

      if (field === "baseStartDate") {
        updated.baseStartDate = value;
        // contractStart = baseStartDate + fitoutPeriod
        if (updated.baseStartDate) {
          updated.contractStart = addDays(updated.baseStartDate, updated.fitoutPeriod);
          updated.fitoutEnd = subtractDays(updated.contractStart, "1");
        } else {
          updated.contractStart = "";
          updated.fitoutEnd = "";
        }
        // contractEnd = contractStart + collaborationTenure - 1 day
        if (updated.contractStart && updated.collaborationTenure) {
          updated.contractEnd = calculateEndDate(updated.contractStart, updated.collaborationTenure);
        } else {
          updated.contractEnd = "";
        }
      } else if (field === "fitoutPeriod") {
        if (updated.baseStartDate) {
          updated.contractStart = addDays(updated.baseStartDate, value);
          updated.fitoutEnd = subtractDays(updated.contractStart, "1");
        }
        if (updated.contractStart && updated.collaborationTenure) {
          updated.contractEnd = calculateEndDate(updated.contractStart, updated.collaborationTenure);
        } else {
          updated.contractEnd = "";
        }
      } else if (field === "collaborationTenure") {
        if (updated.contractStart && value) {
          updated.contractEnd = calculateEndDate(updated.contractStart, value);
        } else {
          updated.contractEnd = "";
        }
      }

      return {
        ...prev,
        [programId]: updated,
      };
    });
  }

  // Upload handler for contract PDF
  const [contractUploadingMap, setContractUploadingMap] = useState<Record<string, boolean>>({});

  async function onContractPdf(programId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setContractUploadingMap((prev) => ({ ...prev, [programId]: true }));
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "PDF upload failed");
        return;
      }
      updateContract(programId, "contractMediaId", data.mediaId);
      updateContract(programId, "contractMediaUrl", data.url);
    } catch {
      alert("PDF upload failed");
    } finally {
      setContractUploadingMap((prev) => ({ ...prev, [programId]: false }));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Validate required fields
    if (!isNonEmptyString(name) || !isNonEmptyString(sellerCode)) {
      setError("Seller Name and Seller Code are required");
      return;
    }

    // Must have at least one brand selected
    if (selectedBrandIds.length === 0) {
      setError("Please select at least one brand");
      return;
    }

    // Optional membershipId validation: if provided, must be non‑empty
    if (membershipId && !isNonEmptyString(membershipId)) {
      setError("Membership ID cannot be empty");
      return;
    }

    // Validate KC Salesperson if freeCollaboration is checked
    for (const [pid, details] of Object.entries(activeContracts)) {
      if (details.freeCollaboration && !details.kcSalesperson?.trim()) {
        const prog = programs.find((p) => String(p.id) === String(pid));
        const progName = prog ? prog.name : "Selected Program";
        setError(`KC Salesperson is required for Free Collaboration in ${progName} Contract`);
        return;
      }
    }

    setBusy(true);
    try {
      const contractPayload = Object.entries(activeContracts).map(([pid, details]) => ({
        programId: pid,
        collaborationTenure: details.collaborationTenure || null,
        fitoutPeriod: details.fitoutPeriod || null,
        contractStart: details.contractStart || null,
        contractEnd: details.contractEnd || null,
        verified: details.verified,
        remarks: details.remarks || null,
        obExecUserId: details.obExecUserId || null,
        contractMediaId: details.contractMediaId ? String(details.contractMediaId) : null,
        customFields: {
          categoryIds: details.categoryIds || [],
          brandCategoryIds: details.brandCategoryIds || {},
          freeCollaboration: details.freeCollaboration || false,
          kcSalesperson: details.freeCollaboration ? (details.kcSalesperson || "").trim() : "",
        },
      }));

      const payload = {
        name,
        sellerCode,
        membershipId: membershipId.trim() || null,
        status,
        memberType: memberType || null,
        salesperson: salesperson.trim() || null,
        spocName: brandSpocs.length > 0 ? brandSpocs[0].name.trim() || null : null,
        spocPhone: brandSpocs.length > 0 ? brandSpocs[0].phone.trim() || null : null,
        spocEmail: brandSpocs.length > 0 ? brandSpocs[0].email.trim() || null : null,
        customFields: {
          ...customValues,
          salespersonDesignation: salespersonDesignation.trim(),
          brandSpocs: brandSpocs.map(s => ({
            name: s.name.trim(),
            phone: s.phone.trim(),
            email: s.email.trim(),
            designation: s.designation ? s.designation.trim() : "",
          })).filter(s => s.name || s.phone || s.email || s.designation),
        },
        brandIds: selectedBrandIds,
        categoryIds: pickedCategoryIds,
        contracts: contractPayload,
      };

      const res = await fetch(editing ? `/api/sellers/${seller!.id}` : "/api/sellers", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Save failed");
        return;
      }

      router.push("/ops/sellers");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  const L = "block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1";
  const I = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500";
  const card = "bg-white/60 backdrop-blur-md rounded-2xl border border-slate-200 p-6";

  function StepHeader({ n, title, sub }: { n: number; title: string; sub: string }) {
    return (
      <div className="flex items-center gap-3 mb-5">
        <span className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-bold">
          {n}
        </span>
        <div>
          <h2 className="font-bold text-slate-800">{title}</h2>
          <p className="text-xs text-slate-500">{sub}</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5 max-w-4xl">
      {/* Top bar */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {editing ? `Edit Seller: ${seller?.name}` : "Add New Seller"}
          </h1>
          <p className="text-sm text-slate-500">
            Define seller profile, associate operating brands, and configure program contracts.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push("/ops/sellers")}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-brand-600 text-white px-5 py-2 text-sm font-semibold hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? "Saving…" : editing ? "Update Seller" : "+ Add Seller"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
          {error}
        </div>
      )}

      {/* 1. Basic Info */}
      <div className={card}>
        <StepHeader n={1} title="Basic Information" sub="Primary identity details of the seller" />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={L}>Seller Name *</label>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!codeTouched) setSellerCode(slugFromName(e.target.value));
              }}
              required
              className={I}
              placeholder="e.g. Vendor Corp"
            />
          </div>
          <div>
            <label className={L}>Seller Code *</label>
            <input
              value={sellerCode}
              onChange={(e) => {
                setSellerCode(e.target.value);
                setCodeTouched(true);
              }}
              required
              className={`${I} font-mono`}
              placeholder="e.g. vendor-corp"
            />
          </div>
          <div>
            <label className={L}>Membership ID</label>
            <input
              value={membershipId}
              disabled
              readOnly
              className={`${I} bg-slate-50 cursor-not-allowed text-slate-500 font-mono`}
              placeholder={editing ? "No membership ID" : "Auto-generated on save"}
            />
          </div>
          <div>
            <label className={L}>Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={I}
            >
              <option value="active">Active</option>
              <option value="retired">Retired</option>
            </select>
          </div>
          <div>
            <label className={L}>Type of member</label>
            <select value={memberType} onChange={(e) => setMemberType(e.target.value)} className={I}>
              <option value="">— Select —</option>
              {MEMBER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={L}>KC Salesperson</label>
            <input value={salesperson} onChange={(e) => setSalesperson(e.target.value)} className={I} placeholder="KC salesperson" />
          </div>
          <div>
            <label className={L}>KC Salesperson Designation</label>
            <input value={salespersonDesignation} onChange={(e) => setSalespersonDesignation(e.target.value)} className={I} placeholder="Salesperson designation" />
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <label className={L}>Brand SPOCs</label>
            <button
              type="button"
              onClick={() => setBrandSpocs(prev => [...prev, { id: Date.now().toString(), name: '', phone: '', email: '', designation: '' }])}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700"
            >
              + Add SPOC
            </button>
          </div>
          <div className="space-y-3">
            {brandSpocs.length === 0 ? (
              <div className="text-center py-4 border border-dashed border-slate-200 rounded-xl bg-slate-50 text-slate-400 text-xs">
                No Brand SPOCs added yet. Click "+ Add SPOC" to add contact persons.
              </div>
            ) : (
              brandSpocs.map((spoc, idx) => (
                <div key={spoc.id} className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1 block">Name</label>
                    <input
                      value={spoc.name}
                      onChange={(e) => {
                        const updated = [...brandSpocs];
                        updated[idx].name = e.target.value;
                        setBrandSpocs(updated);
                      }}
                      className={I}
                      placeholder="Contact person"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1 block">Designation</label>
                    <input
                      value={spoc.designation || ""}
                      onChange={(e) => {
                        const updated = [...brandSpocs];
                        updated[idx].designation = e.target.value;
                        setBrandSpocs(updated);
                      }}
                      className={I}
                      placeholder="e.g. Manager"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1 block">Phone</label>
                    <input
                      value={spoc.phone}
                      onChange={(e) => {
                        const updated = [...brandSpocs];
                        updated[idx].phone = e.target.value;
                        setBrandSpocs(updated);
                      }}
                      className={I}
                      placeholder="+91…"
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1 block">Email</label>
                      <input
                        type="email"
                        value={spoc.email}
                        onChange={(e) => {
                          const updated = [...brandSpocs];
                          updated[idx].email = e.target.value;
                          setBrandSpocs(updated);
                        }}
                        className={I}
                        placeholder="name@company.com"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => setBrandSpocs(prev => prev.filter((_, i) => i !== idx))}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                        title="Remove SPOC"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 2. Brands Mapped */}
      <div className={card}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-100">
          <StepHeader
            n={2}
            title="Associated Brands"
            sub="Select the brands this seller is authorized to operate under"
          />
          <a
            href="/masters/brands/new?origin=seller-onboarding"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-slate-900 text-white px-4 py-2 text-xs font-semibold hover:bg-slate-800 transition shadow-sm inline-block self-end sm:self-auto"
          >
            + Create New Brand
          </a>
        </div>
        {localBrands.length === 0 ? (
          <p className="text-sm text-slate-400">
            No active brands in this branch. Please ask the Branch Admin to activate brands or click button to create one.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Search and Selection Status bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="relative flex-1 max-w-md">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  type="text"
                  value={brandSearch}
                  onChange={(e) => setBrandSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                    }
                  }}
                  placeholder="Search brands by name or code..."
                  className="w-full rounded-lg border border-slate-300 py-1.5 pl-9 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white/60 backdrop-blur-md"
                />
                {brandSearch && (
                  <button
                    type="button"
                    onClick={() => setBrandSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>
              
              <div className="flex items-center justify-between sm:justify-end gap-3 text-xs">
                <span className="font-semibold text-slate-650">
                  {selectedBrandIds.length} of {localBrands.length} selected
                </span>
                {selectedBrandIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedBrandIds([])}
                    className="text-brand-600 hover:text-brand-800 hover:underline font-semibold"
                  >
                    Clear selection
                  </button>
                )}
              </div>
            </div>

            {/* Grid of Brand Options */}
            {filteredBrands.length === 0 ? (
              <div className="text-center py-8 bg-white/60 backdrop-blur-md border border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm">
                No matching brands found for &ldquo;{brandSearch}&rdquo;.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[320px] overflow-y-auto pr-1">
                {filteredBrands.map((b) => {
                  const checked = selectedBrandIds.includes(b.id);
                  return (
                    <div
                      key={b.id}
                      onClick={() => toggleBrand(b.id)}
                      className={`relative flex items-center justify-between py-3.5 px-5 rounded-xl text-left text-sm font-medium transition-all group duration-150 hover:scale-[1.01] cursor-pointer ${
                        checked
                          ? "border-2 border-slate-900 bg-slate-100 text-slate-900 shadow-sm font-semibold dark:border-white dark:bg-white/10 dark:text-white"
                          : "border-2 border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 text-slate-700 dark:border-white/15 dark:bg-white/[0.03] dark:hover:bg-white/[0.07] dark:hover:border-white/25 dark:text-slate-200"
                      }`}
                    >
                      <div className="min-w-0 pr-6">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-semibold">{b.name}</span>
                          <button
                            type="button"
                            title="View Brand Details"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBrandDetailsId(b.id);
                            }}
                            className="inline-flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors rounded p-0.5"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                          {currentUserId && b.createdByUserId && String(b.createdByUserId) === String(currentUserId) && (
                            <a
                              href={`/masters/brands/${b.id}/edit?origin=seller-onboarding`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Edit this brand (you created it)"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center justify-center text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors rounded p-0.5"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </a>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate uppercase tracking-wider">{b.code}</div>
                      </div>
                      <span
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                          checked
                            ? "border-slate-900 bg-slate-900 text-white text-[10px] dark:border-white dark:bg-white dark:text-black"
                            : "border-slate-300 bg-white/60 backdrop-blur-md group-hover:border-slate-400 dark:border-white/30 dark:bg-transparent"
                        }`}
                      >
                        {checked && "✓"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Categories Operated In */}
      <div className={card}>
        <StepHeader n={3} title="Categories Operated In" sub="Categories are automatically added based on selected brands" />
        <div className="space-y-3">
        {selectedBrandIds.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl bg-slate-50 text-slate-500 text-sm">
            Select brands in Step 2 first. Categories will automatically populate from the selected brands.
          </div>
        ) : (
          <>
          {/* display categories per selected brand */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-800 mb-1">Operating Categories by Brand</h3>
            <p className="text-xs text-slate-500 mb-3">These categories are automatically pulled from your selected brands. Check the ones this seller operates in.</p>
            <div className="grid gap-3">
              {selectedBrandIds.map((bid) => {
                const brand = brands.find((b) => String(b.id) === String(bid));
                const catIds = brand?.brandCategories?.map((bc) => String(bc.categoryId)) ?? [];
                const uniqueCatIds = Array.from(new Set(catIds));

                // Group brand categories by level (up to L4)
                const categoriesByLevel = [1, 2, 3, 4].map((levelNum) => {
                  const levelMetaInfo = levelMeta(levelNum);
                  const nodes = uniqueCatIds
                    .map((cid) => byId.get(cid))
                    .filter((node) => node && node.level === levelNum) as any[];
                  return { levelNum, levelMetaInfo, nodes };
                }).filter((group) => group.nodes.length > 0);

                if (uniqueCatIds.length === 0) {
                  return (
                    <div key={bid} className="bg-amber-50/50 border border-amber-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className="font-bold text-amber-800 text-sm">{brand?.name}</span>
                      </div>
                      <p className="text-xs text-amber-700 mb-2">No categories defined for this brand. Please configure categories for this brand in the brand master.</p>
                      <button
                        type="button"
                        onClick={() => setSelectedBrandForCategoryEdit(bid)}
                        className="text-xs font-semibold text-amber-800 hover:text-amber-950 hover:underline"
                      >
                        + Manage Brand Categories
                      </button>
                    </div>
                  );
                }

                if (categoriesByLevel.length === 0) {
                  return (
                    <div key={bid} className="bg-slate-50/50 border border-slate-200 rounded-xl p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-brand-500"></span>
                        <span className="font-bold text-slate-800 text-sm">{brand?.name} Categories</span>
                      </div>
                      <p className="text-xs text-slate-500 mb-2">No L1-L4 categories mapped to this brand.</p>
                      <button
                        type="button"
                        onClick={() => setSelectedBrandForCategoryEdit(bid)}
                        className="text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline"
                      >
                        + Manage Brand Categories
                      </button>
                    </div>
                  );
                }

                const l1ToL4CatIds = categoriesByLevel.flatMap((g) => g.nodes.map((n) => n.id));

                return (
                  <div key={bid} className="bg-slate-50/50 border border-slate-200 rounded-xl p-4 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-brand-500"></span>
                      <span className="font-bold text-slate-800 text-sm">{brand?.name} Categories</span>
                      <span className="text-[10px] text-slate-400 ml-auto">{l1ToL4CatIds.filter(cid => pickedCategoryIds.includes(cid)).length}/{l1ToL4CatIds.length} selected</span>
                      <button
                        type="button"
                        onClick={() => setSelectedBrandForCategoryEdit(bid)}
                        className="text-[10px] font-semibold text-brand-600 hover:text-brand-850 hover:underline"
                      >
                        + Manage Brand Categories
                      </button>
                      <span className="text-[10px] text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => {
                          const allSelected = l1ToL4CatIds.every((cid) => pickedCategoryIds.includes(cid));
                          if (allSelected) {
                            // Deselect all matching brand categories
                            setPickedCategoryIds((prev) => prev.filter((x) => !l1ToL4CatIds.includes(x)));
                            setActiveContracts((prev) => {
                              const next: typeof prev = {};
                              for (const [programId, contract] of Object.entries(prev)) {
                                const nextCategoryIds = (contract.categoryIds ?? []).filter((id) => !l1ToL4CatIds.includes(id));
                                const nextBrandCategoryIds: Record<string, string[]> = {};
                                for (const [bId, cats] of Object.entries(contract.brandCategoryIds ?? {})) {
                                  nextBrandCategoryIds[bId] = cats.filter((id) => !l1ToL4CatIds.includes(id));
                                }
                                next[programId] = {
                                  ...contract,
                                  categoryIds: nextCategoryIds,
                                  brandCategoryIds: nextBrandCategoryIds,
                                };
                              }
                              return next;
                            });
                          } else {
                            // Select all matching brand categories
                            setPickedCategoryIds((prev) => {
                              const newIds = l1ToL4CatIds.filter((cid) => !prev.includes(cid));
                              return [...prev, ...newIds];
                            });
                          }
                        }}
                        className="text-[10px] font-semibold text-brand-600 hover:text-brand-700 hover:underline"
                      >
                        {l1ToL4CatIds.every((cid) => pickedCategoryIds.includes(cid)) ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>

                    <div className="space-y-3.5">
                      {categoriesByLevel.map(({ levelNum, levelMetaInfo, nodes }) => (
                        <div key={levelNum} className="space-y-2">
                          <div className="flex items-center gap-1.5 select-none">
                            <span className={`text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded ${levelMetaInfo.badge}`}>
                              {levelMetaInfo.label}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {nodes.map((node) => {
                              const cid = node.id;
                              const isChecked = pickedCategoryIds.includes(cid);
                              return (
                                <button
                                  key={cid}
                                  type="button"
                                  onClick={() => {
                                    if (isChecked) {
                                      setPickedCategoryIds((prev) => prev.filter((x) => x !== cid));
                                      setActiveContracts((prev) => {
                                        let changed = false;
                                        const next: typeof prev = {};
                                        for (const [programId, contract] of Object.entries(prev)) {
                                          const nextCategoryIds = (contract.categoryIds ?? []).filter((id) => id !== cid);
                                          const nextBrandCategoryIds: Record<string, string[]> = {};
                                          for (const [bId, cats] of Object.entries(contract.brandCategoryIds ?? {})) {
                                            nextBrandCategoryIds[bId] = cats.filter((id) => id !== cid);
                                          }
                                          if (nextCategoryIds.length !== (contract.categoryIds ?? []).length) changed = true;
                                          next[programId] = {
                                            ...contract,
                                            categoryIds: nextCategoryIds,
                                            brandCategoryIds: nextBrandCategoryIds,
                                          };
                                        }
                                        return changed ? next : prev;
                                      });
                                    } else {
                                      setPickedCategoryIds((prev) => [...prev, cid]);
                                    }
                                  }}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition active:scale-[0.98] ${
                                    isChecked
                                      ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                                      : "bg-white/80 backdrop-blur-sm text-slate-750 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                                  }`}
                                >
                                  {isChecked && <span className="text-[10px]">✓</span>}
                                  <span>{node.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          </>
        )}
        </div>
      </div>

      {/* 4. Contracts */}
      <div className={card}>
        <StepHeader
          n={4}
          title="Program Contracts"
          sub="Assign programs and define the tenure & start/end collaboration metrics"
        />
        {programs.length === 0 ? (
          <p className="text-sm text-slate-400">
            No active programs in this branch. Please ask the Branch Admin to link programs.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 mb-4">
              {programs.map((p) => {
                const checked = !!activeContracts[p.id];
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleProgram(p.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                      checked
                        ? "bg-brand-600 text-white border-brand-600"
                        : "bg-white/60 backdrop-blur-md text-slate-600 border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {p.name} {checked ? "✓" : "+"}
                  </button>
                );
              })}
            </div>

            {Object.keys(activeContracts).length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-250/60 pb-3.5 mb-4">
                {programs
                  .filter((p) => !!activeContracts[p.id])
                  .map((p) => {
                    const details = activeContracts[p.id];
                    const active = activeContractTab === p.id;
                    const isComplete = details.collaborationTenure && details.fitoutPeriod && details.baseStartDate;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setActiveContractTab(p.id)}
                        className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition duration-150 active:scale-[0.98] border ${
                          active
                            ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isComplete ? "bg-emerald-500" : "bg-amber-400"}`}></span>
                        <span>{p.name} Contract</span>
                      </button>
                    );
                  })}
              </div>
            )}

            <div className="space-y-4">
              {programs
                .filter((p) => p.id === activeContractTab && !!activeContracts[p.id])
                .map((p) => {
                  const details = activeContracts[p.id];
                  return (
                    <div
                      key={p.id}
                      className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                        <div className="font-bold text-sm text-slate-800">{p.name} Contract</div>
                        <button
                          type="button"
                          onClick={() => toggleProgram(p.id)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Remove Contract
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-6 pb-2 border-b border-slate-100/60">
                        {/* Left Column: Collaboration Tenure Dates */}
                        <div className="space-y-4">
                          <div>
                            <label className={L}>Collaboration Tenure ( In Days )</label>
                            <input
                              value={details.collaborationTenure}
                              onChange={(e) =>
                                updateContract(p.id, "collaborationTenure", e.target.value.replace(/\D/g, ""))
                              }
                              className={I}
                              placeholder="e.g. 365"
                            />
                            {details.collaborationTenure && formatDaysToYMD(details.collaborationTenure) && (
                              <div className="text-[11px] text-slate-500 mt-1 font-semibold">
                                Equivalent to: <span className="text-brand-600 font-bold">{formatDaysToYMD(details.collaborationTenure)}</span>
                              </div>
                            )}
                          </div>
                          <div>
                            <label className={L}>Collaboration Tenure Start Date</label>
                            <input
                              type="date"
                              value={details.contractStart}
                              readOnly
                              disabled
                              className={`${I} bg-slate-50 cursor-not-allowed`}
                            />
                          </div>
                          <div>
                            <label className={L}>Collaboration Tenure End Date</label>
                            <input
                              type="date"
                              value={details.contractEnd}
                              readOnly
                              disabled
                              className={`${I} bg-slate-50 cursor-not-allowed`}
                            />
                          </div>
                        </div>

                        {/* Right Column: Fitout Period Dates */}
                        <div className="space-y-4">
                          <div>
                            <label className={L}>Fitout Period ( In Days )</label>
                            <input
                              value={details.fitoutPeriod}
                              onChange={(e) =>
                                updateContract(p.id, "fitoutPeriod", e.target.value.replace(/\D/g, ""))
                              }
                              className={I}
                              placeholder="e.g. 45"
                            />
                            {details.fitoutPeriod && formatDaysToYMD(details.fitoutPeriod) && (
                              <div className="text-[11px] text-slate-500 mt-1 font-semibold">
                                Equivalent to: <span className="text-brand-600 font-bold">{formatDaysToYMD(details.fitoutPeriod)}</span>
                              </div>
                            )}
                          </div>
                          <div>
                            <label className={L}>Fitout Period Start Date</label>
                            <input
                              type="date"
                              value={details.baseStartDate}
                              onChange={(e) =>
                                updateContract(p.id, "baseStartDate", e.target.value)
                              }
                              className={I}
                            />
                          </div>
                          <div>
                            <label className={L}>Fitout Period End Date</label>
                            <input
                              type="date"
                              value={details.fitoutEnd}
                              readOnly
                              disabled
                              className={`${I} bg-slate-50 cursor-not-allowed`}
                            />
                          </div>
                        </div>

                        {details.baseStartDate && (
                          <div className="col-span-2 mt-1 text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-wrap items-center gap-y-2 gap-x-4 shadow-sm">
                            <span className="font-semibold text-brand-700 uppercase tracking-wider text-[10px]">Timeline Sequence:</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400">Fitout Start:</span>
                              <strong className="text-slate-800">{formatDMY(details.baseStartDate)}</strong>
                            </div>
                            <span className="text-slate-300 font-bold">➔</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400">Fitout End:</span>
                              <strong className="text-slate-800">{details.fitoutEnd ? formatDMY(details.fitoutEnd) : "—"}</strong>
                            </div>
                            <span className="text-slate-300 font-bold">➔</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400">Collab Start:</span>
                              <strong className="text-brand-600">{formatDMY(details.contractStart)}</strong>
                            </div>
                            <span className="text-slate-300 font-bold">➔</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400">Collab End:</span>
                              <strong className="text-brand-600">{formatDMY(details.contractEnd)}</strong>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="pt-2 flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer font-medium select-none">
                          <input
                            type="checkbox"
                            checked={details.verified}
                            onChange={(e) =>
                              updateContract(p.id, "verified", e.target.checked)
                            }
                            className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                          />
                          Contract Verified ( In Future We Will Be Verified It Legally )
                        </label>
                      </div>

                      <div className="pt-2 flex flex-col gap-4 border-t border-slate-100/60 mt-3 pt-3">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 text-sm text-slate-750 cursor-pointer font-semibold select-none">
                            <input
                              type="checkbox"
                              checked={details.freeCollaboration || false}
                              onChange={(e) => {
                                updateContract(p.id, "freeCollaboration", e.target.checked);
                                if (!e.target.checked) {
                                  updateContract(p.id, "kcSalesperson", "");
                                }
                              }}
                              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                            />
                            Free Collaboration
                          </label>
                        </div>

                        {details.freeCollaboration && (
                          <div className="space-y-1">
                            <label className={L}>KC Salesperson *</label>
                            <input
                              type="text"
                              list="salesperson-suggestions"
                              value={details.kcSalesperson || ""}
                              onChange={(e) =>
                                updateContract(p.id, "kcSalesperson", e.target.value)
                              }
                              required
                              className={I}
                              placeholder="Type or select KC Salesperson"
                            />
                          </div>
                        )}
                      </div>

                      <div>
                        <label className={L}>Remarks / Notes</label>
                        <textarea
                          value={details.remarks}
                          onChange={(e) => updateContract(p.id, "remarks", e.target.value)}
                          rows={2}
                          className={I}
                          placeholder="Special collaboration clauses, revenue sharing rules…"
                        />
                      </div>

                      {/* PDF upload field */}
                      <div className="pt-2">
                        <label className={L}>Contract Proof (PDF)</label>
                        <div className="flex flex-wrap items-center gap-3">
                          {details.contractMediaUrl ? (
                            <a
                              href={details.contractMediaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-xs font-semibold text-brand-600 hover:text-brand-850 bg-white/60 backdrop-blur-md border border-slate-200 px-3.5 py-2.5 rounded-lg shadow-sm transition active:scale-[0.98]"
                            >
                              <svg className="w-4 h-4 text-brand-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <span>View Uploaded PDF</span>
                            </a>
                          ) : (
                            <div className="text-xs text-slate-400 bg-white/60 backdrop-blur-md border border-slate-200 border-dashed px-3.5 py-2.5 rounded-lg select-none">
                              No PDF uploaded yet
                            </div>
                          )}
                          
                          <label className={`cursor-pointer rounded-lg border border-slate-300 bg-white/60 backdrop-blur-md px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition select-none ${contractUploadingMap[p.id] ? "opacity-60 cursor-not-allowed" : ""}`}>
                            {contractUploadingMap[p.id] ? "Uploading..." : details.contractMediaUrl ? "Change PDF File" : " Upload Contract PDF"}
                            <input
                              type="file"
                              accept="application/pdf"
                              onChange={(e) => onContractPdf(p.id, e)}
                              className="hidden"
                              style={{ display: "none" }}
                              disabled={!!contractUploadingMap[p.id]}
                            />
                          </label>

                          {details.contractMediaUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                updateContract(p.id, "contractMediaId", null);
                                updateContract(p.id, "contractMediaUrl", null);
                              }}
                              className="text-xs font-semibold text-red-500 hover:text-red-700 bg-white/60 backdrop-blur-md border border-slate-200 px-3 py-2.5 rounded-lg hover:bg-red-50 transition active:scale-[0.98] shadow-sm"
                            >
                              Remove PDF
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Map categories to this program */}
                      <div className="pt-3 border-t border-slate-100/60">
                        <label className={L}>Map Categories to {p.name} <span className="text-[10px] text-slate-400 normal-case font-normal">(select categories per brand)</span></label>
                        {pickedCategoryIds.length === 0 ? (
                          <div className="text-center py-4 border border-dashed border-amber-200 rounded-xl bg-amber-50/30 text-amber-700 text-xs font-medium mt-2">
                            <svg className="w-5 h-5 mx-auto mb-1 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            Please select categories in Step 3 first.
                          </div>
                        ) : (
                          <div className="space-y-3 mt-2">
                            {selectedBrandIds.map((bid) => {
                              const brand = brands.find((b) => String(b.id) === String(bid));
                              const brandCatIds = brand?.brandCategories?.map((bc) => String(bc.categoryId)) ?? [];
                              const activeBrandCats = brandCatIds.filter((cid) => pickedCategoryIds.includes(cid) && (byId.get(cid)?.level ?? 0) <= 4);
                              
                              if (activeBrandCats.length === 0) return null;

                              return (
                                <div key={bid} className="bg-white/40 rounded-xl p-3 border border-slate-200 shadow-xs">
                                  <div className="text-xs font-bold text-slate-700 mb-2">{brand?.name} Categories</div>
                                  <div className="flex flex-wrap gap-2">
                                    {activeBrandCats.map((cid) => {
                                      const node = byId.get(cid);
                                      const isChecked = (details.brandCategoryIds?.[String(bid)] ?? []).includes(cid);
                                      return (
                                        <button
                                          key={cid}
                                          type="button"
                                          onClick={() => toggleContractCategory(p.id, String(bid), cid)}
                                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition active:scale-[0.98] ${
                                            isChecked
                                              ? "bg-brand-50 text-brand-700 border-brand-300 shadow-xs font-bold"
                                              : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                                          }`}
                                        >
                                          {isChecked && "✓ "}
                                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 font-medium text-slate-500">
                                            {node ? levelMeta(node.level).label : ""}
                                          </span>
                                          {node?.name ?? cid}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}

                            {(() => {
                              const allBrandCatIds = new Set<string>();
                              selectedBrandIds.forEach((bid) => {
                                const brand = brands.find((b) => String(b.id) === String(bid));
                                brand?.brandCategories?.forEach((bc) => allBrandCatIds.add(String(bc.categoryId)));
                              });
                              const otherCats = pickedCategoryIds.filter((cid) => !allBrandCatIds.has(cid) && (byId.get(cid)?.level ?? 0) <= 4);

                              if (otherCats.length === 0) return null;

                              return (
                                <div className="bg-white/40 rounded-xl p-3 border border-slate-200 shadow-xs">
                                  <div className="text-xs font-bold text-slate-700 mb-2">Other / Manually Added Categories</div>
                                  <div className="flex flex-wrap gap-2">
                                    {otherCats.map((cid) => {
                                      const node = byId.get(cid);
                                      const isChecked = (details.brandCategoryIds?.["other"] ?? []).includes(cid);
                                      return (
                                        <button
                                          key={cid}
                                          type="button"
                                          onClick={() => toggleContractCategory(p.id, "other", cid)}
                                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition active:scale-[0.98] ${
                                            isChecked
                                              ? "bg-brand-50 text-brand-700 border-brand-300 shadow-xs font-bold"
                                              : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                                          }`}
                                        >
                                          {isChecked && "✓ "}
                                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 font-medium text-slate-500">
                                            {node ? levelMeta(node.level).label : ""}
                                          </span>
                                          {node?.name ?? cid}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

              {Object.keys(activeContracts).length === 0 && (
                <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl bg-white/60 backdrop-blur-md text-slate-400 text-sm">
                  Click a program button above to create a contract for it.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 5. Executive Assignments */}
      {Object.keys(activeContracts).length > 0 && (
        <div className={card}>
          <StepHeader
            n={5}
            title="Onboarding Executive Assignments"
            sub="Assign an onboarding executive for each active program contract"
          />
          <div className="space-y-4">
            {programs
              .filter((p) => !!activeContracts[p.id])
              .map((p) => {
                const details = activeContracts[p.id];
                return (
                  <div
                    key={p.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-white/60 backdrop-blur-md shadow-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800 text-sm">
                        {p.name}
                      </div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">
                        Program Code: {p.code}
                      </div>
                    </div>
                    <div className="w-full sm:max-w-xs">
                      <label className="sr-only">Choose Executive</label>
                      <select
                        value={details.obExecUserId}
                        onChange={(e) =>
                          updateContract(p.id, "obExecUserId", e.target.value)
                        }
                        required
                        className={I}
                      >
                        <option value="">— Select Executive —</option>
                        {execs.map((ex) => {
                          const count = ex._count?.assignments ?? 0;
                          return (
                            <option key={ex.id} value={ex.id}>
                              {ex.fullName} ({ex.email}) — {count} work{count === 1 ? "" : "s"}
                            </option>
                          );
                        })}
                      </select>
                      {details.obExecUserId && (() => {
                        const selectedExec = execs.find((e) => String(e.id) === String(details.obExecUserId));
                        if (!selectedExec) return null;
                        const count = selectedExec._count?.assignments ?? 0;
                        return (
                          <div className="mt-1.5 text-xs text-slate-500 font-medium">
                            Currently assigned: <span className="font-semibold text-brand-600">{count} active work{count === 1 ? "" : "s"}</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Additional (HO-defined) fields */}
      {customFieldDefs.length > 0 && (
        <div className={card}>
          <StepHeader n={6} title="Section Fields" sub="Extra fields defined by HO for this onboarding" />
          <div className="grid grid-cols-2 gap-4">
            {customFieldDefs.map((f) => (
              <div key={f.id}>
                <label className={L}>
                  {f.label}
                  {f.isRequired && <span className="text-red-500"> *</span>}
                </label>
                {f.fieldType === "enum" ? (
                  <select value={customValues[f.code] ?? ""} onChange={(e) => setCustomValues((v) => ({ ...v, [f.code]: e.target.value }))} className={I}>
                    <option value="">— Select —</option>
                    {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    type={f.fieldType === "number" ? "number" : f.fieldType === "date" ? "date" : "text"}
                    value={customValues[f.code] ?? ""}
                    onChange={(e) => setCustomValues((v) => ({ ...v, [f.code]: e.target.value }))}
                    className={I}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push("/ops/sellers")}
          className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand-600 text-white px-6 py-2.5 text-sm font-semibold hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? "Saving…" : editing ? "Update Seller" : "+ Add Seller"}
        </button>
      </div>
      <BrandDetailsModal
        brandId={selectedBrandDetailsId}
        onClose={() => setSelectedBrandDetailsId(null)}
      />
      <BrandCategoryEditModal
        brandId={selectedBrandForCategoryEdit}
        flatCategories={flatCategories}
        onClose={() => setSelectedBrandForCategoryEdit(null)}
        onSave={() => {
          // Refresh the brand list to show updated categories
          router.refresh();
          setSelectedBrandForCategoryEdit(null);
        }}
      />
      <datalist id="salesperson-suggestions">
        {salespersons.map((sp) => (
          <option key={sp} value={sp} />
        ))}
      </datalist>
    </form>
  );
}

"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BRAND_TYPES, AGREEMENT_DURATIONS, durationMonths, addMonths, formatDMY, isValidGstin, brandCodeBase } from "@/lib/brandMeta";
import { buildParentOptions, FlatCat } from "@/lib/categoryTree";
import { isValidPhone, isValidEmail, isValidPincode, isAlphabetic, isNonEmptyString } from "@/lib/validation";
import { LEVELS, levelMeta } from "@/lib/categoryLevels";

const PHONE_CCS = ["+91", "+1", "+44", "+971", "+65", "+61"];
const COUNTRIES = [
  "India", "United States", "United Kingdom", "United Arab Emirates", "Saudi Arabia",
  "Singapore", "Australia", "Canada", "Germany", "France", "Japan", "China",
  "Brazil", "South Africa", "Russia", "Italy", "Spain", "Netherlands", "Switzerland",
  "Sweden", "Norway", "Denmark", "Finland", "Ireland", "New Zealand", "Malaysia",
  "Thailand", "Indonesia", "Vietnam", "Philippines", "Turkey", "Mexico", "Argentina",
  "Colombia", "Egypt", "Nigeria", "Kenya", "Bangladesh", "Pakistan", "Sri Lanka",
  "Nepal", "Bhutan", "Maldives"
];

export type BrandEdit = {
  id: string;
  name: string;
  code: string;
  brandType: string | null;
  logoMediaId: string | null;
  logoUrl: string | null;
  contactPerson: string | null;
  contactPersonDesignation: string | null;
  phoneCc: string | null;
  phone: string | null;
  email: string | null;
  contacts: any[] | null;
  website: string | null;
  socialLinkedin: string | null;
  socialTwitter: string | null;
  socialInstagram: string | null;
  socialYoutube: string | null;
  address: string | null;
  pincode: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  gstNumber: string | null;
  agreementDuration: string | null;
  contractStart: string | null; // yyyy-mm-dd
  description: string | null;
  categoryIds: string[];
};

export default function BrandForm({ flat, brand }: { flat: FlatCat[]; brand?: BrandEdit }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const origin = searchParams.get("origin");
  const [success, setSuccess] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const editing = !!brand;
  const parents = useMemo(() => buildParentOptions(flat), [flat]);
  const byId = useMemo(() => new Map(parents.map((p) => [p.id, p])), [parents]);

  // basic
  const [name, setName] = useState(brand?.name ?? "");
  const [code, setCode] = useState(brand?.code ?? "");
  const [codeTouched, setCodeTouched] = useState(editing);
  const [brandType, setBrandType] = useState(brand?.brandType ?? "");
  // logo
  const [logoMediaId, setLogoMediaId] = useState<string | null>(brand?.logoMediaId ?? null);
  const [logoUrl, setLogoUrl] = useState(brand?.logoUrl ?? "");
  const [logoBusy, setLogoBusy] = useState(false);
  // contact
  type ContactInput = {
    name: string;
    designation: string;
    phoneCc: string;
    phone: string;
    email: string;
  };
  const [contacts, setContacts] = useState<ContactInput[]>(() => {
    if (brand?.contacts && Array.isArray(brand.contacts) && brand.contacts.length > 0) {
      return brand.contacts.map((c: any) => ({
        name: c.name ?? "",
        designation: c.designation ?? "",
        phoneCc: c.phoneCc ?? "+91",
        phone: c.phone ?? "",
        email: c.email ?? "",
      }));
    }
    return [
      {
        name: brand?.contactPerson ?? "",
        designation: brand?.contactPersonDesignation ?? "",
        phoneCc: brand?.phoneCc ?? "+91",
        phone: brand?.phone ?? "",
        email: brand?.email ?? "",
      },
    ];
  });
  const [website, setWebsite] = useState(brand?.website ?? "");
  const [socialLinkedin, setSocialLinkedin] = useState(brand?.socialLinkedin ?? "");
  const [socialTwitter, setSocialTwitter] = useState(brand?.socialTwitter ?? "");
  const [socialInstagram, setSocialInstagram] = useState(brand?.socialInstagram ?? "");
  const [socialYoutube, setSocialYoutube] = useState(brand?.socialYoutube ?? "");
  const [address, setAddress] = useState(brand?.address ?? "");
  const [pincode, setPincode] = useState(brand?.pincode ?? "");
  const [city, setCity] = useState(brand?.city ?? "");
  const [stateName, setStateName] = useState(brand?.state ?? "");
  const [country, setCountry] = useState(brand?.country ?? "India");
  // contract
  const [gstNumber, setGstNumber] = useState(brand?.gstNumber ?? "");
  const [agreementDuration, setAgreementDuration] = useState(brand?.agreementDuration ?? "");
  const [contractStart, setContractStart] = useState(brand?.contractStart ?? "");
  const [description, setDescription] = useState(brand?.description ?? "");
  // categories operated in
  const [sel, setSel] = useState<Record<number, string>>({});
  const [picked, setPicked] = useState<string[]>(brand?.categoryIds ?? []); // category ids
  const [categorySearch, setCategorySearch] = useState("");

  const matchedCategories = useMemo(() => {
    const query = categorySearch.trim().toLowerCase();
    if (!query) return [];
    return parents.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.number.toLowerCase().includes(query)
    ).slice(0, 50);
  }, [parents, categorySearch]);

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const months = durationMonths(agreementDuration);
  const contractEnd = contractStart && months ? addMonths(contractStart, months) : "";

  // Auto close tab on success
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        try {
          window.close();
        } catch (e) {
          console.error(e);
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // ---- category cascade ----
  function optionsForLevel(k: number) {
    let opts;
    if (k === 1) opts = parents.filter((p) => p.level === 1);
    else {
      const parentSel = sel[k - 1];
      if (!parentSel) return [];
      opts = parents.filter((p) => p.level === k && p.parentId === parentSel);
    }

    // Apply search filter
    if (categorySearch.trim()) {
      const query = categorySearch.toLowerCase();
      opts = opts.filter(o =>
        o.name.toLowerCase().includes(query) ||
        o.number.toLowerCase().includes(query)
      );
    }

    return opts;
  }
  function selectAt(k: number, id: string) {
    setSel((prev) => {
      const next: Record<number, string> = {};
      for (let i = 1; i < k; i++) if (prev[i]) next[i] = prev[i];
      next[k] = id;
      return next;
    });
  }
  // deepest currently-selected node id
  const deepest = useMemo(() => {
    let id: string | null = null;
    for (let k = 1; k <= LEVELS.length; k++) if (sel[k]) id = sel[k];
    return id;
  }, [sel]);

  function addAssociation() {
    if (!deepest || picked.includes(deepest)) return;
    setPicked((p) => [...p, deepest]);
    setSel({});
  }
  function removeAssociation(id: string) {
    setPicked((p) => p.filter((x) => x !== id));
  }

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Logo upload failed");
        return;
      }
      setLogoMediaId(data.mediaId);
      setLogoUrl(data.url);
    } catch {
      setError("Logo upload failed");
    } finally {
      setLogoBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!isNonEmptyString(name)) {
      setError("Brand Name is required");
      return;
    }
    if (!logoMediaId) {
      setError("Brand logo is required");
      return;
    }
    if (gstNumber && !isValidGstin(gstNumber)) {
      setError("Please enter a valid GSTIN or leave it blank");
      return;
    }
    // Validate each contact person
    for (let idx = 0; idx < contacts.length; idx++) {
      const c = contacts[idx];
      const indexLabel = contacts.length > 1 ? ` for Contact Person #${idx + 1}` : "";
      
      if (c.email && !isValidEmail(c.email)) {
        setError(`Please enter a valid email address containing '@'${indexLabel}`);
        return;
      }
      if (c.phone && !isValidPhone(c.phone)) {
        setError(`Phone number must be exactly 10 digits${indexLabel}`);
        return;
      }
    }

    if (pincode && !isValidPincode(pincode)) {
      setError("Pincode must be exactly 6 digits");
      return;
    }
    if (city && !isAlphabetic(city)) {
      setError("City must contain only letters");
      return;
    }
    if (stateName && !isAlphabetic(stateName)) {
      setError("State must contain only letters");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name, code, brandType: brandType || null, logoMediaId,
        contactPerson: contacts[0]?.name || null,
        contactPersonDesignation: contacts[0]?.designation || null,
        phoneCc: contacts[0]?.phoneCc || "+91",
        phone: contacts[0]?.phone || null,
        email: contacts[0]?.email || null,
        contacts: contacts.map(c => ({
          name: c.name || null,
          designation: c.designation || null,
          phoneCc: c.phoneCc || "+91",
          phone: c.phone || null,
          email: c.email || null,
        })),
        website: website || null,
        socialLinkedin: socialLinkedin || null,
        socialTwitter: socialTwitter || null,
        socialInstagram: socialInstagram || null,
        socialYoutube: socialYoutube || null,
        address: address || null, pincode: pincode || null, city: city || null,
        state: stateName || null, country: country || null,
        gstNumber: gstNumber || null, agreementDuration: agreementDuration || null,
        contractStart: contractStart || null, contractEnd: contractEnd || null,
        description: description || null,
        categoryIds: picked,
      };
      const res = await fetch(editing ? `/api/brands/${brand!.id}` : "/api/brands", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Save failed"); return; }

      // Broadcast creation event; HO admin UI can filter pending approvals
      try {
        const channel = new BroadcastChannel("brand_creation");
        channel.postMessage({
          type: "BRAND_CREATED",
          brand: {
            id: String(data.brand.id),
            name: data.brand.name,
            code: data.brand.code,
            status: data.brand.status,
            approvalStatus: data.brand.approvalStatus,
          }
        });
        channel.close();
      } catch (err) {
        console.error("Broadcast failed:", err);
      }

      if (origin === "seller-onboarding") {
        setSuccess(true);
      } else {
        router.push("/masters/brands");
        router.refresh();
      }
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
        <span className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-bold">{n}</span>
        <div>
          <h2 className="font-bold text-slate-800">{title}</h2>
          <p className="text-xs text-slate-500">{sub}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-white/60 backdrop-blur-md rounded-3xl border border-slate-200 max-w-lg mx-auto mt-16 shadow-lg space-y-6">
        <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center animate-bounce">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-800">Brand Created Successfully!</h2>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            The brand <span className="font-semibold text-slate-900">{name}</span> has been created. It is now active and available for association under seller onboarding.
          </p>
        </div>
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-500 w-full">
           This window will close automatically in 3 seconds...
        </div>
        <button
          type="button"
          onClick={() => window.close()}
          className="w-full rounded-xl bg-slate-900 text-white py-3 text-sm font-semibold hover:bg-slate-800 transition active:scale-[0.98]"
        >
          Close Tab Now
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5 max-w-4xl">
      {origin === "seller-onboarding" && (
        <div className="rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 text-sm p-4 flex items-start gap-3 shadow-sm dark:bg-white/[0.04] dark:border-white/10 dark:text-slate-300">
          <div className="p-1.5 bg-slate-200 rounded-lg text-slate-600 dark:bg-white/10 dark:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <div className="font-semibold text-slate-900 dark:text-white">Adding Brand to Seller Onboarding</div>
            <div className="text-xs text-slate-500 mt-0.5 dark:text-slate-400">
              Once submitted, the brand will be created immediately as active and will appear in the associated brands list on the seller onboarding page.
            </div>
          </div>
        </div>
      )}
      {/* Top bar */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{editing ? `Edit Brand` : "Add New Brand"}</h1>
          <p className="text-sm text-slate-500">Fill in the brand details, operating categories, and contract terms below</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => router.push("/masters/brands")} className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={busy} className="rounded-lg bg-brand-600 text-white px-5 py-2 text-sm font-semibold hover:bg-brand-700 disabled:opacity-60">
            {busy ? "Saving…" : editing ? "Update Brand" : "+ Add Brand"}
          </button>
        </div>
      </div>

      {error && <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}

      {/* 1. Basic */}
      <div className={card}>
        <StepHeader n={1} title="Basic Information" sub="Primary identification details for the brand" />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={L}>Brand Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className={I} placeholder="e.g. Asian Paints" />
          </div>
          <div>
            <label className={L}>Brand Code <span className="font-normal text-slate-400 normal-case">(auto)</span></label>
            <input
              value={editing ? code : name ? `${brandCodeBase(name)}-…` : ""}
              readOnly
              className={`${I} font-mono bg-slate-50 text-slate-500`}
              placeholder="auto from name"
            />
            <p className="text-[11px] text-slate-400 mt-1">Auto-generated, e.g. Century → CNRY-10. Number assigned on save.</p>
          </div>
          <div>
            <label className={L}>Brand Type</label>
            <select value={brandType} onChange={(e) => setBrandType(e.target.value)} className={I}>
              <option value="">Select type</option>
              {BRAND_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={L}>Logo *</label>
            <div className="flex items-center gap-3">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="logo" className="w-12 h-12 rounded-lg object-contain border border-slate-200 bg-white/60 backdrop-blur-md" />
              ) : (
                <div className="w-12 h-12 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-300 text-xs">IMG</div>
              )}
              <label className="flex-1 cursor-pointer rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50 text-center">
                {logoBusy ? "Uploading…" : logoUrl ? "Change logo" : " Choose Logo File"}
                <input type="file" accept="image/*" onChange={onLogo} className="hidden" style={{ display: "none" }} />
              </label>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">PNG/JPG/WEBP, max 5 MB.</p>
          </div>
        </div>
      </div>

      {/* 2. Categories Operated In */}
      <div className={card}>
        <StepHeader n={2} title="Categories Operated In" sub="Link the brand to categories in your taxonomy" />
        <div className="space-y-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
              placeholder="Search categories by name or code..."
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            />
            {categorySearch && (
              <button
                type="button"
                onClick={() => setCategorySearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}

            {/* Dynamic Search Results Dropdown */}
            {categorySearch.trim() !== "" && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-[110] max-h-60 overflow-y-auto divide-y divide-slate-100 dark:bg-slate-900 dark:border-slate-800 dark:divide-slate-800">
                {matchedCategories.length === 0 ? (
                  <div className="p-3 text-xs text-slate-400 text-center dark:text-slate-500">
                    No matching categories found
                  </div>
                ) : (
                  matchedCategories.map((o) => {
                    const lvl = levelMeta(o.level);
                    const isAlreadyPicked = picked.includes(o.id);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        disabled={isAlreadyPicked}
                        onClick={() => {
                          setPicked((prev) => [...prev, o.id]);
                          setCategorySearch("");
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center justify-between text-xs transition-colors disabled:opacity-50 disabled:hover:bg-transparent dark:hover:bg-slate-800/50"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${lvl.badge}`}>
                            {lvl.label}
                          </span>
                          <span className="font-mono font-bold text-slate-450 dark:text-slate-500">{o.number}</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-350">{o.name}</span>
                        </div>
                        {isAlreadyPicked ? (
                          <span className="text-[10px] text-emerald-600 font-bold dark:text-emerald-400">Added</span>
                        ) : (
                          <span className="text-[10px] text-brand-600 font-semibold dark:text-brand-400">+ Add</span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
          {LEVELS.map((lvl, idx) => {
            const k = idx + 1;
            if (k > 1 && !sel[k - 1]) return null;
            const opts = optionsForLevel(k);
            return (
              <div key={k} className="flex items-center gap-2">
                <span className={`text-[10px] px-2 py-0.5 rounded font-medium w-24 text-center ${lvl.badge}`}>{lvl.label}</span>
                <select
                  value={sel[k] ?? ""}
                  onChange={(e) => e.target.value ? selectAt(k, e.target.value) : null}
                  className={`${I} flex-1`}
                >
                  <option value="">{k === 1 ? "Select Domain" : `Select ${lvl.label} (optional)`}</option>
                  {opts.map((o) => <option key={o.id} value={o.id}>{o.number} · {o.name}</option>)}
                </select>
              </div>
            );
          })}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={addAssociation}
              disabled={!deepest}
              className="rounded-md bg-slate-800 text-white px-3 py-1.5 text-xs font-medium disabled:opacity-40"
            >
              + Add this category
            </button>
            <span className="text-xs text-slate-400">Pick a Domain, drill down as deep as you want, then add. Repeat for multiple.</span>
          </div>

          {picked.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {picked.map((id) => {
                const node = byId.get(id);
                return (
                  <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 text-brand-800 text-xs px-2.5 py-1">
                    <span className="text-[9px] px-1 rounded bg-white/60 backdrop-blur-md">{node ? levelMeta(node.level).label : ""}</span>
                    {node?.name ?? id}
                    <button type="button" onClick={() => removeAssociation(id)} className="text-brand-500 hover:text-brand-800">✕</button>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 3. Contact */}
      <div className={card}>
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-bold">3</span>
            <div>
              <h2 className="font-bold text-slate-800">Contact Details</h2>
              <p className="text-xs text-slate-500">Registered address and point of contact information</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setContacts(prev => [...prev, { name: "", designation: "", phoneCc: "+91", phone: "", email: "" }])}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition active:scale-[0.98]"
          >
            + ADD NEW CONTACT PERSON
          </button>
        </div>
        <div className="space-y-6">
          {contacts.map((c, idx) => (
            <div key={idx} className={`space-y-4 ${idx > 0 ? "border-t border-dashed border-slate-200 pt-5" : ""}`}>
              {idx > 0 && (
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Contact Person #{idx + 1}</h4>
                  <button
                    type="button"
                    onClick={() => setContacts(prev => prev.filter((_, i) => i !== idx))}
                    className="text-xs font-bold text-red-500 hover:text-red-700 transition"
                  >
                    Remove
                  </button>
                </div>
              )}
              
              <div>
                <label className={L}>Contact Person Name {idx === 0 ? "(Primary)" : `#${idx + 1}`}</label>
                <input
                  value={c.name}
                  onChange={(e) => setContacts(prev => prev.map((item, i) => i === idx ? { ...item, name: e.target.value } : item))}
                  className={I}
                  placeholder="e.g. Rajesh Kumar"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={L}>Phone</label>
                  <div className="flex gap-2">
                    <select
                      value={c.phoneCc}
                      onChange={(e) => setContacts(prev => prev.map((item, i) => i === idx ? { ...item, phoneCc: e.target.value } : item))}
                      className="w-24 shrink-0 rounded-lg border border-slate-300 px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                    >
                      {PHONE_CCS.map((cc) => <option key={cc} value={cc}>{cc}</option>)}
                    </select>
                    <input
                      type="tel"
                      maxLength={10}
                      pattern="\d{10}"
                      value={c.phone}
                      onChange={(e) => setContacts(prev => prev.map((item, i) => i === idx ? { ...item, phone: e.target.value.replace(/\D/g, "") } : item))}
                      className="flex-1 min-w-0 rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      placeholder="9876543210"
                    />
                  </div>
                </div>

                <div>
                  <label className={L}>Contact Person Designation</label>
                  <input
                    value={c.designation}
                    onChange={(e) => setContacts(prev => prev.map((item, i) => i === idx ? { ...item, designation: e.target.value } : item))}
                    className={I}
                    placeholder="e.g. Sales Manager"
                  />
                </div>
              </div>

              <div>
                <label className={L}>Email</label>
                <input
                  type="email"
                  value={c.email}
                  onChange={(e) => setContacts(prev => prev.map((item, i) => i === idx ? { ...item, email: e.target.value } : item))}
                  className={I}
                  placeholder="contact@brand.com"
                />
              </div>
            </div>
          ))}

          <div className="border-t border-slate-100 pt-4">
            <label className={L}>Website</label>
            <input value={website} onChange={(e) => setWebsite(e.target.value)} className={I} placeholder="https://brand.com" />
          </div>
          {/* Social Media Links Section */}
          <div className="border-t border-slate-100 pt-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Social Media Links</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={L}>LinkedIn Link</label>
                <input value={socialLinkedin} onChange={(e) => setSocialLinkedin(e.target.value)} className={I} placeholder="e.g. https://linkedin.com/company/brand" />
              </div>
              <div>
                <label className={L}>Twitter / X Link</label>
                <input value={socialTwitter} onChange={(e) => setSocialTwitter(e.target.value)} className={I} placeholder="e.g. https://x.com/brand" />
              </div>
              <div>
                <label className={L}>Instagram Link</label>
                <input value={socialInstagram} onChange={(e) => setSocialInstagram(e.target.value)} className={I} placeholder="e.g. https://instagram.com/brand" />
              </div>
              <div>
                <label className={L}>YouTube Link</label>
                <input value={socialYoutube} onChange={(e) => setSocialYoutube(e.target.value)} className={I} placeholder="e.g. https://youtube.com/@brand" />
              </div>
            </div>
          </div>
          <div>
            <label className={L}>Address</label>
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className={I} placeholder="Registered office address…" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={L}>Pincode</label>
              <input value={pincode} onChange={(e) => setPincode(e.target.value)} className={I} placeholder="e.g. 110001" />
            </div>
            <div>
              <label className={L}>City</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} className={I} placeholder="e.g. New Delhi" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={L}>State</label>
              <input value={stateName} onChange={(e) => setStateName(e.target.value)} className={I} placeholder="e.g. Delhi" />
            </div>
            <div>
              <label className={L}>Country</label>
              <select value={country} onChange={(e) => setCountry(e.target.value)} className={I}>
                <option value="">Select Country</option>
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={L}>GST Number</label>
            <input
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
              maxLength={15}
              className={`${I} font-mono ${gstNumber && !isValidGstin(gstNumber) ? "border-red-400" : ""}`}
              placeholder="07ABCDE1234F1Z5"
            />
            {gstNumber && !isValidGstin(gstNumber) && (
              <p className="text-[11px] text-red-500 mt-1">Invalid GSTIN — must be 15 chars (e.g. 07ABCDE1234F1Z5)</p>
            )}
          </div>
        </div>
      </div>


      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => router.push("/masters/brands")} className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm hover:bg-slate-50">Cancel</button>
        <button type="submit" disabled={busy} className="rounded-lg bg-brand-600 text-white px-6 py-2.5 text-sm font-semibold hover:bg-brand-700 disabled:opacity-60">
          {busy ? "Saving…" : editing ? "Update Brand" : "+ Add Brand"}
        </button>
      </div>
    </form>
  );
}

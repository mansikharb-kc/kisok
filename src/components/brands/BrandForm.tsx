"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BRAND_TYPES, AGREEMENT_DURATIONS, durationMonths, addMonths, formatDMY, isValidGstin, brandCodeBase } from "@/lib/brandMeta";
import { buildParentOptions, FlatCat } from "@/lib/categoryTree";
import { isValidPhone, isValidEmail, isValidPincode, isAlphabetic, isNonEmptyString } from "@/lib/validation";
import { LEVELS, levelMeta } from "@/lib/categoryLevels";

const PHONE_CCS = ["+91", "+1", "+44", "+971", "+65", "+61"];

export type BrandEdit = {
  id: string;
  name: string;
  code: string;
  brandType: string | null;
  logoMediaId: string | null;
  logoUrl: string | null;
  contactPerson: string | null;
  phoneCc: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  pincode: string | null;
  city: string | null;
  state: string | null;
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
  const [contactPerson, setContactPerson] = useState(brand?.contactPerson ?? "");
  const [phoneCc, setPhoneCc] = useState(brand?.phoneCc ?? "+91");
  const [phone, setPhone] = useState(brand?.phone ?? "");
  const [email, setEmail] = useState(brand?.email ?? "");
  const [website, setWebsite] = useState(brand?.website ?? "");
  const [address, setAddress] = useState(brand?.address ?? "");
  const [pincode, setPincode] = useState(brand?.pincode ?? "");
  const [city, setCity] = useState(brand?.city ?? "");
  const [stateName, setStateName] = useState(brand?.state ?? "");
  // contract
  const [gstNumber, setGstNumber] = useState(brand?.gstNumber ?? "");
  const [agreementDuration, setAgreementDuration] = useState(brand?.agreementDuration ?? "");
  const [contractStart, setContractStart] = useState(brand?.contractStart ?? "");
  const [description, setDescription] = useState(brand?.description ?? "");
  // categories operated in
  const [sel, setSel] = useState<Record<number, string>>({});
  const [picked, setPicked] = useState<string[]>(brand?.categoryIds ?? []); // category ids

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
    if (k === 1) return parents.filter((p) => p.level === 1);
    const parentSel = sel[k - 1];
    if (!parentSel) return [];
    return parents.filter((p) => p.level === k && p.parentId === parentSel);
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
    if (email && !isValidEmail(email)) {
      setError("Please enter a valid email address containing '@'");
      return;
    }
    if (phone && !isValidPhone(phone)) {
      setError("Phone number must be exactly 10 digits");
      return;
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
        contactPerson: contactPerson || null, phoneCc, phone: phone || null,
        email: email || null, website: website || null, address: address || null,
        pincode: pincode || null, city: city || null, state: stateName || null,
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
                <input type="file" accept="image/*" onChange={onLogo} className="hidden" />
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
        <StepHeader n={3} title="Contact Details" sub="Registered address and point of contact information" />
        <div className="space-y-4">
          <div>
            <label className={L}>Contact Person</label>
            <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className={I} placeholder="e.g. Rajesh Kumar" />
          </div>
          <div>
            <label className={L}>Phone</label>
            <div className="flex gap-2">
              <select
                value={phoneCc}
                onChange={(e) => setPhoneCc(e.target.value)}
                className="w-24 shrink-0 rounded-lg border border-slate-300 px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {PHONE_CCS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input
                type="tel"
                maxLength={10}
                pattern="\d{10}"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                className="flex-1 min-w-0 rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="9876543210"
              />
            </div>
          </div>
          <div>
            <label className={L}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={I} placeholder="contact@brand.com" />
          </div>
          <div>
            <label className={L}>Website</label>
            <input value={website} onChange={(e) => setWebsite(e.target.value)} className={I} placeholder="https://brand.com" />
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

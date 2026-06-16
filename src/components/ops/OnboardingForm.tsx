"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Brand = { id: string; name: string; code: string };
type Seller = { id: string; name: string; sellerCode: string; brands: Brand[] };
type Program = { id: string; name: string; code: string };
type Category = { id: string; name: string; code: string };
type AttrOption = { id: string; value: string };
type Attr = {
  id: string;
  name: string;
  code: string;
  dataType: string;
  unit: string | null;
  isRequired: boolean;
  options: AttrOption[];
};

type ExistingMaster = {
  exists: true;
  id: string;
  sku: string;
  name: string;
  category: { name: string; code: string } | null;
  brand: { name: string; code: string } | null;
  attrValues: { attributeId: string; name: string; unit: string | null; value: string | null }[];
};

async function getJSON(url: string) {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

async function postJSON(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

export default function OnboardingForm() {
  const router = useRouter();

  const [sellers, setSellers] = useState<Seller[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [bootErr, setBootErr] = useState("");

  // Selections
  const [sellerId, setSellerId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [programId, setProgramId] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");

  // Category search
  const [catQuery, setCatQuery] = useState("");
  const [catResults, setCatResults] = useState<Category[]>([]);
  const [catOpen, setCatOpen] = useState(false);

  // SKU lookup result
  const [existing, setExisting] = useState<ExistingMaster | null>(null);
  const [skuChecked, setSkuChecked] = useState(false);
  const [checking, setChecking] = useState(false);

  // Dynamic attributes for a NEW master
  const [attrs, setAttrs] = useState<Attr[]>([]);
  const [attrLoading, setAttrLoading] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selectedSeller = useMemo(() => sellers.find((s) => s.id === sellerId) ?? null, [sellers, sellerId]);
  const brandOptions = selectedSeller?.brands ?? [];

  const isBootingRef = useRef(true);

  // Bootstrap cascade data.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSellerId = params.get("sellerId") || "";
    const urlProgramId = params.get("programId") || "";
    const urlBrandId = params.get("brandId") || "";

    getJSON("/api/onboarding/options")
      .then((d) => {
        setSellers(d.sellers ?? []);
        setPrograms(d.programs ?? []);
        
        if (urlSellerId) setSellerId(urlSellerId);
        if (urlProgramId) setProgramId(urlProgramId);
        if (urlBrandId) setBrandId(urlBrandId);

        setTimeout(() => {
          isBootingRef.current = false;
        }, 0);
      })
      .catch((e) => setBootErr(e.message));
  }, []);

  // Debounced category search.
  const catTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (catTimer.current) clearTimeout(catTimer.current);
    catTimer.current = setTimeout(() => {
      getJSON(`/api/onboarding/options?q=${encodeURIComponent(catQuery)}`)
        .then((d) => setCatResults(d.categories ?? []))
        .catch(() => setCatResults([]));
    }, 250);
    return () => {
      if (catTimer.current) clearTimeout(catTimer.current);
    };
  }, [catQuery]);

  // When the seller changes, auto-select their first associated brand.
  useEffect(() => {
    if (selectedSeller && selectedSeller.brands.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const urlBrandId = params.get("brandId");
      if (isBootingRef.current && urlBrandId) {
        return;
      }
      setBrandId(selectedSeller.brands[0].id);
    } else {
      setBrandId("");
    }
    resetSkuState();
  }, [sellerId, selectedSeller]);

  // Reset downstream SKU state whenever the master's identity inputs change.
  useEffect(() => {
    if (isBootingRef.current) return;
    resetSkuState();
  }, [brandId, category?.id, programId]);

  function resetSkuState() {
    setExisting(null);
    setSkuChecked(false);
    setAttrs([]);
    setValues({});
  }

  // Load effective attributes (category + program) for a NEW master.
  async function loadAttributes() {
    if (!category || !programId) return;
    setAttrLoading(true);
    try {
      const d = await getJSON(
        `/api/onboarding/options?categoryId=${category.id}&programId=${programId}`,
      );
      setAttrs(d.attributes ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load attributes");
    } finally {
      setAttrLoading(false);
    }
  }

  async function checkSku() {
    setError("");
    if (!brandId || !sku.trim()) return;
    setChecking(true);
    setSkuChecked(false);
    try {
      const d = await getJSON(
        `/api/brand-products?brandId=${brandId}&sku=${encodeURIComponent(sku.trim())}`,
      );
      if (d.exists) {
        setExisting(d as ExistingMaster);
        setAttrs([]);
      } else {
        setExisting(null);
        await loadAttributes();
      }
      setSkuChecked(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "SKU check failed");
    } finally {
      setChecking(false);
    }
  }

  const canCheckSku = Boolean(sellerId && brandId && programId && category && sku.trim());

  async function submit() {
    setError("");
    if (!canCheckSku) {
      setError("Complete all steps before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      let brandProductId: string;
      if (existing) {
        brandProductId = existing.id;
      } else {
        // Validate required attributes.
        const missing = attrs.find((a) => a.isRequired && !(values[a.id] ?? "").trim());
        if (missing) {
          setError(`"${missing.name}" is required.`);
          setSubmitting(false);
          return;
        }
        if (!name.trim()) {
          setError("Product name is required.");
          setSubmitting(false);
          return;
        }
        const attributeValues = attrs
          .map((a) => buildValue(a, values[a.id]))
          .filter((v): v is NonNullable<typeof v> => v !== null);

        const created = await postJSON("/api/brand-products", {
          brandId,
          sku: sku.trim(),
          name: name.trim(),
          categoryId: category!.id,
          attributeValues,
        });
        brandProductId = created.id;
      }

      await postJSON("/api/onboarding", { brandProductId, sellerId, programId });
      router.push("/ops/onboarding");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
      setSubmitting(false);
    }
  }

  function buildValue(a: Attr, raw: string | undefined) {
    const v = (raw ?? "").trim();
    if (!v) return null;
    switch (a.dataType) {
      case "number":
        return { attributeId: a.id, valueNumber: Number(v) };
      case "boolean":
        return { attributeId: a.id, valueBool: v === "true" };
      case "date":
        return { attributeId: a.id, valueDate: v };
      case "enum":
        return { attributeId: a.id, optionId: v };
      default:
        return { attributeId: a.id, valueText: v };
    }
  }

  if (bootErr) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {bootErr}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Step 1–3: Seller → Brand → Program */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">1. Seller, Brand &amp; Program</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Seller">
            <select
              value={sellerId}
              onChange={(e) => setSellerId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">Select a seller…</option>
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.sellerCode})
                </option>
              ))}
            </select>
            {sellers.length === 0 && (
              <p className="mt-1 text-xs text-slate-400">No sellers are assigned to you.</p>
            )}
          </Field>

          <Field label="Brand">
            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              disabled={!sellerId}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
            >
              <option value="">Select a brand…</option>
              {brandOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            {sellerId && brandOptions.length === 0 && (
              <p className="mt-1 text-xs text-slate-400">This seller has no brands.</p>
            )}
          </Field>

          <Field label="Program (branch-approved)">
            <select
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">Select a program…</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {programs.length === 0 && (
              <p className="mt-1 text-xs text-slate-400">No approved programs for your branch.</p>
            )}
          </Field>
        </div>
      </section>

      {/* Step 4: Category */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">2. Category</h2>
        {category ? (
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <div className="text-sm font-medium text-slate-800">{category.name}</div>
              <div className="font-mono text-xs text-slate-500">{category.code}</div>
            </div>
            <button
              type="button"
              onClick={() => setCategory(null)}
              className="text-xs text-brand-600 hover:underline"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              value={catQuery}
              onChange={(e) => setCatQuery(e.target.value)}
              onFocus={() => setCatOpen(true)}
              placeholder="Search categories by name or code…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            {catOpen && catResults.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                {catResults.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setCategory(c);
                        setCatOpen(false);
                        setCatQuery("");
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      <span className="text-slate-800">{c.name}</span>
                      <span className="font-mono text-xs text-slate-400">{c.code}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1 text-xs text-slate-400">Showing up to 50 matches.</p>
          </div>
        )}
      </section>

      {/* Step 5: SKU */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">3. SKU</h2>
        <div className="flex items-end gap-3">
          <Field label="SKU" className="flex-1">
            <input
              value={sku}
              onChange={(e) => {
                setSku(e.target.value);
                setSkuChecked(false);
                setExisting(null);
              }}
              onBlur={() => {
                if (canCheckSku) checkSku();
              }}
              placeholder="Enter the brand SKU"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </Field>
          <button
            type="button"
            onClick={checkSku}
            disabled={!canCheckSku || checking}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {checking ? "Checking…" : "Check SKU"}
          </button>
        </div>
        {!canCheckSku && (
          <p className="mt-2 text-xs text-slate-400">
            Pick a seller, brand, program, category and enter a SKU to continue.
          </p>
        )}
      </section>

      {/* Step 6a: REUSE existing master (read-only) */}
      {skuChecked && existing && (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              Existing master — will be reused
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
            <ReadField label="Name" value={existing.name} />
            <ReadField label="SKU" value={existing.sku} />
            <ReadField label="Brand" value={existing.brand?.name ?? "—"} />
            <ReadField label="Category" value={existing.category?.name ?? "—"} />
          </div>
          {existing.attrValues.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Attributes
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm md:grid-cols-3">
                {existing.attrValues.map((v) => (
                  <div key={v.attributeId} className="truncate">
                    <span className="text-slate-400">{v.name}:</span>{" "}
                    <span className="font-medium text-slate-700">
                      {v.value ?? "—"} {v.unit ?? ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="mt-3 text-xs text-slate-500">
            This product master already exists. Submitting creates only the local onboarding record.
          </p>
        </section>
      )}

      {/* Step 6b: NEW master — name + dynamic attributes */}
      {skuChecked && !existing && (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="rounded bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
              New master — enter product details
            </span>
          </div>
          <Field label="Product Name" className="mb-5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Product name"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </Field>

          {attrLoading ? (
            <p className="text-sm text-slate-400">Loading attributes…</p>
          ) : attrs.length === 0 ? (
            <p className="text-sm text-slate-400">
              No attributes are defined for this category &amp; program.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {attrs.map((a) => (
                <Field
                  key={a.id}
                  label={`${a.name}${a.unit ? ` (${a.unit})` : ""}`}
                  required={a.isRequired}
                >
                  <AttrInput
                    attr={a}
                    value={values[a.id] ?? ""}
                    onChange={(val) => setValues((prev) => ({ ...prev, [a.id]: val }))}
                  />
                </Field>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Submit */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push("/ops/onboarding")}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!skuChecked || submitting}
          className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? "Saving…" : existing ? "Onboard (reuse master)" : "Create & Onboard"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-slate-600">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-400">{label}</div>
      <div className="text-sm font-medium text-slate-700">{value}</div>
    </div>
  );
}

function AttrInput({
  attr,
  value,
  onChange,
}: {
  attr: Attr;
  value: string;
  onChange: (v: string) => void;
}) {
  const base = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
  switch (attr.dataType) {
    case "number":
      return (
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={base}
        />
      );
    case "boolean":
      return (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={base}>
          <option value="">—</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );
    case "date":
      return (
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={base}
        />
      );
    case "enum":
      return (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={base}>
          <option value="">Select…</option>
          {attr.options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.value}
            </option>
          ))}
        </select>
      );
    default:
      return (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={base}
        />
      );
  }
}

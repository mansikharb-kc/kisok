"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { buildParentOptions, FlatCat } from "@/lib/categoryTree";
import { LEVELS } from "@/lib/categoryLevels";
import { ChevronDown, ChevronRight } from "lucide-react";

type Brand = { id: string; name: string; code: string };
type Seller = { id: string; name: string; sellerCode: string; brands: Brand[]; categoryIds: string[] };
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

export default function OnboardingForm({
  flatCategories = [],
}: {
  flatCategories?: FlatCat[];
}) {
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
  const [assignmentId, setAssignmentId] = useState("");

  // Collapse/Expand state for sections 1, 2, 3
  const [step1Open, setStep1Open] = useState(true);
  const [step2Open, setStep2Open] = useState(true);
  const [step3Open, setStep3Open] = useState(true);

  // New Master Uploads state
  const [videoMediaId, setVideoMediaId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoBusy, setVideoBusy] = useState(false);

  const [imageMediaId, setImageMediaId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imageBusy, setImageBusy] = useState(false);

  const [pdfMediaId, setPdfMediaId] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, type: "video" | "image" | "pdf") {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === "video") setVideoBusy(true);
    else if (type === "image") setImageBusy(true);
    else if (type === "pdf") setPdfBusy(true);

    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `${type} upload failed`);
        return;
      }
      if (type === "video") {
        setVideoMediaId(data.mediaId);
        setVideoUrl(data.url);
      } else if (type === "image") {
        setImageMediaId(data.mediaId);
        setImageUrl(data.url);
      } else if (type === "pdf") {
        setPdfMediaId(data.mediaId);
        setPdfUrl(data.url);
      }
    } catch {
      setError(`${type} upload failed`);
    } finally {
      if (type === "video") setVideoBusy(false);
      else if (type === "image") setImageBusy(false);
      else if (type === "pdf") setPdfBusy(false);
    }
  }

  // Category cascade selection
  const parents = useMemo(() => buildParentOptions(flatCategories), [flatCategories]);
  const byId = useMemo(() => new Map(parents.map((p) => [p.id, p])), [parents]);
  const [sel, setSel] = useState<Record<number, string>>({});

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
      if (id) next[k] = id;
      return next;
    });
  }

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
    const urlSku = params.get("sku") || "";
    const urlAssignmentId = params.get("assignmentId") || "";

    getJSON("/api/onboarding/options")
      .then((d) => {
        setSellers(d.sellers ?? []);
        setPrograms(d.programs ?? []);
        
        if (urlSellerId) setSellerId(urlSellerId);
        if (urlProgramId) setProgramId(urlProgramId);
        if (urlBrandId) setBrandId(urlBrandId);
        if (urlSku) setSku(urlSku);
        if (urlAssignmentId) setAssignmentId(urlAssignmentId);

        setTimeout(() => {
          isBootingRef.current = false;
        }, 0);
      })
      .catch((e) => setBootErr(e.message));
  }, []);

  // Debounced category search is removed in favor of cascading selector

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

  // When the seller changes, auto-select their first category or the one from URL parameters.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlCategoryId = params.get("categoryId");

    let targetCatId = "";
    if (isBootingRef.current && urlCategoryId) {
      targetCatId = urlCategoryId;
    } else if (selectedSeller && selectedSeller.categoryIds && selectedSeller.categoryIds.length > 0) {
      targetCatId = selectedSeller.categoryIds[0];
    }

    if (targetCatId) {
      const path: string[] = [];
      let currentId: string | null = targetCatId;
      while (currentId) {
        const node = byId.get(currentId);
        if (!node) break;
        path.unshift(currentId);
        currentId = node.parentId;
      }
      const initialSel: Record<number, string> = {};
      path.forEach((id, idx) => {
        initialSel[idx + 1] = id;
      });
      setSel(initialSel);

      const leafNode = byId.get(targetCatId);
      if (leafNode) {
        setCategory({ id: leafNode.id, name: leafNode.name, code: leafNode.number });
      }
    } else {
      setSel({});
      setCategory(null);
    }
  }, [sellerId, selectedSeller, byId]);

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
    setVideoMediaId(null);
    setVideoUrl("");
    setImageMediaId(null);
    setImageUrl("");
    setPdfMediaId(null);
    setPdfUrl("");
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

        const mediaIds = [imageMediaId, videoMediaId, pdfMediaId].filter((id): id is string => id !== null);
        const created = await postJSON("/api/brand-products", {
          brandId,
          sku: sku.trim(),
          name: name.trim(),
          categoryId: category!.id,
          attributeValues,
          mediaIds,
        });
        brandProductId = created.id;
      }

      await postJSON("/api/onboarding", { brandProductId, sellerId, programId });
      if (assignmentId) {
        router.push(`/ops/onboarding/task/${assignmentId}`);
      } else {
        router.push("/ops/onboarding");
      }
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
      <section className="rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm">
        <button
          type="button"
          onClick={() => setStep1Open(!step1Open)}
          className="group flex w-full items-center justify-between text-left focus:outline-none"
        >
          <h2 className="text-sm font-semibold text-slate-800 group-hover:text-brand-650 transition-colors">1. Seller, Brand &amp; Program</h2>
          <div className="flex items-center gap-1.5 text-xs font-bold text-brand-600 group-hover:text-brand-800 transition-colors select-none">
            <span>{step1Open ? "Collapse" : "Expand"}</span>
            {step1Open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
        </button>
        {step1Open && (
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
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
        )}
      </section>

      {/* Step 4: Category */}
      <section className="rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm">
        <button
          type="button"
          onClick={() => setStep2Open(!step2Open)}
          className="group flex w-full items-center justify-between text-left focus:outline-none"
        >
          <h2 className="text-sm font-semibold text-slate-800 group-hover:text-brand-650 transition-colors">2. Category</h2>
          <div className="flex items-center gap-1.5 text-xs font-bold text-brand-600 group-hover:text-brand-800 transition-colors select-none">
            <span>{step2Open ? "Collapse" : "Expand"}</span>
            {step2Open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
        </button>
        {step2Open && (
          <div className="mt-4 space-y-3">
            {selectedSeller && selectedSeller.categoryIds && selectedSeller.categoryIds.length > 0 && (
              <div className="mb-4 bg-slate-50/50 p-4 rounded-xl border border-slate-200">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Seller's Operating Categories
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedSeller.categoryIds.map((catId) => {
                    const node = byId.get(catId);
                    if (!node) return null;
                    const isCurrent = category?.id === catId;
                    return (
                      <button
                        key={catId}
                        type="button"
                        onClick={() => {
                          const path: string[] = [];
                          let currentId: string | null = catId;
                          while (currentId) {
                            const n = byId.get(currentId);
                            if (!n) break;
                            path.unshift(currentId);
                            currentId = n.parentId;
                          }
                          const newSel: Record<number, string> = {};
                          path.forEach((id, idx) => {
                            newSel[idx + 1] = id;
                          });
                          setSel(newSel);
                          setCategory({ id: node.id, name: node.name, code: node.number });
                        }}
                        className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all hover:scale-[1.005] duration-150 ${
                          isCurrent
                            ? "border-brand-600 bg-brand-50/40 text-brand-950 shadow-sm"
                            : "border-slate-200 bg-white hover:border-slate-300 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 mt-0.5 ${
                            isCurrent
                              ? "bg-brand-100 text-brand-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          L{node.level}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold truncate">{node.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Code: {node.number}
                          </div>
                        </div>
                        {isCurrent && (
                          <span className="text-brand-600 font-bold shrink-0">✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {LEVELS.map((lvl, idx) => {
              const k = idx + 1;
              if (k > 1 && !sel[k - 1]) return null;
              const opts = optionsForLevel(k);
              return (
                <div key={k} className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-medium w-24 text-center shrink-0 ${lvl.badge}`}>
                    {lvl.label}
                  </span>
                  <select
                    value={sel[k] ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        selectAt(k, val);
                        const node = byId.get(val);
                        if (node) {
                          setCategory({ id: node.id, name: node.name, code: node.number });
                        }
                      } else {
                        selectAt(k, "");
                        const parentVal = sel[k - 1];
                        if (parentVal) {
                          const node = byId.get(parentVal);
                          if (node) {
                            setCategory({ id: node.id, name: node.name, code: node.number });
                          }
                        } else {
                          setCategory(null);
                        }
                      }
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
                  >
                    <option value="">{k === 1 ? "Select Domain" : `Select ${lvl.label} (optional)`}</option>
                    {opts.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.number} · {o.name}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
            {category && (
              <div className="rounded-lg border border-brand-200 bg-brand-50/30 px-4 py-2.5 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-brand-700">Selected Category:</span>
                  <div className="text-sm font-bold text-slate-800 mt-0.5">{category.name}</div>
                  <div className="font-mono text-xs text-slate-500">{category.code}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSel({});
                    setCategory(null);
                  }}
                  className="text-xs text-brand-600 font-bold hover:underline"
                >
                  Reset Selection
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Step 5: SKU */}
      <section className="rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm">
        <button
          type="button"
          onClick={() => setStep3Open(!step3Open)}
          className="group flex w-full items-center justify-between text-left focus:outline-none"
        >
          <h2 className="text-sm font-semibold text-slate-800 group-hover:text-brand-650 transition-colors">3. SKU</h2>
          <div className="flex items-center gap-1.5 text-xs font-bold text-brand-600 group-hover:text-brand-800 transition-colors select-none">
            <span>{step3Open ? "Collapse" : "Expand"}</span>
            {step3Open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
        </button>
        {step3Open && (
          <div className="mt-4">
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
          </div>
        )}
      </section>

      {/* Step 6a: REUSE existing master (read-only) */}
      {step3Open && skuChecked && existing && (
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
      {step3Open && skuChecked && !existing && (
        <section className="rounded-lg border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm">
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

          <div className="mb-5 border-t border-slate-200/80 pt-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Product Media (Optional)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Product Image */}
              <Field label="Product Image">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageUrl} alt="product" className="w-12 h-12 rounded-lg object-contain border border-slate-200 bg-white" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-[10px] bg-slate-50 font-semibold h-12">No Image</div>
                    )}
                    <label className="flex-1 cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-650 hover:bg-slate-50 text-center select-none bg-white">
                      {imageBusy ? "Uploading…" : imageUrl ? "Change Image" : "Upload Image"}
                      <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, "image")} className="hidden" style={{ display: "none" }} disabled={imageBusy} />
                    </label>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">PNG, JPG, WEBP, GIF, SVG (max 50 MB)</p>
                </div>
              </Field>

              {/* Product Video */}
              <Field label="Product Video">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    {videoUrl ? (
                      <video src={videoUrl} className="w-12 h-12 rounded-lg object-cover border border-slate-200 bg-white" controls />
                    ) : (
                      <div className="w-12 h-12 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-[10px] bg-slate-50 font-semibold h-12">No Video</div>
                    )}
                    <label className="flex-1 cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-650 hover:bg-slate-50 text-center select-none bg-white">
                      {videoBusy ? "Uploading…" : videoUrl ? "Change Video" : "Upload Video"}
                      <input type="file" accept="video/*" onChange={(e) => handleFileUpload(e, "video")} className="hidden" style={{ display: "none" }} disabled={videoBusy} />
                    </label>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">MP4, WEBM, OGG, MOV (max 50 MB)</p>
                </div>
              </Field>

              {/* Product PDF */}
              <Field label="Product PDF Brochure">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    {pdfUrl ? (
                      <a href={pdfUrl} target="_blank" rel="noreferrer" className="w-12 h-12 rounded-lg border border-slate-200 bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs hover:bg-emerald-100 shrink-0 h-12">PDF</a>
                    ) : (
                      <div className="w-12 h-12 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-[10px] bg-slate-50 font-semibold h-12">No PDF</div>
                    )}
                    <label className="flex-1 cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-650 hover:bg-slate-50 text-center select-none bg-white">
                      {pdfBusy ? "Uploading…" : pdfUrl ? "Change PDF" : "Upload PDF"}
                      <input type="file" accept="application/pdf" onChange={(e) => handleFileUpload(e, "pdf")} className="hidden" style={{ display: "none" }} disabled={pdfBusy} />
                    </label>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">PDF document (max 50 MB)</p>
                </div>
              </Field>
            </div>
          </div>

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
      {step3Open && (
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              if (assignmentId) {
                router.push(`/ops/onboarding/task/${assignmentId}`);
              } else {
                router.push("/ops/onboarding");
              }
            }}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-650 hover:bg-slate-50"
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
      )}
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

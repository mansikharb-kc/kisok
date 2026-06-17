"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { levelMeta } from "@/lib/categoryLevels";

type Branch = { id: string; name: string; branchCode: string };
type Program = { id: string; name: string; code: string };
type PickedCategory = { id: string; name: string; level: number };
type CustomField = {
  id: string;
  label: string;
  code: string;
  fieldType: "text" | "number" | "date" | "enum";
  options: string[] | null;
  isRequired: boolean;
};

const MEMBER_TYPES = ["Paid", "Sponsor", "Barter"];
const inputCls =
  "w-full rounded border border-slate-300 bg-white/60 backdrop-blur-md px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";
const labelCls = "block text-sm font-semibold text-slate-900 mb-1";
const cardCls = "rounded border border-slate-200 bg-white/60 backdrop-blur-md p-5 shadow-sm space-y-4";

export default function CollaborationForm({ branches, programs }: { branches: Branch[]; programs: Program[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [branchId, setBranchId] = useState("");
  const [programMode, setProgramMode] = useState<"existing" | "new">(programs.length ? "existing" : "new");
  const [programId, setProgramId] = useState(programs[0]?.id ?? "");
  const [programName, setProgramName] = useState("");
  const [programCode, setProgramCode] = useState("");

  const [collaboration, setCollaboration] = useState("");
  const [membershipId, setMembershipId] = useState("");
  const [memberType, setMemberType] = useState("");
  const [salesperson, setSalesperson] = useState("");
  const [spocName, setSpocName] = useState("");
  const [spocPhone, setSpocPhone] = useState("");
  const [spocEmail, setSpocEmail] = useState("");

  const [contractStart, setContractStart] = useState("");
  const [contractEnd, setContractEnd] = useState("");
  const [fitoutPeriod, setFitoutPeriod] = useState("");
  const [collaborationTenure, setCollaborationTenure] = useState("");

  // Categories — domain-wise cascading picker
  const [categories, setCategories] = useState<PickedCategory[]>([]);
  const [catChain, setCatChain] = useState<{ id: string; name: string }[]>([]);
  const [catOptions, setCatOptions] = useState<{ id: string; name: string; hasChildren: boolean }[]>([]);
  const [catLoading, setCatLoading] = useState(false);

  // Custom fields (HO-defined)
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [showAddField, setShowAddField] = useState(false);
  const [newField, setNewField] = useState({ label: "", fieldType: "text", options: "", isRequired: false });

  useEffect(() => {
    loadCustomFields();
  }, []);

  async function loadCustomFields() {
    try {
      const res = await fetch("/api/custom-fields?entity=collaboration");
      const data = await res.json();
      setCustomFields(data.fields ?? []);
    } catch {
      /* ignore */
    }
  }

  // Load domains (roots) on mount
  useEffect(() => {
    loadChildren(null);
  }, []);

  async function loadChildren(parentId: string | null) {
    setCatLoading(true);
    try {
      const res = await fetch(`/api/categories/children?parentId=${parentId ?? ""}`);
      const data = await res.json();
      setCatOptions(data.categories ?? []);
    } catch {
      setCatOptions([]);
    } finally {
      setCatLoading(false);
    }
  }

  async function pickLevel(o: { id: string; name: string; hasChildren: boolean }) {
    setCatChain((prev) => [...prev, { id: o.id, name: o.name }]);
    if (o.hasChildren) await loadChildren(o.id);
    else setCatOptions([]);
  }

  async function goToDepth(n: number) {
    const newChain = catChain.slice(0, n);
    setCatChain(newChain);
    const parent = newChain[newChain.length - 1];
    await loadChildren(parent ? parent.id : null);
  }

  function addCurrentCategory() {
    const leaf = catChain[catChain.length - 1];
    if (!leaf) return;
    if (!categories.some((c) => c.id === leaf.id)) {
      setCategories((prev) => [...prev, { id: leaf.id, name: catChain.map((c) => c.name).join(" › "), level: catChain.length }]);
    }
    goToDepth(0);
  }

  async function addCustomField(e: React.FormEvent) {
    e.preventDefault();
    if (!newField.label.trim()) return;
    const body = {
      entity: "collaboration",
      label: newField.label.trim(),
      fieldType: newField.fieldType,
      options:
        newField.fieldType === "enum"
          ? newField.options.split("\n").map((s) => s.trim()).filter(Boolean)
          : [],
      isRequired: newField.isRequired,
    };
    const res = await fetch("/api/custom-fields", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not add field");
      return;
    }
    setNewField({ label: "", fieldType: "text", options: "", isRequired: false });
    setShowAddField(false);
    await loadCustomFields();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!branchId) return setError("Select a branch for this program");
    if (programMode === "existing" && !programId) return setError("Select a program");
    if (programMode === "new" && (!programName.trim() || !programCode.trim()))
      return setError("Enter a program name and code");

    setBusy(true);
    try {
      // HO creates only the program master (+ branch link). Member/contract/category
      // data is entered later by the Onboarding Lead on the Add Seller page.
      const payload = {
        branchId,
        programId: programMode === "existing" ? programId : undefined,
        programName: programMode === "new" ? programName.trim() : undefined,
        programCode: programMode === "new" ? programCode.trim() : undefined,
      };
      const res = await fetch("/api/collaborations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Save failed");
        return;
      }
      router.push("/masters/programs");
      router.refresh();
    } catch {
      setError("Request failed. Check your session or network.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <Link href="/masters/programs" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
          Back to programs
        </Link>
        <h1 className="text-3xl font-bold text-slate-900">New Program</h1>
        <p className="text-sm text-slate-600">
          Set up a program for a branch — program details, the collaborating member, contract terms and categories.
        </p>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <form onSubmit={onSubmit} className="space-y-5">
        {/* Branch + Program */}
        <div className={cardCls}>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Program &amp; Branch</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelCls}>Branch</label>
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputCls} required>
                <option value="">— Select branch —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.branchCode})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Program</label>
              <div className="flex gap-2 mb-2 text-xs">
                <button type="button" onClick={() => setProgramMode("existing")} className={`rounded px-2 py-1 ${programMode === "existing" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                  Existing
                </button>
                <button type="button" onClick={() => setProgramMode("new")} className={`rounded px-2 py-1 ${programMode === "new" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                  Create new
                </button>
              </div>
              {programMode === "existing" ? (
                <select value={programId} onChange={(e) => setProgramId(e.target.value)} className={inputCls}>
                  <option value="">— Select program —</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <input value={programName} onChange={(e) => setProgramName(e.target.value)} className={inputCls} placeholder="Program name" />
                  <input value={programCode} onChange={(e) => setProgramCode(e.target.value)} className={`${inputCls} font-mono`} placeholder="program-code" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* View-only preview — Onboarding Lead fills these on the Add Seller page */}
        <fieldset disabled className="space-y-5 opacity-70 m-0 p-0 border-0 min-w-0">
          <p className="text-xs text-slate-500 italic">
            Member, contract &amp; category details are filled by the Onboarding Lead during seller onboarding — shown here for reference only.
          </p>
        {/* Member / Collaboration */}
        <div className={cardCls}>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Member</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelCls}>Collaboration (company)</label>
              <input value={collaboration} onChange={(e) => setCollaboration(e.target.value)} className={inputCls} placeholder="e.g. Kohler India" required />
            </div>
            <div>
              <label className={labelCls}>Membership ID</label>
              <input value={membershipId} onChange={(e) => setMembershipId(e.target.value)} className={`${inputCls} font-mono`} placeholder="Auto (MEM-####) — leave blank" />
            </div>
            <div>
              <label className={labelCls}>Type of member</label>
              <select value={memberType} onChange={(e) => setMemberType(e.target.value)} className={inputCls}>
                <option value="">— Select —</option>
                {MEMBER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Salesperson</label>
              <input value={salesperson} onChange={(e) => setSalesperson(e.target.value)} className={inputCls} placeholder="KC salesperson" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className={labelCls}>SPOC name</label>
              <input value={spocName} onChange={(e) => setSpocName(e.target.value)} className={inputCls} placeholder="Contact person" />
            </div>
            <div>
              <label className={labelCls}>SPOC phone</label>
              <input value={spocPhone} onChange={(e) => setSpocPhone(e.target.value)} className={inputCls} placeholder="+91…" />
            </div>
            <div>
              <label className={labelCls}>SPOC email</label>
              <input value={spocEmail} onChange={(e) => setSpocEmail(e.target.value)} type="email" className={inputCls} placeholder="name@company.com" />
            </div>
          </div>
        </div>

        {/* Contract */}
        <div className={cardCls}>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Contract</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelCls}>Start date</label>
              <input value={contractStart} onChange={(e) => setContractStart(e.target.value)} type="date" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>End date</label>
              <input value={contractEnd} onChange={(e) => setContractEnd(e.target.value)} type="date" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Fitout period</label>
              <input value={fitoutPeriod} onChange={(e) => setFitoutPeriod(e.target.value)} className={inputCls} placeholder="e.g. 30 days" />
            </div>
            <div>
              <label className={labelCls}>Contract tenure</label>
              <input value={collaborationTenure} onChange={(e) => setCollaborationTenure(e.target.value)} className={inputCls} placeholder="e.g. 12 months" />
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className={cardCls}>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Categories</h2>
          <div className="flex flex-wrap gap-1.5">
            {categories.length === 0 ? (
              <span className="text-xs text-slate-400">No categories selected yet.</span>
            ) : (
              categories.map((c) => (
                <span key={c.id} className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white/70 text-slate-700 text-xs px-2 py-1">
                  <span className={`h-2 w-2 rounded-full ${levelMeta(c.level).dot}`} title={levelMeta(c.level).label} />
                  {c.name}
                  <button type="button" onClick={() => setCategories((prev) => prev.filter((x) => x.id !== c.id))} className="text-slate-400 hover:text-red-600">
                    ✕
                  </button>
                </span>
              ))
            )}
          </div>
          <div className="space-y-3">
            {/* Drill path — colour-coded by hierarchy level */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => goToDepth(0)}
                className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-brand-600"
              >
                Domains
              </button>
              {catChain.map((c, i) => {
                const m = levelMeta(i + 1);
                return (
                  <span key={c.id} className="flex items-center gap-1.5">
                    <span className="text-slate-300">›</span>
                    <button
                      type="button"
                      onClick={() => goToDepth(i + 1)}
                      title={m.label}
                      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium ${m.badge}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
                      {c.name}
                    </button>
                  </span>
                );
              })}
            </div>

            {/* Next level to pick */}
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider">
              <span className={`h-2 w-2 rounded-full ${levelMeta(catChain.length + 1).dot}`} />
              <span className="text-slate-500">
                {catOptions.length === 0 && catChain.length > 0 ? "Deepest level reached" : `Choose ${levelMeta(catChain.length + 1).label}`}
              </span>
            </div>

            <div className="flex gap-2">
              <select
                value=""
                onChange={(e) => {
                  const o = catOptions.find((x) => x.id === e.target.value);
                  if (o) pickLevel(o);
                }}
                disabled={catLoading || catOptions.length === 0}
                className={inputCls}
              >
                <option value="">
                  {catLoading
                    ? "Loading…"
                    : catOptions.length === 0
                    ? catChain.length
                      ? "No further sub-categories"
                      : "No domains"
                    : `Select ${levelMeta(catChain.length + 1).label}…`}
                </option>
                {catOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                    {o.hasChildren ? " ›" : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={addCurrentCategory}
                disabled={catChain.length === 0}
                className="shrink-0 rounded bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
              >
                Add
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Choose a domain first, then drill into sub-categories. Each colour marks a level. Go as deep as you want, then click “Add”.
            </p>
          </div>
        </div>

        </fieldset>

        {/* Custom fields */}
        <div className={cardCls}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Additional fields</h2>
            <button type="button" onClick={() => setShowAddField((s) => !s)} className="text-xs font-semibold text-brand-600 hover:text-brand-700">
              {showAddField ? "Cancel" : "+ Add field"}
            </button>
          </div>

          {showAddField && (
            <div className="rounded border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className={labelCls}>Field label</label>
                  <input value={newField.label} onChange={(e) => setNewField((f) => ({ ...f, label: e.target.value }))} className={inputCls} placeholder="e.g. Display Zone" />
                </div>
                <div>
                  <label className={labelCls}>Type</label>
                  <select value={newField.fieldType} onChange={(e) => setNewField((f) => ({ ...f, fieldType: e.target.value }))} className={inputCls}>
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="enum">Dropdown</option>
                  </select>
                </div>
              </div>
              {newField.fieldType === "enum" && (
                <div>
                  <label className={labelCls}>Dropdown options (one per line)</label>
                  <textarea value={newField.options} onChange={(e) => setNewField((f) => ({ ...f, options: e.target.value }))} rows={3} className={inputCls} placeholder={"Option A\nOption B"} />
                </div>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={newField.isRequired} onChange={(e) => setNewField((f) => ({ ...f, isRequired: e.target.checked }))} />
                Required
              </label>
              <button type="button" onClick={addCustomField} className="rounded bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                Save field
              </button>
            </div>
          )}

          {customFields.length === 0 ? (
            <p className="text-xs text-slate-400">No additional fields. HO admin can add fields with “+ Add field”.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {customFields.map((f) => (
                <div key={f.id}>
                  <label className={labelCls}>
                    {f.label}
                    {f.isRequired && <span className="text-red-500"> *</span>}
                  </label>
                  {f.fieldType === "enum" ? (
                    <select value={customValues[f.code] ?? ""} onChange={(e) => setCustomValues((v) => ({ ...v, [f.code]: e.target.value }))} className={inputCls}>
                      <option value="">— Select —</option>
                      {(f.options ?? []).map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={f.fieldType === "number" ? "number" : f.fieldType === "date" ? "date" : "text"}
                      value={customValues[f.code] ?? ""}
                      onChange={(e) => setCustomValues((v) => ({ ...v, [f.code]: e.target.value }))}
                      className={inputCls}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link href="/masters/programs" className="rounded border border-slate-300 bg-white/60 backdrop-blur-md px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Cancel
          </Link>
          <button type="submit" disabled={busy} className="rounded bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-60">
            {busy ? "Saving…" : "Create Program"}
          </button>
        </div>
      </form>
    </div>
  );
}
